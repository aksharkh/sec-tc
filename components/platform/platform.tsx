"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ArrowRight, Building2, Check, CircleAlert, Copy, ExternalLink, FileText, Globe2, HeartPulse, Info, LayoutDashboard, Minus, MoreHorizontal, Plus, UsersRound } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/kit/bits";
import { DataTable } from "@/components/kit/data-table";
import { StatCard } from "@/components/kit/widgets";
import { PageSkeleton } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Checkbox, Segmented, Select } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Meta, ProgressBar } from "@/components/ui/display";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { useReady } from "@/lib/hooks";
import { effectiveStatus, useTrust } from "@/lib/store";
import type { Tenant, TenantStatus } from "@/lib/types";
import { cn, fmt, nowMs } from "@/lib/utils";

const STATUS: Record<TenantStatus, { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "success" },
  setup: { label: "Setup", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  paused: { label: "Paused", tone: "danger" },
};

/* ───────── Plan usage and health ───────── */

const LIMITS: Record<Tenant["plan"], { documents: number; reviewers: number; api: number | null }> = {
  Federal: { documents: 50, reviewers: 100, api: 50_000 },
  Standard: { documents: 25, reviewers: 50, api: null },
};

type HealthScore = "healthy" | "attention" | "setup";
const HEALTH: Record<HealthScore, { label: string; tone: Tone }> = {
  healthy: { label: "Healthy", tone: "success" },
  attention: { label: "Needs attention", tone: "warning" },
  setup: { label: "Setup", tone: "neutral" },
};

type HealthCheck = { label: string; state: "ok" | "warn" | "na"; value: string };
type TenantOps = {
  usage: { documents: number; reviewers: number; api: number | null };
  limits: (typeof LIMITS)[Tenant["plan"]];
  checks: HealthCheck[];
  uptime: number | null;
  score: HealthScore;
  issues: string[];
};

/** Deterministic figures for tenants without live demo data. */
const OTHER: Record<string, { api: number; json: "valid" | "stale" | "na"; integrationErrors: number; uptime: number; note?: string }> = {
  halcyon: { api: 43_900, json: "valid", integrationErrors: 0, uptime: 99.97 },
  copperline: { api: 0, json: "na", integrationErrors: 1, uptime: 99.99, note: "Slack token expired" },
  ridgeway: { api: 0, json: "na", integrationErrors: 0, uptime: 100 },
  bluefin: { api: 0, json: "na", integrationErrors: 0, uptime: 100 },
};

const pct = (used: number, limit: number | null) => (limit ? (used / limit) * 100 : 0);

function useTenantOps(rows: Tenant[]) {
  const pkg = useTrust((s) => s.pkg);
  const domain = useTrust((s) => s.domain);
  const integrations = useTrust((s) => s.integrations);
  const webhooks = useTrust((s) => s.webhooks);
  const components = useTrust((s) => s.components);
  const logs = useTrust((s) => s.logs);
  return React.useMemo(() => {
    const out = new Map<string, TenantOps>();
    const monthStart = new Date(nowMs());
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // Each logged API fetch stands for a paginated sync of many requests.
    const nwApi = logs.filter((e) => e.channel === "api" && new Date(e.at).getTime() >= monthStart.getTime()).length * 85;
    const nwErrors = integrations.filter((i) => i.status === "error").length + webhooks.filter((w) => w.status === "failing").length;
    const all = components.flatMap((c) => c.uptime);
    const nwUptime = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 100;

    for (const t of rows) {
      const limits = LIMITS[t.plan];
      const isNw = t.slug === "northwind";
      const other = OTHER[t.slug] ?? { api: 0, json: "na" as const, integrationErrors: 0, uptime: 100 };
      const usage = { documents: t.documents, reviewers: t.reviewers, api: limits.api === null ? null : isNw ? nwApi : other.api };
      const json = t.plan === "Standard" ? "na" : isNw ? pkg.status : t.status === "live" ? other.json : "na";
      const dom = isNw ? domain.status : t.domainStatus;
      const errors = isNw ? nwErrors : other.integrationErrors;
      const uptime = t.status === "live" ? (isNw ? nwUptime : other.uptime) : null;
      const checks: HealthCheck[] = [
        { label: "Package JSON", state: json === "na" ? "na" : json === "valid" ? "ok" : "warn", value: json === "na" ? (t.plan === "Standard" ? "Not in plan" : "Not generated yet") : json === "valid" ? "Valid" : "Behind the trust page" },
        { label: "Domain", state: dom === "verified" ? "ok" : dom === "pending" ? "warn" : "na", value: dom === "verified" ? "Verified, TLS active" : dom === "pending" ? "Waiting for DNS" : "Not published" },
        { label: "Integrations", state: errors ? "warn" : "ok", value: errors ? `${errors} ${errors === 1 ? "error" : "errors"}${!isNw && other.note ? `: ${other.note}` : ""}` : "All OK" },
        { label: "Uptime, 90 days", state: uptime === null ? "na" : uptime >= 99.9 ? "ok" : "warn", value: uptime === null ? "Not live yet" : `${uptime.toFixed(2)}%` },
        { label: "Last publish", state: t.lastPublishAt ? "ok" : "na", value: t.lastPublishAt ? fmt.ago(t.lastPublishAt) : "Not yet" },
      ];
      const issues: string[] = [];
      checks.filter((c) => c.state === "warn").forEach((c) => issues.push(`${c.label}: ${c.value}`));
      ([["Documents", usage.documents, limits.documents], ["Reviewers", usage.reviewers, limits.reviewers], ["API calls", usage.api ?? 0, limits.api]] as const).forEach(([label, used, limit]) => {
        if (limit && pct(used, limit) >= 80) issues.push(`${label} at ${Math.round(pct(used, limit))}% of plan`);
      });
      const score: HealthScore = t.status === "setup" || t.status === "draft" ? "setup" : issues.length ? "attention" : "healthy";
      out.set(t.id, { usage, limits, checks, uptime, score, issues });
    }
    return out;
  }, [rows, pkg.status, domain.status, integrations, webhooks, components, logs]);
}

function UsageLine({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null)
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-faint">
        <span className="w-[54px] shrink-0">{label}</span>
        <span>Not in plan</span>
      </div>
    );
  const p = pct(used, limit);
  const warn = p >= 80;
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="w-[54px] shrink-0 text-muted">{label}</span>
      <div className={cn("h-1 w-16 overflow-hidden rounded-full", warn ? "bg-warning-soft" : "bg-subtle-2")}>
        <div className={cn("h-full rounded-full", warn ? "bg-warning" : "bg-fg/70")} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className={cn("whitespace-nowrap", warn ? "font-medium text-warning-fg" : "text-muted")}>
        {fmt.compact(used)}/{fmt.compact(limit)}
      </span>
    </div>
  );
}

function HealthBadge({ ops }: { ops: TenantOps }) {
  const h = HEALTH[ops.score];
  return (
    <Tooltip
      content={
        ops.score === "setup" ? (
          "Not live yet. Health checks start after the first publish."
        ) : ops.issues.length ? (
          <span className="grid gap-0.5">
            {ops.issues.map((i) => (
              <span key={i}>{i}</span>
            ))}
          </span>
        ) : (
          "JSON valid, domain verified, integrations OK, usage under 80%"
        )
      }
    >
      <span className="inline-flex">
        <Badge tone={h.tone} dot>
          {h.label}
          {ops.score === "attention" && <span className="opacity-70">{ops.issues.length}</span>}
        </Badge>
      </span>
    </Tooltip>
  );
}

export function PlatformPage() {
  const ready = useReady();
  if (!ready) return <PageSkeleton />;
  return <PlatformBody />;
}

function PlatformBody() {
  const router = useRouter();
  const tenants = useTrust((s) => s.tenants);
  const docs = useTrust((s) => s.documents);
  const reviewers = useTrust((s) => s.reviewers);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | TenantStatus>("all");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [healthFilter, setHealthFilter] = React.useState(false);
  const [detail, setDetail] = React.useState<Tenant | null>(null);

  // Northwind's counts come from its live demo data; other tenants use their seeded totals.
  const rows = React.useMemo(() => {
    const nwReviewers = reviewers.filter((r) => effectiveStatus(r) === "active").length;
    return tenants.map((t) => (t.slug === "northwind" ? { ...t, documents: docs.length, reviewers: nwReviewers } : t));
  }, [tenants, docs, reviewers]);

  const ops = useTenantOps(rows);
  const attention = rows.filter((t) => ops.get(t.id)?.score === "attention").length;
  const shown = rows.filter((t) => (status === "all" || t.status === status) && (!healthFilter || ops.get(t.id)?.score === "attention"));
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length, live: 0, setup: 0, draft: 0, paused: 0 };
    rows.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const live = rows.filter((t) => t.status === "live");
  const pendingDomains = rows.filter((t) => t.domainStatus === "pending").length;

  const columns = React.useMemo<ColumnDef<Tenant, unknown>[]>(
    () => [
      {
        id: "client",
        accessorFn: (t) => `${t.name} ${t.product} ${t.domain} ${t.frameworks.join(" ")}`,
        header: "Client",
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[13px] font-semibold text-white" style={{ background: t.accent }} aria-hidden>
                {t.name[0]}
              </span>
              <div className="min-w-0">
                <Link href={`/t/${t.slug}`} className="block truncate font-medium text-fg hover:text-brand-ink" onClick={(e) => e.stopPropagation()}>
                  {t.name}
                </Link>
                <div className="truncate text-[12px] text-muted">{t.product} · {t.frameworks[0]}{t.frameworks.length > 1 ? ` +${t.frameworks.length - 1}` : ""}</div>
              </div>
            </div>
          );
        },
        meta: { className: "min-w-[220px]" },
      },
      {
        id: "plan",
        accessorKey: "plan",
        header: "Plan",
        cell: ({ row }) => <Badge tone={row.original.plan === "Federal" ? "brand" : "neutral"}>{row.original.plan}</Badge>,
      },
      {
        id: "domain",
        accessorKey: "domain",
        header: "Domain",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-mono text-[12px] text-fg">{t.domain}</div>
              <div className={cn("mt-0.5 flex items-center gap-1 text-[11.5px]", t.domainStatus === "verified" ? "text-success-fg" : t.domainStatus === "pending" ? "text-warning-fg" : "text-muted")}>
                <span className={cn("size-1.5 rounded-full", t.domainStatus === "verified" ? "bg-success" : t.domainStatus === "pending" ? "bg-warning" : "bg-neutral")} />
                {t.domainStatus === "verified" ? "Verified" : t.domainStatus === "pending" ? "DNS pending" : "Not published"}
              </div>
            </div>
          );
        },
        meta: { className: "max-w-[230px]" },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge tone={STATUS[row.original.status].tone} dot>
            {STATUS[row.original.status].label}
          </Badge>
        ),
      },
      {
        id: "usage",
        header: "Plan usage",
        accessorFn: (t) => {
          const o = ops.get(t.id);
          return o ? Math.max(pct(o.usage.documents, o.limits.documents), pct(o.usage.reviewers, o.limits.reviewers), pct(o.usage.api ?? 0, o.limits.api)) : 0;
        },
        cell: ({ row }) => {
          const o = ops.get(row.original.id);
          if (!o) return null;
          return (
            <div className="grid grid-cols-1 gap-1 py-1">
              <UsageLine label="Docs" used={o.usage.documents} limit={o.limits.documents} />
              <UsageLine label="Reviewers" used={o.usage.reviewers} limit={o.limits.reviewers} />
              <UsageLine label="API, month" used={o.usage.api ?? 0} limit={o.limits.api} />
            </div>
          );
        },
        meta: { className: "min-w-[210px]", hideBelow: "md" },
      },
      {
        id: "health",
        header: "Health",
        accessorFn: (t) => ["attention", "setup", "healthy"].indexOf(ops.get(t.id)?.score ?? "healthy"),
        cell: ({ row }) => {
          const o = ops.get(row.original.id);
          return o ? <HealthBadge ops={o} /> : null;
        },
      },
      {
        id: "lastPublish",
        accessorFn: (t) => t.lastPublishAt ?? "",
        header: "Last publish",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.lastPublishAt ? fmt.ago(row.original.lastPublishAt) : "Not yet"}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex justify-end">
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${t.name}`} onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent className="w-56">
                  <MenuItem onSelect={() => setDetail(t)}>
                    <HeartPulse />
                    Usage and health
                  </MenuItem>
                  <MenuItem disabled={t.slug !== "northwind"} onSelect={() => router.push("/admin")}>
                    <LayoutDashboard />
                    Open admin
                    {t.slug !== "northwind" && <span className="ml-auto text-[11px] text-faint">No demo data</span>}
                  </MenuItem>
                  <MenuItem onSelect={() => router.push(`/t/${t.slug}`)}>
                    <ExternalLink />
                    Open public page
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onSelect={async () => {
                      try {
                        await navigator.clipboard.writeText(`https://${t.domain}`);
                      } catch {
                        /* clipboard can be blocked in previews */
                      }
                      toast.success("Domain copied", { description: t.domain });
                    }}
                  >
                    <Copy />
                    Copy domain
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          );
        },
        meta: { className: "w-12" },
      },
    ],
    [router, ops],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="SecureKnots staff"
        title="Trust centers"
        description="Every client trust center SecureKnots manages: plan, domain, status and when each last published."
        actions={
          <Button variant="primary" onClick={() => setWizardOpen(true)}>
            <Plus />
            New trust center
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live trust centers" value={fmt.num(live.length)} footer={`${rows.length - live.length} in setup or draft`} icon={<Building2 />} />
        <StatCard label="Documents published" value={fmt.num(live.reduce((a, t) => a + t.documents, 0))} footer="Across live trust centers" icon={<FileText />} />
        <StatCard label="Active reviewers" value={fmt.num(rows.reduce((a, t) => a + t.reviewers, 0))} footer="Agency users and systems" icon={<UsersRound />} />
        <StatCard
          label="Need attention"
          value={fmt.num(attention)}
          footer={attention ? `${pendingDomains} ${pendingDomains === 1 ? "domain" : "domains"} pending DNS; see the Health column` : "Every live trust center is healthy"}
          icon={<Globe2 />}
        />
      </div>

      <div className="mt-4">
        <DataTable
          data={shown}
          columns={columns}
          getRowId={(t) => t.id}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Search clients or domains"
          minWidth={1040}
          onRowClick={(t) => setDetail(t)}
          initialSorting={[{ id: "lastPublish", desc: true }]}
          rowClassName={(t) => (t.slug === fresh ? "animate-fade-in bg-brand-soft/50" : undefined)}
          filters={
            <>
              {(["all", "live", "setup", "draft"] as const).map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s === "all" ? "All" : STATUS[s].label}
                  <span className={cn("text-[11px]", status === s ? "opacity-70" : "text-faint")}>{counts[s] ?? 0}</span>
                </Chip>
              ))}
              <span className="mx-1 h-4 w-px shrink-0 bg-line-strong" />
              <Chip active={healthFilter} onClick={() => setHealthFilter((h) => !h)}>
                <HeartPulse /> Needs attention
                <span className={cn("text-[11px]", healthFilter ? "opacity-70" : "text-faint")}>{attention}</span>
              </Chip>
            </>
          }
          empty={
            <EmptyState
              compact
              title="No trust centers match"
              body="Try another name or domain, or clear the filters."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setStatus("all");
                    setHealthFilter(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </div>

      <TenantDetailSheet tenant={detail} ops={detail ? ops.get(detail.id) : undefined} onClose={() => setDetail(null)} />

      <NewTrustCenterDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(slug) => {
          setStatus("all");
          setQ("");
          setFresh(slug);
          setTimeout(() => setFresh((f) => (f === slug ? null : f)), 4000);
        }}
      />
    </motion.div>
  );
}

/* ───────── Tenant usage and health detail ───────── */

function TenantDetailSheet({ tenant, ops, onClose }: { tenant: Tenant | null; ops?: TenantOps; onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet open={!!tenant} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={520}>
        {tenant && ops && (
          <>
            <SheetHeader title={tenant.name} description={`${tenant.product} · ${tenant.plan} plan`}>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={STATUS[tenant.status].tone} dot>
                  {STATUS[tenant.status].label}
                </Badge>
                <HealthBadge ops={ops} />
              </div>
            </SheetHeader>
            <SheetBody className="grid grid-cols-1 content-start gap-6">
              <div>
                <div className="text-[13px] font-semibold text-fg">Plan usage</div>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {tenant.plan} plan limits. We warn the client at 80% and offer the next plan before anything stops.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  {(
                    [
                      ["Documents", ops.usage.documents, ops.limits.documents],
                      ["Reviewers", ops.usage.reviewers, ops.limits.reviewers],
                      ["API calls this month", ops.usage.api ?? 0, ops.limits.api],
                    ] as const
                  ).map(([label, used, limit]) => {
                    const p = pct(used, limit);
                    return (
                      <div key={label}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="text-fg">{label}</span>
                          <span className={cn(limit && p >= 80 ? "font-medium text-warning-fg" : "text-muted")}>
                            {limit === null ? "Not in plan" : `${fmt.num(used)} of ${fmt.num(limit)} · ${Math.round(p)}%`}
                          </span>
                        </div>
                        {limit !== null && <ProgressBar className="mt-1.5" value={p} tone={p >= 80 ? "warning" : "brand"} label={`${label} used`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-fg">Health checks</div>
                <ul className="mt-2 divide-y divide-line rounded-[10px] border border-line">
                  {ops.checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full",
                          c.state === "ok" && "bg-success-soft text-success-fg",
                          c.state === "warn" && "bg-warning-soft text-warning-fg",
                          c.state === "na" && "bg-subtle text-faint",
                        )}
                      >
                        {c.state === "ok" ? <Check className="size-3" strokeWidth={3} /> : c.state === "warn" ? <CircleAlert className="size-3" /> : <Minus className="size-3" />}
                      </span>
                      <span className="flex-1 text-fg">{c.label}</span>
                      <span className={cn("text-right", c.state === "warn" ? "text-warning-fg" : "text-muted")}>{c.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Meta
                items={[
                  { label: "Domain", value: <span className="font-mono text-[12.5px]">{tenant.domain}</span> },
                  { label: "Owner", value: tenant.owner },
                  { label: "Created", value: fmt.date(tenant.createdAt) },
                  { label: "Frameworks", value: tenant.frameworks.join(", ") },
                ]}
              />
            </SheetBody>
            <SheetFooter>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${tenant.slug}`)}>
                <ExternalLink /> Public page
              </Button>
              {tenant.slug === "northwind" && (
                <Button variant="primary" onClick={() => router.push("/admin")}>
                  <LayoutDashboard /> Open admin
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ───────── New trust center wizard ───────── */

const WORKSPACE_CLIENTS = [
  { name: "Fairhaven Logistics", product: "Fairhaven Dispatch", frameworks: ["FedRAMP 20x Class B", "SOC 2"] },
  { name: "Tidewater Analytics", product: "Tidewater Pulse", frameworks: ["SOC 2", "ISO 27001"] },
  { name: "Kestrel Identity", product: "Kestrel Access", frameworks: ["FedRAMP 20x Class C", "ISO 27001", "SOC 2"] },
];
const FRAMEWORKS = ["FedRAMP 20x Class B", "FedRAMP 20x Class C", "SOC 2", "ISO 27001", "ISO 42001", "HIPAA", "PCI DSS", "CMMC Level 2"];
const DOC_TYPES = [
  { id: "package", label: "Certification package", hint: "Assessment report, KSI summary, POA&M, boundary" },
  { id: "reports", label: "Audit reports", hint: "SOC 2, SOC 3, penetration test summaries" },
  { id: "certs", label: "Certificates", hint: "ISO certificates and letters" },
  { id: "policies", label: "Policies", hint: "Approved policies marked shareable" },
];
const ACCENTS = ["#2f6f4f", "#7a4b9c", "#9b3d5f", "#2f6f9f", "#5b6b2a", "#8a5a1f"];
const WIZARD_STEPS = ["Client", "Plan", "Domain", "Documents", "Review"];
const HOST_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,63}$/;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|corporation|systems|technologies)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24) || "client";

function NewTrustCenterDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (slug: string) => void }) {
  const tenants = useTrust((s) => s.tenants);
  const createTenant = useTrust((s) => s.createTenant);
  const [step, setStep] = React.useState(0);
  const [source, setSource] = React.useState("");
  const [name, setName] = React.useState("");
  const [product, setProduct] = React.useState("");
  const [plan, setPlan] = React.useState<Tenant["plan"]>("Federal");
  const [domainMode, setDomainMode] = React.useState<"custom" | "default">("custom");
  const [customHost, setCustomHost] = React.useState("");
  const [frameworks, setFrameworks] = React.useState<string[]>([]);
  const [docTypes, setDocTypes] = React.useState<string[]>(["package", "reports", "certs"]);
  const [touched, setTouched] = React.useState(false);

  const baseSlug = slugify(name);
  const slug = tenants.some((t) => t.slug === baseSlug) ? `${baseSlug}-2` : baseSlug;
  const defaultHost = `${slug}.trust.secureknots.com`;
  const host = customHost.trim().toLowerCase();
  const domain = domainMode === "custom" ? host : defaultHost;

  const errors: Record<number, string> = {
    0: name.trim().length < 2 ? "Enter the client's name." : product.trim().length < 2 ? "Enter the product or service name." : "",
    1: "",
    2:
      domainMode === "custom" && !HOST_RE.test(host)
        ? "Use a subdomain the client owns, such as trust.example.com."
        : domainMode === "custom" && tenants.some((t) => t.domain === host)
          ? "Another trust center already uses this domain."
          : "",
    3: !frameworks.length ? "Pick at least one framework to show." : !docTypes.length ? "Pick at least one document type." : "",
    4: "",
  };

  const reset = () => {
    setStep(0);
    setSource("");
    setName("");
    setProduct("");
    setPlan("Federal");
    setDomainMode("custom");
    setCustomHost("");
    setFrameworks([]);
    setDocTypes(["package", "reports", "certs"]);
    setTouched(false);
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 200);
  };

  const next = () => {
    setTouched(true);
    if (errors[step]) return;
    setTouched(false);
    setStep((s) => Math.min(4, s + 1));
  };

  const create = () => {
    createTenant({
      slug,
      name: name.trim(),
      product: product.trim(),
      domain,
      domainStatus: domainMode === "custom" ? "pending" : "verified",
      plan,
      status: "setup",
      frameworks,
      accent: ACCENTS[tenants.length % ACCENTS.length]!,
    });
    toast.success(`Trust center created for ${name.trim()}`, {
      description: domainMode === "custom" ? `Send the client the CNAME record for ${domain}.` : `Ready at ${domain} once documents are published.`,
    });
    onCreated(slug);
    close(false);
  };

  const pickSource = (v: string) => {
    setSource(v);
    const c = WORKSPACE_CLIENTS.find((x) => x.name === v);
    if (c) {
      setName(c.name);
      setProduct(c.product);
      setFrameworks(c.frameworks);
      setPlan(c.frameworks.some((f) => f.startsWith("FedRAMP")) ? "Federal" : "Standard");
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const err = touched ? errors[step] : "";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg">
        <DialogHeader title="New trust center" description="Set up a trust center for a certified client. Nothing is public until documents are published." />
        <div className="px-5 pt-2 sm:px-6">
          <ol className="flex items-center gap-2" aria-label="Steps">
            {WIZARD_STEPS.map((s, i) => (
              <li key={s} className={cn("flex min-w-0 items-center gap-2", i < WIZARD_STEPS.length - 1 && "flex-1")} aria-current={i === step ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[11.5px] font-medium transition-colors",
                    i < step && "border-success bg-success text-white dark:text-[#04120f]",
                    i === step && "border-brand bg-brand text-brand-fg",
                    i > step && "border-line-strong text-muted",
                  )}
                >
                  {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("truncate text-[12.5px] font-medium", i === step ? "text-fg" : "hidden text-muted md:inline")}>{s}</span>
                {i < WIZARD_STEPS.length - 1 && <span className={cn("h-px min-w-2 flex-1", i < step ? "bg-success" : "bg-line-strong")} />}
              </li>
            ))}
          </ol>
        </div>

        <DialogBody className="min-h-[300px]">
          <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="grid grid-cols-1 gap-4">
            {step === 0 && (
              <>
                <Field label="Start from a SecureKnots Workspace client" optional hint="Prefills the name, product and frameworks from the client's engagement.">
                  <Select
                    ariaLabel="Workspace client"
                    value={source}
                    onValueChange={pickSource}
                    placeholder="Choose a certified client"
                    options={WORKSPACE_CLIENTS.map((c) => ({ value: c.name, label: c.name, hint: c.frameworks.join(", ") }))}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Client name" htmlFor="nt-name">
                    <Input id="nt-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err && name.trim().length < 2} />
                  </Field>
                  <Field label="Product or service" htmlFor="nt-product">
                    <Input id="nt-product" value={product} onChange={(e) => setProduct(e.target.value)} aria-invalid={!!err && product.trim().length < 2} />
                  </Field>
                </div>
                {name.trim().length > 1 && (
                  <p className="text-[12.5px] text-muted">
                    Trust center ID <span className="font-mono text-fg">{slug}</span>
                  </p>
                )}
              </>
            )}

            {step === 1 && (
              <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { id: "Federal", title: "Federal", body: "For FedRAMP 20x clients sharing with agencies.", items: ["Documents and reviewer access", "Certification Package Overview JSON", "REST API with per-agency keys", "6-month access logs and exports"] },
                    { id: "Standard", title: "Standard", body: "For SOC 2, ISO and HIPAA clients sharing with customers.", items: ["Documents and reviewer access", "Custom domain and branding", "NDA and watermarked downloads", "90-day access logs"] },
                  ] as const
                ).map((p) => {
                  const on = plan === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPlan(p.id)}
                      className={cn(
                        "relative rounded-[10px] border p-4 text-left transition-[border-color,box-shadow] duration-150",
                        on ? "border-brand shadow-[0_0_0_3px_var(--ring)]" : "border-line-strong hover:border-[color-mix(in_oklab,var(--line-strong),var(--fg)_15%)]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14.5px] font-semibold text-fg">{p.title}</span>
                        <span className={cn("grid size-5 place-items-center rounded-full border", on ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}>
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted">{p.body}</p>
                      <ul className="mt-3 grid grid-cols-1 gap-1.5">
                        {p.items.map((it) => (
                          <li key={it} className="flex items-start gap-2 text-[12.5px] text-fg">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                            {it}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <>
                <Segmented
                  layoutId="nt-domain-mode"
                  value={domainMode}
                  onChange={setDomainMode}
                  options={[
                    { value: "custom", label: "Client's own domain" },
                    { value: "default", label: "SecureKnots subdomain" },
                  ]}
                />
                {domainMode === "custom" ? (
                  <Field label="Domain" htmlFor="nt-host" hint="The client adds a CNAME record. The domain stays pending until DNS resolves.">
                    <Input
                      id="nt-host"
                      placeholder={`trust.${slug.replace(/-/g, "")}.com`}
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      aria-invalid={!!err}
                      className="font-mono text-[13px]"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                ) : (
                  <div className="rounded-[10px] border border-line bg-raised p-4">
                    <div className="text-[12px] text-muted">Address</div>
                    <div className="mt-0.5 break-all font-mono text-[13.5px] text-fg">{defaultHost}</div>
                    <p className="mt-2 text-[12.5px] text-muted">Works right away with TLS. The client can connect its own domain later in Settings.</p>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-start gap-2.5 rounded-[10px] border border-info/30 bg-info-soft px-3.5 py-3 text-[13px] text-info-fg">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  Only documents approved in SecureKnots Workspace can be published. Drafts and internal notes never leave the Workspace.
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium text-fg">Frameworks to show</div>
                  <div className="flex flex-wrap gap-1.5">
                    {FRAMEWORKS.map((f) => (
                      <Chip key={f} active={frameworks.includes(f)} onClick={() => toggle(frameworks, setFrameworks, f)}>
                        {frameworks.includes(f) && <Check />}
                        {f}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium text-fg">Import from Workspace</div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {DOC_TYPES.map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border border-line p-3 transition-colors hover:bg-raised">
                          <Checkbox checked={docTypes.includes(d.id)} onCheckedChange={() => toggle(docTypes, setDocTypes, d.id)} className="mt-0.5" aria-label={d.label} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-fg">{d.label}</span>
                            <span className="block text-[12px] text-muted">{d.hint}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {step === 4 && (
              <div className="rounded-[10px] border border-line p-4">
                <Meta
                  items={[
                    { label: "Client", value: name.trim() },
                    { label: "Product", value: product.trim() },
                    { label: "Plan", value: plan },
                    { label: "Domain", value: <span className="font-mono text-[13px]">{domain}</span> },
                    { label: "Frameworks", value: frameworks.join(", ") },
                    { label: "Import", value: DOC_TYPES.filter((d) => docTypes.includes(d.id)).map((d) => d.label).join(", ") },
                  ]}
                />
                <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted">
                  The trust center starts in Setup. It goes live when the first documents are published and {domainMode === "custom" ? "the domain is verified" : "the client approves the page"}.
                </p>
              </div>
            )}

            {err && (
              <p className="text-[12.5px] text-danger-fg" role="alert">
                {err}
              </p>
            )}
          </motion.div>
        </DialogBody>

        <DialogFooter>
          <span className="mr-auto hidden text-[12px] text-muted sm:inline">
            Step {step + 1} of {WIZARD_STEPS.length}
          </span>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
          )}
          {step < 4 ? (
            <Button variant="primary" onClick={next}>
              Continue
              <ArrowRight />
            </Button>
          ) : (
            <Button variant="primary" onClick={create}>
              Create trust center
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
