"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowRight, Download, Link2, LoaderCircle, LogIn, Settings2, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { CopyButton, EmptyState, PageHeader } from "@/components/kit/bits";
import { DataTable } from "@/components/kit/data-table";
import { StatCard } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Avatar, Card, Meta, ProgressBar } from "@/components/ui/display";
import { Segmented, Select } from "@/components/ui/controls";
import { Sheet, SheetBody, SheetContent, SheetHeader } from "@/components/ui/dialog";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";
import { DAY, cn, downloadText, fakeHash, fmt, nowMs, sleep } from "@/lib/utils";
import { PageSkeleton } from "./common";

type Category = AuditEntry["category"];

const CATEGORY: Record<Category, { label: string; tone: Tone }> = {
  access: { label: "Access", tone: "brand" },
  documents: { label: "Documents", tone: "info" },
  package: { label: "Package", tone: "review" },
  settings: { label: "Settings", tone: "neutral" },
  keys: { label: "API keys", tone: "warning" },
  "sign-in": { label: "Sign-in", tone: "neutral" },
  updates: { label: "Updates and Q&A", tone: "success" },
  integrations: { label: "Integrations", tone: "review" },
};

type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90, all: Infinity };

/** Mock chain: each entry's hash covers its own fields plus the previous entry's hash. */
function chainOf(entries: AuditEntry[]) {
  const oldestFirst = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const map = new Map<string, { hash: string; prev: string }>();
  let prev = "0".repeat(64);
  for (const e of oldestFirst) {
    const hash = fakeHash(`${prev}|${e.id}|${e.at}|${e.actor}|${e.action}|${e.target}`);
    map.set(e.id, { hash, prev });
    prev = hash;
  }
  return map;
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function AdminAudit() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <Body />;
}

function Body() {
  const audit = useTrust((s) => s.audit);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | Category>("all");
  const [actor, setActor] = React.useState("all");
  const [range, setRange] = React.useState<Range>("all");
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);

  const sorted = React.useMemo(() => [...audit].sort((a, b) => b.at.localeCompare(a.at)), [audit]);
  const chain = React.useMemo(() => chainOf(audit), [audit]);
  const actors = React.useMemo(() => [...new Set(audit.map((a) => a.actor))].sort(), [audit]);

  const stats = React.useMemo(() => {
    const cutoff = nowMs() - 30 * DAY;
    const recent = audit.filter((a) => new Date(a.at).getTime() >= cutoff);
    return {
      total: recent.length,
      signIns: recent.filter((a) => a.category === "sign-in").length,
      access: recent.filter((a) => a.category === "access").length,
      settings: recent.filter((a) => a.category === "settings" || a.category === "keys" || a.category === "integrations").length,
      people: new Set(recent.filter((a) => a.actor !== "System" && a.actor !== "SecureKnots Workspace").map((a) => a.actor)).size,
    };
  }, [audit]);

  const data = React.useMemo(() => {
    const cutoff = range === "all" ? -Infinity : nowMs() - RANGE_DAYS[range] * DAY;
    return sorted.filter((a) => (cat === "all" || a.category === cat) && (actor === "all" || a.actor === actor) && new Date(a.at).getTime() >= cutoff);
  }, [sorted, cat, actor, range]);

  const counts = React.useMemo(() => {
    const c = {} as Record<Category, number>;
    audit.forEach((a) => (c[a.category] = (c[a.category] ?? 0) + 1));
    return c;
  }, [audit]);

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        id: "at",
        header: "Time",
        accessorFn: (a) => a.at,
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-[12.5px]">
            <div className="text-fg">{fmt.day(row.original.at)}</div>
            <div className="text-muted">{fmt.ago(row.original.at)}</div>
          </div>
        ),
      },
      {
        id: "actor",
        header: "Who",
        accessorFn: (a) => a.actor,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.original.actor} size={24} square={row.original.actor === "System" || row.original.actor === "SecureKnots Workspace"} />
            <span className="truncate font-medium text-fg">{row.original.actor}</span>
          </div>
        ),
        meta: { className: "max-w-[200px]" },
      },
      {
        id: "action",
        header: "Action",
        accessorFn: (a) => `${a.action} ${a.target} ${a.detail ?? ""}`,
        sortingFn: (a, b) => a.original.action.localeCompare(b.original.action),
        cell: ({ row }) => (
          <div className="min-w-0 text-[13px]">
            <span className="text-muted">{row.original.action}</span> <span className="font-medium text-fg">{row.original.target}</span>
          </div>
        ),
        meta: { className: "max-w-[340px]" },
      },
      {
        id: "detail",
        header: "Detail",
        accessorFn: (a) => a.detail ?? "",
        enableSorting: false,
        cell: ({ getValue }) => <span className="block max-w-[260px] truncate text-[12.5px] text-muted">{String(getValue()) || "—"}</span>,
        meta: { hideBelow: "lg" },
      },
      {
        id: "category",
        header: "Area",
        accessorFn: (a) => a.category,
        cell: ({ row }) => <Badge tone={CATEGORY[row.original.category].tone}>{CATEGORY[row.original.category].label}</Badge>,
        meta: { hideBelow: "md" },
      },
      {
        id: "ip",
        header: "IP address",
        accessorFn: (a) => a.ip,
        enableSorting: false,
        cell: ({ getValue }) => <span className="font-mono text-[12px] text-muted">{String(getValue())}</span>,
        meta: { hideBelow: "lg" },
      },
    ],
    [],
  );

  const exportCsv = () => {
    const rows = [["Time (UTC)", "Who", "Action", "Target", "Detail", "Area", "IP address", "Entry hash"].map(csvCell).join(",")];
    data.forEach((a) => rows.push([a.at, a.actor, a.action, a.target, a.detail ?? "", CATEGORY[a.category].label, a.ip, chain.get(a.id)?.hash ?? ""].map(csvCell).join(",")));
    downloadText("northwind-trust-audit-trail.csv", rows.join("\n"), "text/csv");
    toast.success("Audit trail exported", { description: `${data.length} entries with their chain hashes, CSV` });
  };

  const clear = () => {
    setQ("");
    setCat("all");
    setActor("all");
    setRange("all");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Workspace"
        title="Audit trail"
        description={
          <>
            Every change an admin makes in this trust center: access decisions, documents, the package, settings, keys and sign-ins. Reviewer views and downloads are kept separately in{" "}
            <Link href="/admin/logs" className="font-medium text-fg underline underline-offset-4 hover:text-brand-ink">
              Access logs
            </Link>
            .
          </>
        }
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Admin actions" value={String(stats.total)} footer={`Last 30 days, by ${stats.people} ${stats.people === 1 ? "person" : "people"} and automations`} icon={<Wrench />} />
        <StatCard label="Sign-ins" value={String(stats.signIns)} footer="All with multi-factor authentication" icon={<LogIn />} />
        <StatCard label="Access decisions" value={String(stats.access)} footer="Approvals, denials, rules and revocations" icon={<UsersRound />} />
        <StatCard label="Settings and keys" value={String(stats.settings)} footer="Settings, API keys and integrations" icon={<Settings2 />} />
      </div>

      <ChainCard count={audit.length} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          layoutId="audit-range"
          value={range}
          onChange={setRange}
          options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
            { value: "all", label: "All time" },
          ]}
        />
        <Select
          size="sm"
          ariaLabel="Who"
          className="w-[190px]"
          value={actor}
          onValueChange={setActor}
          options={[{ value: "all", label: "Everyone" }, ...actors.map((a) => ({ value: a, label: a }))]}
        />
      </div>

      <div className="mt-3">
        <DataTable
          data={data}
          columns={columns}
          getRowId={(a) => a.id}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Search actions, targets or details"
          initialSorting={[{ id: "at", desc: true }]}
          pageSize={25}
          minWidth={720}
          onRowClick={setSelected}
          filters={
            <>
              <Chip active={cat === "all"} onClick={() => setCat("all")}>
                All areas
              </Chip>
              {(Object.keys(CATEGORY) as Category[])
                .filter((c) => counts[c])
                .map((c) => (
                  <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "all" : c)}>
                    {CATEGORY[c].label} <span className="opacity-60">{counts[c]}</span>
                  </Chip>
                ))}
            </>
          }
          empty={
            <EmptyState
              compact
              title="No entries match"
              body="Change the filters or the date range."
              action={
                <Button size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          }
        />
      </div>

      <EntrySheet entry={selected} chain={chain} onClose={() => setSelected(null)} />
    </motion.div>
  );
}

/* ───────── Tamper-evident chain ───────── */

function ChainCard({ count }: { count: number }) {
  const [state, setState] = React.useState<"idle" | "running" | "done">("idle");
  const [checked, setChecked] = React.useState(0);
  const [verifiedAt, setVerifiedAt] = React.useState<string | null>(null);

  const verify = async () => {
    setState("running");
    setChecked(0);
    const step = Math.max(1, Math.ceil(count / 24));
    for (let i = 0; i <= count; i += step) {
      setChecked(Math.min(i, count));
      await sleep(45);
    }
    setChecked(count);
    setVerifiedAt(new Date().toISOString());
    setState("done");
    toast.success(`Chain verified, ${count} entries`, { description: "No entry has been changed or removed." });
  };

  return (
    <Card className="mt-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-subtle text-fg">
          <Link2 className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg">Tamper-evident: each entry is chained to the previous one</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            Every entry carries a SHA-256 hash of its own contents plus the previous entry&apos;s hash, so an edited or deleted entry breaks the chain. Entries cannot be edited from this console.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {state === "done" ? (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Badge tone="success" className="h-7 px-2.5 text-[12.5px]">
                  <ShieldCheck /> Chain verified, {count} entries
                </Badge>
              </motion.div>
            ) : state === "running" ? (
              <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <LoaderCircle className="size-3.5 animate-spin" /> Checking {checked} of {count}
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button variant={state === "done" ? "ghost" : "secondary"} onClick={verify} disabled={state === "running"}>
            <ShieldCheck /> {state === "done" ? "Verify again" : "Verify chain"}
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {state !== "idle" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <ProgressBar value={count ? (checked / count) * 100 : 100} tone={state === "done" ? "success" : "brand"} className="mt-4" label="Chain verification progress" />
            {state === "done" && verifiedAt && <p className="mt-2 text-[12px] text-muted">Verified {fmt.dateTime(verifiedAt)}. The first entry links to the genesis hash.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function EntrySheet({ entry, chain, onClose }: { entry: AuditEntry | null; chain: Map<string, { hash: string; prev: string }>; onClose: () => void }) {
  const link = entry ? chain.get(entry.id) : undefined;
  return (
    <Sheet open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={520}>
        {entry && (
          <>
            <SheetHeader title={`${entry.action}: ${entry.target}`} description={fmt.dateTime(entry.at)}>
              <div className="mt-2">
                <Badge tone={CATEGORY[entry.category].tone}>{CATEGORY[entry.category].label}</Badge>
              </div>
            </SheetHeader>
            <SheetBody className="grid grid-cols-1 content-start gap-5">
              <div className="flex items-center gap-3">
                <Avatar name={entry.actor} size={36} square={entry.actor === "System" || entry.actor === "SecureKnots Workspace"} />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-fg">{entry.actor}</div>
                  <div className="text-[12.5px] text-muted">{entry.actor === "System" || entry.actor === "SecureKnots Workspace" ? "Automated action" : "Admin"}</div>
                </div>
              </div>
              <Meta
                cols={2}
                items={[
                  { label: "Action", value: entry.action },
                  { label: "Target", value: entry.target },
                  { label: "Detail", value: entry.detail ?? "None" },
                  { label: "IP address", value: <span className="font-mono text-[12.5px]">{entry.ip}</span> },
                  { label: "Time (UTC)", value: <span className="font-mono text-[12.5px]">{entry.at.replace("T", " ").slice(0, 19)}</span> },
                  { label: "Entry ID", value: <span className="font-mono text-[12.5px]">{entry.id}</span> },
                ]}
              />
              {link && (
                <div>
                  <div className="mb-2 text-[12px] font-medium text-muted">Chain</div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <HashRow label="Previous hash" value={link.prev} faint />
                    <div className="flex justify-center text-faint">
                      <ArrowDown className="size-4" />
                    </div>
                    <HashRow label="Entry hash" value={link.hash} />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">The entry hash covers the time, actor, action and target, plus the previous hash. Changing any of them changes every hash after it.</p>
                </div>
              )}
              {entry.category === "access" && (
                <Button asChild variant="secondary" size="sm" className="justify-self-start">
                  <Link href="/admin/access">
                    Open Access <ArrowRight />
                  </Link>
                </Button>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HashRow({ label, value, faint }: { label: string; value: string; faint?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-[8px] border border-line px-3 py-2", faint ? "bg-raised" : "bg-surface dark:bg-raised")}>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-muted">{label}</div>
        <div className={cn("truncate font-mono text-[12px]", faint ? "text-muted" : "text-fg")} title={value}>
          {value}
        </div>
      </div>
      <CopyButton value={value} iconOnly label={`Copy ${label.toLowerCase()}`} toastText="Hash copied" />
    </div>
  );
}
