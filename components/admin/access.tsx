"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Ban, Check, CircleSlash, Clock3, Download, Ellipsis, FileSignature, Plus, RotateCw, Server, ShieldCheck, Trash2, UserRound, Zap } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/kit/bits";
import { DataTable } from "@/components/kit/data-table";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Avatar, Card } from "@/components/ui/display";
import { Segmented, Select, Switch, Tabs } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { LENGTH_LABEL, effectiveStatus, matchRule, useTrust } from "@/lib/store";
import { useQueryParam } from "@/lib/ui";
import type { AccessLength, AccessRequest, NdaRecord, RequestStatus, Reviewer, Rule } from "@/lib/types";
import { cn, domainMatches, downloadText, emailDomain, fmt, nowMs } from "@/lib/utils";
import { NDA_TEXT } from "@/lib/mock/seed-v3";
import { PageSkeleton, ReviewerStatusBadge, agencyName, agencyShort, reviewerOrg } from "./common";

type Tab = "requests" | "rules" | "inventory" | "nda";

export function AdminAccess() {
  const ready = useReady();
  const param = useQueryParam("tab");
  const q = useQueryParam("q");
  const status = useQueryParam("status");
  if (!ready) return <PageSkeleton stats={0} />;
  return <AccessBody initialTab={(param as Tab) ?? "requests"} initialQ={q ?? ""} initialStatus={(status as RequestStatus) ?? "pending"} />;
}

function AccessBody({ initialTab, initialQ, initialStatus }: { initialTab: Tab; initialQ: string; initialStatus: RequestStatus }) {
  const [tab, setTab] = React.useState<Tab>(["requests", "rules", "inventory", "nda"].includes(initialTab) ? initialTab : "requests");
  const requests = useTrust((s) => s.requests);
  const reviewers = useTrust((s) => s.reviewers);
  const rules = useTrust((s) => s.rules);
  const pending = requests.filter((r) => r.status === "pending").length;
  const ndaRecords = useTrust((s) => s.ndaRecords);
  const ndaCount = ndaRecords.filter((n) => n.status === "active").length;
  const active = reviewers.filter((r) => effectiveStatus(r) === "active").length;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        title="Access"
        description="Who can open Northwind's restricted documents, how they got access, and when it ends."
      />
      <Tabs
        layoutId="access-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "requests", label: "Requests", count: pending || undefined },
          { value: "rules", label: "Auto-approval rules", count: rules.filter((r) => r.enabled).length },
          { value: "inventory", label: "Reviewer inventory", count: active },
          { value: "nda", label: "NDA records", count: ndaCount },
        ]}
      />
      <div className="pt-5">
        {tab === "requests" && <Requests initialStatus={initialStatus} />}
        {tab === "rules" && <Rules />}
        {tab === "inventory" && <Inventory initialQ={initialQ} />}
        {tab === "nda" && <NdaRecords />}
      </div>
    </motion.div>
  );
}

/* ───────── Requests ───────── */
function Requests({ initialStatus }: { initialStatus: RequestStatus }) {
  const requests = useTrust((s) => s.requests);
  const [status, setStatus] = React.useState<RequestStatus>(["pending", "approved", "denied"].includes(initialStatus) ? initialStatus : "pending");
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    denied: requests.filter((r) => r.status === "denied").length,
  };
  const list = requests.filter((r) => r.status === status);
  return (
    <div>
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          layoutId="req-status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "denied", label: "Denied", count: counts.denied },
          ]}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((r) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <RequestCard r={r} />
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && (
          <Card>
            <EmptyState
              compact
              title={status === "pending" ? "Nothing waiting" : status === "approved" ? "No approved requests" : "No denied requests"}
              body={status === "pending" ? "New requests from the trust page appear here. Agency domains on your allowlist skip this queue." : undefined}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function RequestCard({ r }: { r: AccessRequest }) {
  const rules = useTrust((s) => s.rules);
  const docs = useTrust((s) => s.documents);
  const approve = useTrust((s) => s.approveRequest);
  const deny = useTrust((s) => s.denyRequest);
  const patch = useTrust((s) => s.patch);
  const [length, setLength] = React.useState<AccessLength>("90d");
  const [denyOpen, setDenyOpen] = React.useState(false);
  const domain = emailDomain(r.email);
  const rule = matchRule(rules, r.email);

  const snapshot = () => {
    const s = useTrust.getState();
    return { requests: s.requests, reviewers: s.reviewers };
  };

  const onApprove = () => {
    const prev = snapshot();
    approve(r.id, length);
    toast.success(`Approved ${r.name}`, {
      description: `${LENGTH_LABEL[length]}. A sign-in link is on its way to ${r.email}.`,
      action: { label: "Undo", onClick: () => patch(prev) },
    });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <Avatar name={r.name} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14.5px] font-semibold text-fg">{r.name}</span>
              <span className="text-[13px] text-muted">{r.organization}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
              <span className="font-mono text-[12px] text-fg/80">{r.email}</span>
              <span aria-hidden>·</span>
              <span>Requested {fmt.ago(r.submittedAt)}</span>
            </div>
            <p className="mt-2.5 max-w-3xl border-l-2 border-line-strong pl-3 text-[13.5px] leading-relaxed text-fg/90">{r.purpose}</p>
            {r.docIds && r.docIds.length > 0 && (
              <div className="mt-3">
                <div className="text-[12px] text-muted">Asked for {r.docIds.length} {r.docIds.length === 1 ? "document" : "documents"}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.docIds.map((id) => (
                    <span key={id} className="inline-flex h-6 items-center rounded-full border border-line-strong px-2 text-[12px] text-fg/85">
                      {docs.find((d) => d.id === id)?.title ?? id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {r.nda ? (
                <Badge tone="success">
                  <FileSignature /> NDA accepted
                </Badge>
              ) : (
                <Badge tone="warning">
                  <FileSignature /> No NDA
                </Badge>
              )}
              {r.status === "pending" &&
                (rule ? (
                  <Badge tone="info">
                    <Zap /> Matches {rule.domain} now
                  </Badge>
                ) : (
                  <Badge tone="neutral" outline>
                    No rule for {domain}
                  </Badge>
                ))}
              {r.auto && (
                <Badge tone="brand">
                  <Zap /> Auto-approved
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[240px] lg:items-end">
          {r.status === "pending" ? (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="danger-ghost" size="sm" onClick={() => setDenyOpen(true)}>
                <Ban /> Deny
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="primary" size="sm">
                    <Check /> Approve
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="text-[13px] font-semibold text-fg">Approve {r.name.split(" ")[0]}</div>
                  <p className="mt-0.5 text-[12.5px] text-muted">How long should access last?</p>
                  <div className="mt-3 grid grid-cols-1 gap-1" role="radiogroup">
                    {(Object.keys(LENGTH_LABEL) as AccessLength[]).map((k) => (
                      <button
                        key={k}
                        role="radio"
                        aria-checked={length === k}
                        onClick={() => setLength(k)}
                        className={cn(
                          "flex items-center justify-between rounded-[8px] border px-3 py-2 text-left text-[13px] transition-colors",
                          length === k ? "border-brand bg-brand-soft text-fg" : "border-line hover:bg-subtle",
                        )}
                      >
                        <span>
                          {LENGTH_LABEL[k]}
                          {k === "continuing" && <span className="block text-[11.5px] text-muted">Reviewed every 90 days</span>}
                          {k !== "continuing" && <span className="block text-[11.5px] text-muted">Until {fmt.date(new Date(nowMs() + (k === "30d" ? 30 : k === "90d" ? 90 : 365) * 86400000).toISOString())}</span>}
                        </span>
                        {length === k && <Check className="size-4 text-brand-ink" />}
                      </button>
                    ))}
                  </div>
                  <PopoverClose asChild>
                    <Button variant="primary" size="sm" className="mt-3 w-full" onClick={onApprove}>
                      Approve and send sign-in link
                    </Button>
                  </PopoverClose>
                </PopoverContent>
              </Popover>
            </div>
          ) : r.status === "approved" ? (
            <div className="text-[12.5px] text-muted lg:text-right">
              <Badge tone="success" dot>
                Approved
              </Badge>
              <div className="mt-1.5">
                {r.decidedBy} · {r.decidedAt && fmt.date(r.decidedAt)}
              </div>
              <div>{r.expiresAt === null ? "Continuing access" : r.expiresAt ? `Until ${fmt.date(r.expiresAt)}` : ""}</div>
            </div>
          ) : (
            <div className="text-[12.5px] text-muted lg:max-w-[240px] lg:text-right">
              <Badge tone="danger" dot>
                Denied
              </Badge>
              <div className="mt-1.5">
                {r.decidedBy} · {r.decidedAt && fmt.date(r.decidedAt)}
              </div>
              {r.reason && <div className="mt-1 text-fg/80">{r.reason}</div>}
            </div>
          )}
        </div>
      </div>
      <DenyDialog
        open={denyOpen}
        onOpenChange={setDenyOpen}
        name={r.name}
        onDeny={(reason) => {
          const prev = snapshot();
          deny(r.id, reason);
          toast(`Denied ${r.name}`, { description: "They'll get an email with your reason.", action: { label: "Undo", onClick: () => patch(prev) } });
        }}
      />
    </Card>
  );
}

const QUICK_REASONS = [
  "Use your work email address and request again.",
  "Restricted documents are shared with agencies, their assessors and integrators working on an agency review.",
  "We couldn't confirm your organization. Reply with your agency sponsor's name.",
];

function DenyDialog({ open, onOpenChange, name, onDeny }: { open: boolean; onOpenChange: (v: boolean) => void; name: string; onDeny: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const ok = reason.trim().length >= 8;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v)
          setTimeout(() => {
            setReason("");
            setTouched(false);
          }, 200);
      }}
    >
      <DialogContent size="md">
        <DialogHeader title={`Deny ${name}'s request`} description="The reason is emailed to them, so keep it short and specific." />
        <DialogBody className="grid grid-cols-1 gap-3">
          <Field label="Reason" htmlFor="deny-reason" error={touched && !ok ? "A reason is required." : undefined}>
            <Textarea id="deny-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !ok} />
          </Field>
          <div className="grid grid-cols-1 gap-1.5">
            <span className="text-[12px] text-muted">Common reasons</span>
            {QUICK_REASONS.map((q) => (
              <button key={q} type="button" onClick={() => setReason(q)} className="rounded-[8px] border border-line px-3 py-2 text-left text-[12.5px] text-fg/85 transition-colors hover:bg-subtle">
                {q}
              </button>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setTouched(true);
              if (!ok) return;
              onDeny(reason.trim());
              onOpenChange(false);
            }}
          >
            Deny request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Auto-approval rules ───────── */
const DOMAIN_RE = /^(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$|^\*\.[a-z]{2,}$/;

function Rules() {
  const rules = useTrust((s) => s.rules);
  const requests = useTrust((s) => s.requests);
  const addRule = useTrust((s) => s.addRule);
  const updateRule = useTrust((s) => s.updateRule);
  const removeRule = useTrust((s) => s.removeRule);
  const patch = useTrust((s) => s.patch);
  const [domain, setDomain] = React.useState("");
  const [access, setAccess] = React.useState<AccessLength>("90d");
  const [scope, setScope] = React.useState<Rule["scope"]>("all");
  const [touched, setTouched] = React.useState(false);
  const [test, setTest] = React.useState("");
  const d = domain.trim().toLowerCase();
  const valid = DOMAIN_RE.test(d) && !rules.some((r) => r.domain === d);
  const testRule = test.includes("@") ? matchRule(rules, test) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[14px] font-semibold text-fg">Domain allowlist</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Requests from these domains are approved without waiting for you. <span className="font-mono text-[12px]">*.gov</span> matches any .gov address, such as{" "}
            <span className="font-mono text-[12px]">ofsa.gov</span>.
          </p>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {rules.map((r) => {
              const matches = requests.filter((x) => domainMatches(r.domain, emailDomain(x.email))).length;
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-b border-line last:border-0"
                >
                  <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5", !r.enabled && "opacity-60")}>
                    <div className="min-w-0 flex-1 basis-[220px]">
                      <div className="font-mono text-[13.5px] font-medium text-fg">{r.domain}</div>
                      <div className="text-[12px] text-muted">
                        {r.note ? `${r.note} · ` : ""}Added by {r.createdBy}, {fmt.date(r.createdAt)}
                      </div>
                    </div>
                    <div className="text-[12.5px] text-muted">
                      <div className="text-fg">{LENGTH_LABEL[r.access]}</div>
                      <div>{r.scope === "all" ? "All restricted documents" : "Certification package only"}</div>
                    </div>
                    <div className="w-24 text-[12.5px] text-muted">
                      <span className="font-medium text-fg">{matches}</span> {matches === 1 ? "request" : "requests"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={r.enabled}
                        aria-label={`${r.enabled ? "Pause" : "Enable"} rule ${r.domain}`}
                        onCheckedChange={(v) => {
                          updateRule(r.id, { enabled: v });
                          toast.success(`${r.domain} ${v ? "enabled" : "paused"}`, { description: v ? "Matching requests are approved automatically." : "Matching requests now wait for review." });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete rule ${r.domain}`}
                        className="ml-1"
                        onClick={() => {
                          const prev = useTrust.getState().rules;
                          removeRule(r.id);
                          toast(`Removed ${r.domain}`, { action: { label: "Undo", onClick: () => patch({ rules: prev }) } });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        <form
          className="grid gap-3 border-t border-line bg-raised px-4 py-4 dark:bg-transparent sm:grid-cols-[1fr_150px_190px_auto] sm:items-start sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!valid) return;
            addRule({ domain: d, access, scope, enabled: true });
            toast.success(`Added ${d}`, { description: "New requests from this domain are approved automatically." });
            setDomain("");
            setTouched(false);
          }}
        >
          <div>
            <Input placeholder="agency.gov or *.gov" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain" className="font-mono" aria-invalid={touched && !valid} />
            {touched && !valid && <p className="mt-1 text-[12px] text-danger-fg">{rules.some((r) => r.domain === d) ? "That domain is already on the list." : "Enter a domain like agency.gov or *.gov"}</p>}
          </div>
          <Select ariaLabel="Access length" value={access} onValueChange={(v) => setAccess(v as AccessLength)} options={(Object.keys(LENGTH_LABEL) as AccessLength[]).map((k) => ({ value: k, label: LENGTH_LABEL[k] }))} />
          <Select
            ariaLabel="Documents"
            value={scope}
            onValueChange={(v) => setScope(v as Rule["scope"])}
            options={[
              { value: "all", label: "All restricted documents" },
              { value: "package", label: "Certification package only" },
            ]}
          />
          <Button type="submit" variant="primary">
            <Plus /> Add rule
          </Button>
        </form>
      </Card>

      <Card className="h-fit p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold text-fg">Test an email address</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">See what happens when this person requests access.</p>
        <Input className="mt-3" placeholder="name@agency.gov" value={test} onChange={(e) => setTest(e.target.value)} aria-label="Email to test" />
        <AnimatePresence mode="wait">
          {test.includes("@") && emailDomain(test).includes(".") && (
            <motion.div key={testRule?.id ?? "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
              {testRule ? (
                <div className="rounded-[8px] bg-success-soft p-3 text-[13px] text-success-fg">
                  <div className="flex items-center gap-1.5 font-medium">
                    <BadgeCheck className="size-4" /> Approved automatically
                  </div>
                  <div className="mt-1">
                    Rule <span className="font-mono">{testRule.domain}</span>: {LENGTH_LABEL[testRule.access].toLowerCase()}, {testRule.scope === "all" ? "all restricted documents" : "certification package only"}.
                  </div>
                </div>
              ) : (
                <div className="rounded-[8px] bg-subtle p-3 text-[13px] text-fg/85">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock3 className="size-4" /> Waits for your review
                  </div>
                  <div className="mt-1 text-muted">No enabled rule matches {emailDomain(test)}.</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

/* ───────── Reviewer inventory ───────── */
function Inventory({ initialQ }: { initialQ: string }) {
  const reviewers = useTrust((s) => s.reviewers);
  const revoke = useTrust((s) => s.revokeReviewer);
  const extend = useTrust((s) => s.extendReviewer);
  const patch = useTrust((s) => s.patch);
  const [q, setQ] = React.useState(initialQ);
  const [kind, setKind] = React.useState<"all" | "person" | "system">("all");
  const [status, setStatus] = React.useState<"all" | "active" | "soon" | "inactive">("all");

  const soon = (r: Reviewer) => effectiveStatus(r) === "active" && !!r.expiresAt && new Date(r.expiresAt).getTime() - nowMs() < 14 * 86400000;
  const data = React.useMemo(
    () =>
      reviewers.filter((r) => {
        if (kind !== "all" && r.kind !== kind) return false;
        const st = effectiveStatus(r);
        if (status === "active" && st !== "active") return false;
        if (status === "soon" && !soon(r)) return false;
        if (status === "inactive" && st === "active") return false;
        return true;
      }),
    [reviewers, kind, status],
  );

  const doRevoke = React.useCallback(
    (r: Reviewer) => {
      const prev = useTrust.getState().reviewers;
      revoke(r.id);
      toast(`Revoked ${r.name}`, { description: "Their sign-in links and API access stop working now.", action: { label: "Undo", onClick: () => patch({ reviewers: prev }) } });
    },
    [revoke, patch],
  );

  const columns = React.useMemo<ColumnDef<Reviewer, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Reviewer",
        accessorFn: (r) => `${r.name} ${r.handle} ${agencyName(r.agencyId)}`,
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={r.name} size={28} square={r.kind === "system"} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate font-medium text-fg">
                  {r.kind === "system" ? <Server className="size-3.5 shrink-0 text-muted" /> : <UserRound className="size-3.5 shrink-0 text-muted" />}
                  <span className="truncate">{r.name}</span>
                </div>
                <div className="truncate font-mono text-[11.5px] text-muted">{r.handle}</div>
              </div>
            </div>
          );
        },
        meta: { className: "max-w-[300px]" },
      },
      { id: "agency", header: "Agency", accessorFn: (r) => (r.agencyId === "other" ? reviewerOrg(r) : agencyShort(r.agencyId)), cell: ({ row }) => <span title={reviewerOrg(row.original)} className="block max-w-[160px] truncate">{row.original.agencyId === "other" ? reviewerOrg(row.original) : agencyShort(row.original.agencyId)}</span> },
      {
        id: "access",
        header: "Access",
        accessorFn: (r) => r.channel,
        cell: ({ row }) => (
          <div className="text-[12.5px]">
            <div className="text-fg">{row.original.channel === "api" ? "API key" : "Web sign-in"}</div>
            <div className="text-muted">{row.original.scope === "all" ? "All restricted" : "Package only"}</div>
          </div>
        ),
        meta: { hideBelow: "md" },
      },
      {
        id: "granted",
        header: "Granted",
        accessorFn: (r) => r.grantedAt,
        cell: ({ row }) => (
          <div className="text-[12.5px]">
            <div className="text-fg">{fmt.date(row.original.grantedAt)}</div>
            <div className="truncate text-muted">{row.original.grantedBy}</div>
          </div>
        ),
        meta: { hideBelow: "lg" },
      },
      {
        id: "expires",
        header: "Expires",
        accessorFn: (r) => r.expiresAt ?? "9999",
        cell: ({ row }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{row.original.expiresAt ? fmt.date(row.original.expiresAt) : "Continuing"}</span>,
      },
      {
        id: "last",
        header: "Last access",
        accessorFn: (r) => r.lastAccessAt ?? "",
        cell: ({ row }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{row.original.lastAccessAt ? fmt.ago(row.original.lastAccessAt) : "Never"}</span>,
        meta: { hideBelow: "md" },
      },
      { id: "status", header: "Status", accessorFn: (r) => effectiveStatus(r), cell: ({ row }) => <ReviewerStatusBadge r={row.original} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const st = effectiveStatus(r);
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${r.name}`}>
                  <Ellipsis />
                </Button>
              </MenuTrigger>
              <MenuContent className="w-56">
                <MenuLabel>{st === "active" ? "Extend access" : "Restore access"}</MenuLabel>
                {(Object.keys(LENGTH_LABEL) as AccessLength[]).map((k) => (
                  <MenuItem
                    key={k}
                    onSelect={() => {
                      extend(r.id, k);
                      toast.success(`${r.name}: ${LENGTH_LABEL[k].toLowerCase()} from today`);
                    }}
                  >
                    <Clock3 /> {LENGTH_LABEL[k]}
                  </MenuItem>
                ))}
                {st === "active" && (
                  <>
                    <MenuSeparator />
                    <MenuItem danger onSelect={() => doRevoke(r)}>
                      <CircleSlash /> Revoke access
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          );
        },
        meta: { className: "w-10 text-right" },
      },
    ],
    [extend, doRevoke],
  );

  const people = reviewers.filter((r) => r.kind === "person" && effectiveStatus(r) === "active").length;
  const systems = reviewers.filter((r) => r.kind === "system" && effectiveStatus(r) === "active").length;

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        <Stat label="People with access" value={people} icon={<UserRound />} />
        <Stat label="Agency systems" value={systems} icon={<Server />} />
        <Stat label="Expiring in 14 days" value={reviewers.filter(soon).length} icon={<Clock3 />} />
      </div>
      <DataTable
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search name, email or agency"
        initialSorting={[{ id: "last", desc: true }]}
        rowClassName={(r) => cn(effectiveStatus(r) !== "active" && "opacity-70")}
        filters={
          <>
            <Chip active={kind === "all"} onClick={() => setKind("all")}>All</Chip>
            <Chip active={kind === "person"} onClick={() => setKind("person")}><UserRound /> People</Chip>
            <Chip active={kind === "system"} onClick={() => setKind("system")}><Server /> Systems</Chip>
            <span className="mx-1 h-4 w-px shrink-0 bg-line-strong" />
            <Chip active={status === "active"} onClick={() => setStatus(status === "active" ? "all" : "active")}><ShieldCheck /> Active</Chip>
            <Chip active={status === "soon"} onClick={() => setStatus(status === "soon" ? "all" : "soon")}><Clock3 /> Expiring soon</Chip>
            <Chip active={status === "inactive"} onClick={() => setStatus(status === "inactive" ? "all" : "inactive")}><CircleSlash /> Expired or revoked</Chip>
          </>
        }
        empty={<EmptyState compact title="No reviewers match" body="Change the filters or search." />}
      />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-[9px] bg-subtle text-muted [&_svg]:size-4">{icon}</span>
      <div>
        <div className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-fg">{value}</div>
        <div className="mt-1 text-[12.5px] text-muted">{label}</div>
      </div>
    </div>
  );
}

/* ───────── NDA records ───────── */
function signedCopy(r: NdaRecord) {
  return [
    "NORTHWIND CLOUD, INC.",
    "Non-disclosure terms for restricted trust center documents",
    `Version ${r.version}`,
    "",
    NDA_TEXT,
    "",
    "---",
    "Signed electronically by typing their full name",
    `Signature: ${r.signature}`,
    `Name: ${r.name}`,
    `Email: ${r.email}`,
    `Organization: ${r.organization}`,
    `Signed at: ${new Date(r.signedAt).toISOString()}`,
    `IP address: ${r.ip}`,
    `Record ID: ${r.id}`,
    "",
  ].join("\n");
}

function NdaRecords() {
  const records = useTrust((s) => s.ndaRecords);
  const version = useTrust((s) => s.security.ndaVersion);
  const setSecurity = useTrust((s) => s.setSecurity);
  const addAudit = useTrust((s) => s.addAudit);
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"active" | "outdated" | "all">("active");
  const [bumpOpen, setBumpOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const outdated = React.useMemo(() => records.filter((r) => r.status === "active" && r.version !== version), [records, version]);
  const data = React.useMemo(
    () => records.filter((r) => (filter === "all" ? true : filter === "outdated" ? r.status === "active" && r.version !== version : r.status === "active")),
    [records, filter, version],
  );
  const [year, num] = version.split(".");
  const nextVersion = `${year}.${Number(num ?? 0) + 1}`;

  const columns = React.useMemo<ColumnDef<NdaRecord, unknown>[]>(
    () => [
      {
        id: "signer",
        header: "Signer",
        accessorFn: (r) => `${r.name} ${r.email} ${r.organization}`,
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={row.original.name} size={28} />
            <div className="min-w-0">
              <div className="truncate font-medium text-fg">{row.original.name}</div>
              <div className="truncate text-[12px] text-muted">{row.original.organization}</div>
            </div>
          </div>
        ),
        meta: { className: "max-w-[260px]" },
      },
      {
        id: "signature",
        header: "Signature",
        accessorFn: (r) => r.signature,
        cell: ({ getValue }) => <span className="font-serif text-[18px] italic leading-none text-fg">{String(getValue())}</span>,
        meta: { hideBelow: "md" },
      },
      {
        id: "version",
        header: "Version",
        accessorFn: (r) => r.version,
        cell: ({ row }) =>
          row.original.version === version ? <Badge tone="success">{row.original.version}</Badge> : <Badge tone="warning">{row.original.version}, outdated</Badge>,
      },
      {
        id: "signed",
        header: "Signed",
        accessorFn: (r) => r.signedAt,
        cell: ({ getValue }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{fmt.dateTime(String(getValue()))}</span>,
      },
      {
        id: "ip",
        header: "IP address",
        accessorFn: (r) => r.ip,
        cell: ({ getValue }) => <span className="font-mono text-[12px] text-muted">{String(getValue())}</span>,
        meta: { hideBelow: "lg" },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${r.name}`}>
                  <Ellipsis />
                </Button>
              </MenuTrigger>
              <MenuContent className="w-60">
                <MenuItem onSelect={() => downloadText(`nda-${r.version}-${r.email}.txt`, signedCopy(r))}>
                  <Download /> Download signed copy
                </MenuItem>
                {r.version !== version && (
                  <MenuItem
                    onSelect={() => {
                      addAudit({ action: "Asked to re-sign NDA", target: r.email, detail: `Version ${version}`, category: "access" });
                      toast.success(`Re-sign request sent to ${r.email}`, { description: `They sign version ${version} at their next sign-in.` });
                    }}
                  >
                    <RotateCw /> Ask to re-sign {version}
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          );
        },
        meta: { className: "w-10 text-right" },
      },
    ],
    [version, addAudit],
  );

  const active = records.filter((r) => r.status === "active");

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        <Stat label="Signed NDAs on record" value={active.length} icon={<FileSignature />} />
        <Stat label={`On the current version (${version})`} value={active.filter((r) => r.version === version).length} icon={<BadgeCheck />} />
        <Stat label="Signed an older version" value={outdated.length} icon={<RotateCw />} />
      </div>
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg">Click-wrap NDA, version {version}</div>
          <p className="mt-0.5 text-[13px] text-muted">
            Requesters read the terms and sign by typing their full name. Each signature is stored with the time, IP address and the request it belongs to.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadText(`northwind-nda-${version}.txt`, NDA_TEXT)}>
            <Download /> Terms
          </Button>
          <Button size="sm" variant="primary" onClick={() => setBumpOpen(true)}>
            Publish new version
          </Button>
        </div>
      </Card>
      <DataTable
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search signer, email or organization"
        initialSorting={[{ id: "signed", desc: true }]}
        filters={
          <>
            <Chip active={filter === "active"} onClick={() => setFilter("active")}>
              Current records
            </Chip>
            <Chip active={filter === "outdated"} onClick={() => setFilter("outdated")}>
              Older version <span className="opacity-60">{outdated.length}</span>
            </Chip>
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              All, including superseded
            </Chip>
          </>
        }
        empty={<EmptyState compact title="No NDA records" body="Signatures appear here when people request access from the trust page." />}
      />
      <Dialog open={bumpOpen} onOpenChange={setBumpOpen}>
        <DialogContent>
          <DialogHeader
            title={`Publish NDA version ${nextVersion}`}
            description="New requesters sign the new version. Existing reviewers re-sign at their next sign-in; their access continues meanwhile."
          />
          <DialogBody className="grid grid-cols-1 gap-3">
            <Field label="What changed" htmlFor="nda-note">
              <Textarea id="nda-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: added a clause on AI tools and restricted documents" />
            </Field>
            <p className="text-[12.5px] text-muted">{active.length} reviewers will be asked to re-sign.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBumpOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={note.trim().length < 5}
              onClick={() => {
                setSecurity({ ndaVersion: nextVersion });
                addAudit({ action: "Published NDA version", target: nextVersion, detail: note.trim(), category: "access" });
                setBumpOpen(false);
                setNote("");
                setFilter("outdated");
                toast.success(`NDA ${nextVersion} published`, { description: "Reviewers re-sign at their next sign-in." });
              }}
            >
              Publish {nextVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
