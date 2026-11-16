"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, Download, Eye, FileX, KeyRound, MessagesSquare, Server, UserPlus, UserRound, UsersRound } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Meter } from "@/components/kit/charts";
import { Sparkline, StatCard } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, Card, CardHeader } from "@/components/ui/display";
import { Segmented } from "@/components/ui/controls";
import { Bars3D } from "@/components/kit/charts3d";
import { Sheet, SheetBody, SheetContent, SheetHeader } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { effectiveStatus, useTrust } from "@/lib/store";
import { isDownload, isView } from "@/lib/analytics";
import type { AccessRequest, ApiKey, LogEvent, Questionnaire, Reviewer, TrustDocument } from "@/lib/types";
import { DAY, cn, downloadText, fmt, nowMs } from "@/lib/utils";
import { PageSkeleton, ReviewerStatusBadge, agencyName, agencyShort } from "./common";

type Range = "30d" | "90d" | "6m";
const RANGE_DAYS: Record<Range, number> = { "30d": 30, "90d": 91, "6m": 182 };
const RANGE_LABEL: Record<Range, string> = { "30d": "last 30 days", "90d": "last 90 days", "6m": "last 6 months" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Trust page views are not logged per visit in this demo, so they are estimated from
 *  document-view sessions: each document view comes from roughly 6 page views, plus a
 *  steady base of visitors who read only public sections. Deterministic on purpose. */
function estimatePageViews(docViews: number, days: number) {
  return Math.round(docViews * 6.4 + days * 11);
}

function since(logs: LogEvent[], days: number, now: number) {
  const from = now - days * DAY;
  return logs.filter((e) => new Date(e.at).getTime() >= from);
}

type AgencyRow = {
  agencyId: string;
  name: string;
  short: string;
  events: number;
  people: number;
  systems: number;
  docsViewed: number;
  downloads: number;
  lastActive: string;
  score: number;
};

function agencyRows(logs: LogEvent[], now: number): AgencyRow[] {
  const map = new Map<string, { events: number; people: Set<string>; systems: Set<string>; docs: Set<string>; downloads: number; last: string }>();
  for (const e of logs) {
    if (e.handle === "anonymous") continue;
    const m = map.get(e.agencyId) ?? { events: 0, people: new Set(), systems: new Set(), docs: new Set(), downloads: 0, last: e.at };
    m.events++;
    (e.actorKind === "system" ? m.systems : m.people).add(e.handle);
    if (e.docId && (isView(e) || isDownload(e) || e.action === "api_fetch")) m.docs.add(e.docId);
    if (isDownload(e)) m.downloads++;
    if (e.at > m.last) m.last = e.at;
    map.set(e.agencyId, m);
  }
  const rows = [...map.entries()].map(([id, m]) => ({ id, ...m }));
  const maxEvents = Math.max(1, ...rows.map((r) => r.events));
  const maxDocs = Math.max(1, ...rows.map((r) => r.docs.size));
  return rows
    .map((r) => {
      const recency = Math.max(0, 1 - (now - new Date(r.last).getTime()) / (30 * DAY));
      const score = Math.round(100 * (0.4 * (r.events / maxEvents) + 0.3 * (r.docs.size / maxDocs) + 0.3 * recency));
      return {
        agencyId: r.id,
        name: agencyName(r.id),
        short: agencyShort(r.id),
        events: r.events,
        people: r.people.size,
        systems: r.systems.size,
        docsViewed: r.docs.size,
        downloads: r.downloads,
        lastActive: r.last,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function weekdayIndex(iso: string) {
  return (new Date(iso).getDay() + 6) % 7;
}

export function AdminAnalytics() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <AnalyticsBody />;
}

function AnalyticsBody() {
  const logs = useTrust((s) => s.logs);
  const requests = useTrust((s) => s.requests);
  const reviewers = useTrust((s) => s.reviewers);
  const docs = useTrust((s) => s.documents);
  const subscribers = useTrust((s) => s.subscribers);
  const faqs = useTrust((s) => s.faqs);
  const [range, setRange] = React.useState<Range>("90d");
  const [open, setOpen] = React.useState<string | null>(null);
  const [heatView, setHeatView] = React.useState<"3d" | "grid">("3d");
  const days = RANGE_DAYS[range];

  const data = React.useMemo(() => {
    const now = nowMs();
    const from = now - days * DAY;
    const inRange = since(logs, days, now);
    const docViews = inRange.filter(isView).length;
    const pageViews = estimatePageViews(docViews, days);
    const reqs = requests.filter((r) => new Date(r.submittedAt).getTime() >= from);
    const approved = reqs.filter((r) => r.status === "approved");
    const activeHandles = new Set(inRange.filter((e) => e.handle !== "anonymous" && e.actorKind === "person").map((e) => e.handle));
    const downloaders = new Set(inRange.filter((e) => isDownload(e) && e.handle !== "anonymous").map((e) => e.handle));
    const downloads = inRange.filter(isDownload).length;
    // Cohort funnel: only people whose request falls in the range, so each step is a subset of the one before.
    const approvedEmails = new Set(approved.map((r) => r.email));
    const cohortActive = [...approvedEmails].filter((e) => activeHandles.has(e)).length;
    const cohortDownloaded = [...approvedEmails].filter((e) => downloaders.has(e)).length;
    const funnel = [
      { label: "Trust page views", sub: "Estimated from sessions", value: pageViews, icon: Eye },
      { label: "Access requests", sub: `${reqs.filter((r) => r.auto).length} approved automatically`, value: reqs.length, icon: UserPlus },
      { label: "Approvals", sub: `${reqs.filter((r) => r.status === "denied").length} denied, ${reqs.filter((r) => r.status === "pending").length} pending`, value: approved.length, icon: UsersRound },
      { label: "Signed in and opened documents", sub: `Of those approved; ${activeHandles.size} reviewers active in total`, value: cohortActive, icon: UserRound },
      { label: "Downloaded documents", sub: `Of those approved; ${fmt.num(downloads)} downloads by everyone`, value: cohortDownloaded, icon: Download },
    ];
    const agencies = agencyRows(inRange, now);
    // Most read and never opened
    const reads = new Map<string, number>();
    for (const e of inRange) if (e.docId && (isView(e) || isDownload(e))) reads.set(e.docId, (reads.get(e.docId) ?? 0) + 1);
    const mostRead = [...reads.entries()]
      .map(([id, n]) => ({ doc: docs.find((d) => d.id === id), n }))
      .filter((x): x is { doc: TrustDocument; n: number } => !!x.doc)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
    const last90 = since(logs, 90, now);
    const opened90 = new Set(last90.filter((e) => e.docId && (isView(e) || isDownload(e) || e.action === "api_fetch")).map((e) => e.docId!));
    const lastOpen = new Map<string, string>();
    for (const e of logs) if (e.docId && (isView(e) || isDownload(e)) && (!lastOpen.has(e.docId) || e.at > lastOpen.get(e.docId)!)) lastOpen.set(e.docId, e.at);
    const unopened = docs.filter((d) => !opened90.has(d.id)).map((d) => ({ doc: d, last: lastOpen.get(d.id) }));
    // Weekday heat strip for the top six agencies
    const top = agencies.slice(0, 6);
    const heat = top.map((a) => {
      const row = Array.from({ length: 7 }, () => 0);
      for (const e of inRange) if (e.agencyId === a.agencyId && e.handle !== "anonymous") row[weekdayIndex(e.at)]! += 1;
      return { agency: a, row };
    });
    const heatMax = Math.max(1, ...heat.flatMap((h) => h.row));
    return { funnel, agencies, mostRead, unopened, heat, heatMax, pageViews, reqs, approved, activeHandles };
  }, [logs, requests, docs, days]);

  const faqUses = faqs.reduce((a, f) => a + f.uses, 0);
  const topFaqs = React.useMemo(() => [...faqs].sort((a, b) => b.uses - a.uses).slice(0, 3), [faqs]);
  const confirmed = subscribers.filter((s) => s.status === "confirmed").length;
  const approvalRate = data.reqs.length ? Math.round((data.approved.length / data.reqs.length) * 100) : 0;

  const exportCsv = () => {
    const head = ["Agency", "Events", "People", "Systems", "Documents viewed", "Downloads", "Last active", "Engagement score"];
    const rows = data.agencies.map((a) => [a.name, a.events, a.people, a.systems, a.docsViewed, a.downloads, a.lastActive, a.score]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadText(`agency-engagement-${range}.csv`, csv, "text/csv");
  };

  const columns = React.useMemo<ColumnDef<AgencyRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (a) => a.name,
        header: "Agency",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{row.original.name}</div>
            <div className="text-[11.5px] text-faint">{row.original.short}</div>
          </div>
        ),
        meta: { className: "max-w-[280px]" },
      },
      { accessorKey: "events", header: "Events", cell: ({ getValue }) => fmt.num(getValue() as number), meta: { align: "right" } },
      { accessorKey: "people", header: "People", meta: { align: "right", hideBelow: "md" } },
      { accessorKey: "systems", header: "Systems", meta: { align: "right", hideBelow: "md" } },
      { accessorKey: "docsViewed", header: "Documents", meta: { align: "right", hideBelow: "sm" } },
      { accessorKey: "downloads", header: "Downloads", meta: { align: "right", hideBelow: "lg" } },
      {
        accessorKey: "lastActive",
        header: "Last active",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted">{fmt.ago(String(getValue()))}</span>,
        meta: { hideBelow: "lg" },
      },
      {
        accessorKey: "score",
        header: "Engagement",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Meter value={row.original.score} max={100} className="w-16" />
            <span className="w-7 text-right text-[12.5px] font-medium text-fg">{row.original.score}</span>
          </div>
        ),
      },
    ],
    [],
  );

  const max = Math.max(1, data.funnel[0]!.value);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Trust center"
        title="Analytics"
        description="How agencies move from the trust page to approved access and downloads, and which agencies are most engaged."
        actions={
          <>
            <Segmented
              layoutId="an-range"
              value={range}
              onChange={setRange}
              options={[
                { value: "30d", label: "30 days" },
                { value: "90d", label: "90 days" },
                { value: "6m", label: "6 months" },
              ]}
            />
            <Button variant="secondary" onClick={exportCsv}>
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trust page views" value={fmt.compact(data.pageViews)} footer={`Estimated, ${RANGE_LABEL[range]}`} icon={<Eye />} />
        <StatCard label="Request approval rate" value={`${approvalRate}%`} footer={`${data.approved.length} of ${data.reqs.length} requests, ${RANGE_LABEL[range]}`} icon={<UserPlus />} />
        <StatCard label="Active reviewers" value={fmt.num(data.activeHandles.size)} footer={`${reviewers.filter((r) => effectiveStatus(r) === "active").length} with access today`} icon={<UsersRound />} />
        <StatCard label="Answers used" value={fmt.num(faqUses)} footer={`Security Q&A answers viewed or reused · ${confirmed} confirmed subscribers`} icon={<MessagesSquare />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader title="Access funnel" description={`From the public page to downloads, ${RANGE_LABEL[range]}`} />
          <ol className="px-4 pb-5 pt-4 sm:px-5">
            {data.funnel.map((s, i) => {
              const prev = i > 0 ? data.funnel[i - 1]!.value : 0;
              const conv = i > 0 && prev ? (s.value / prev) * 100 : null;
              return (
                <li key={s.label}>
                  {conv !== null && (
                    <div className="flex items-center gap-1.5 py-1 pl-1 text-[11.5px] text-muted">
                      <ArrowDown className="size-3" />
                      <span className="font-medium text-fg">{conv >= 10 ? conv.toFixed(0) : conv.toFixed(1)}%</span>
                      <span>continue</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-subtle text-muted">
                        <s.icon className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-fg">{s.label}</div>
                        <div className="truncate text-[11.5px] text-muted">{s.sub}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-7 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-subtle">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(1.5, (s.value / max) * 100)}%` }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                          className="h-full rounded-r-[4px] bg-[var(--chart-1)]"
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right text-[13.5px] font-semibold text-fg">{fmt.compact(s.value)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-line px-4 py-3 text-[12px] text-muted sm:px-5">
            Page views are estimated from document-view sessions. Every other step is counted from requests and the access log.
          </p>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title="Activity by weekday"
            description="Top agencies, all access events"
            action={
              <Segmented
                size="sm"
                layoutId="heat-view"
                value={heatView}
                onChange={setHeatView}
                options={[
                  { value: "3d", label: "3D" },
                  { value: "grid", label: "Grid" },
                ]}
              />
            }
          />
          {data.heat.length && heatView === "3d" ? (
            <div className="px-2 pb-3 pt-2">
              <Bars3D rows={data.heat.map((h) => h.agency.short)} cols={WEEKDAYS} values={data.heat.map((h) => h.row)} height={300} />
            </div>
          ) : data.heat.length ? (
            <div className="px-4 pb-5 pt-4 sm:px-5">
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-[2px] text-[11px]">
                <span />
                {WEEKDAYS.map((d) => (
                  <span key={d} className="pb-1 text-center text-muted">
                    {d}
                  </span>
                ))}
                {data.heat.map((h) => (
                  <React.Fragment key={h.agency.agencyId}>
                    <span className="truncate pr-2 text-[12px] font-medium leading-8 text-fg" title={h.agency.name}>
                      {h.agency.short}
                    </span>
                    {h.row.map((v, i) => {
                      const t = v / data.heatMax;
                      return (
                        <Tooltip key={i} content={`${h.agency.short}, ${WEEKDAYS[i]}: ${v} events`}>
                          <span
                            className="h-8 rounded-[3px]"
                            style={{ background: v ? `color-mix(in oklab, var(--chart-1) ${Math.round(12 + t * 88)}%, var(--surface))` : "var(--subtle)" }}
                          />
                        </Tooltip>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 text-[11.5px] text-muted">
                Fewer
                <span className="flex gap-[2px]">
                  {[12, 34, 56, 78, 100].map((p) => (
                    <span key={p} className="size-3 rounded-[2px]" style={{ background: `color-mix(in oklab, var(--chart-1) ${p}%, var(--surface))` }} />
                  ))}
                </span>
                More
              </div>
            </div>
          ) : (
            <EmptyState compact title="No activity in this range" />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <DataTable
          data={data.agencies}
          columns={columns}
          getRowId={(a) => a.agencyId}
          initialSorting={[{ id: "score", desc: true }]}
          onRowClick={(a) => setOpen(a.agencyId)}
          minWidth={620}
          maxHeight={520}
          filters={
            <span className="text-[13px] font-medium text-fg">
              Top agencies <span className="font-normal text-muted">· {RANGE_LABEL[range]} · click a row for details</span>
            </span>
          }
          empty={<EmptyState compact title="No agency activity in this range" body="Choose a longer range." />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader title="Most-read documents" description={RANGE_LABEL[range]} />
          <ol className="px-4 pb-3 pt-2 sm:px-5">
            {data.mostRead.map((m, i) => (
              <li key={m.doc.id} className="border-b border-line py-2.5 last:border-0">
                <Link href={`/admin/documents/${m.doc.id}`} className="group flex items-center gap-3">
                  <span className="w-4 shrink-0 text-[12px] text-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg group-hover:underline">{m.doc.title}</span>
                    <Meter value={m.n} max={data.mostRead[0]!.n} className="mt-1.5" />
                  </span>
                  <span className="w-10 shrink-0 text-right text-[12.5px] font-medium text-fg">{m.n}</span>
                </Link>
              </li>
            ))}
            {!data.mostRead.length && <li className="py-3 text-[13px] text-muted">No documents opened in this range.</li>}
          </ol>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Not opened in 90 days" description="Candidates to retire, merge or point reviewers to" action={<FileX className="size-4 text-faint" />} />
          <ul className="px-4 pb-3 pt-2 sm:px-5">
            {data.unopened.slice(0, 6).map((u) => (
              <li key={u.doc.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <Link href={`/admin/documents/${u.doc.id}`} className="min-w-0 truncate text-[13px] font-medium text-fg hover:underline">
                  {u.doc.title}
                </Link>
                <span className="shrink-0 text-[12px] text-muted">{u.last ? `Last ${fmt.date(u.last)}` : "Never opened"}</span>
              </li>
            ))}
            {!data.unopened.length && <li className="py-3 text-[13px] text-muted">Every document was opened in the last 90 days.</li>}
            {data.unopened.length > 6 && <li className="pt-2 text-[12px] text-faint">and {data.unopened.length - 6} more</li>}
          </ul>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Questions answered by the trust page" description="Security Q&A answers viewed or reused in questionnaires" />
          <div className="px-4 pb-4 pt-3 sm:px-5">
            <div className="font-serif text-[44px] leading-none tracking-[-0.02em] text-fg">{fmt.num(faqUses)}</div>
            <p className="mt-1 text-[12.5px] text-muted">Each one is a question an agency did not need to email Northwind about.</p>
            <ul className="mt-4 grid grid-cols-1 gap-2">
              {topFaqs.map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate text-fg">{f.question}</span>
                  <span className="shrink-0 font-medium text-fg">{f.uses}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="ghost" className="-ml-2 mt-3">
              <Link href="/admin/questionnaires?tab=library">Q&A library</Link>
            </Button>
          </div>
        </Card>
      </div>

      <AgencySheet agencyId={open} range={range} onClose={() => setOpen(null)} />
    </motion.div>
  );
}

/* ───────── Per-agency detail ───────── */
function weeklyFor(logs: LogEvent[], agencyId: string, now: number) {
  const out = Array.from({ length: 12 }, () => 0);
  for (const e of logs) {
    if (e.agencyId !== agencyId) continue;
    const w = Math.floor((now - new Date(e.at).getTime()) / (7 * DAY));
    if (w >= 0 && w < 12) out[11 - w]! += 1;
  }
  return out;
}

function AgencySheet({ agencyId, range, onClose }: { agencyId: string | null; range: Range; onClose: () => void }) {
  const logs = useTrust((s) => s.logs);
  const reviewers = useTrust((s) => s.reviewers);
  const docs = useTrust((s) => s.documents);
  const questionnaires = useTrust((s) => s.questionnaires);
  const keys = useTrust((s) => s.apiKeys);
  const requests = useTrust((s) => s.requests);

  const d = React.useMemo(() => {
    if (!agencyId) return null;
    const now = nowMs();
    const inRange = since(logs, RANGE_DAYS[range], now).filter((e) => e.agencyId === agencyId && e.handle !== "anonymous");
    const people: Reviewer[] = reviewers.filter((r) => r.agencyId === agencyId);
    const reads = new Map<string, number>();
    for (const e of inRange) if (e.docId && (isView(e) || isDownload(e) || e.action === "api_fetch")) reads.set(e.docId, (reads.get(e.docId) ?? 0) + 1);
    const top = [...reads.entries()]
      .map(([id, n]) => ({ doc: docs.find((x) => x.id === id), n }))
      .filter((x): x is { doc: TrustDocument; n: number } => !!x.doc)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const qs: Questionnaire[] = questionnaires.filter((q) => q.agencyId === agencyId);
    const ks: ApiKey[] = keys.filter((k) => k.agencyId === agencyId);
    const reqs: AccessRequest[] = requests.filter((r) => r.agencyId === agencyId);
    return { inRange, people, top, qs, ks, reqs, trend: weeklyFor(logs, agencyId, now) };
  }, [agencyId, logs, reviewers, docs, questionnaires, keys, requests, range]);

  return (
    <Sheet open={!!agencyId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={560}>
        {agencyId && d && (
          <>
            <SheetHeader title={agencyName(agencyId)} description={`${fmt.num(d.inRange.length)} events, ${RANGE_LABEL[range]}`} />
            <SheetBody className="grid grid-cols-1 content-start gap-6">
              <section>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[13px] font-semibold text-fg">Activity, last 12 weeks</h3>
                  <span className="text-[12px] text-muted">{fmt.num(d.trend.reduce((a, b) => a + b, 0))} events</span>
                </div>
                <div className="mt-2 rounded-[10px] border border-line px-3 py-3">
                  <Sparkline values={d.trend} className="h-12" height={48} />
                </div>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-fg">People and systems</h3>
                <ul className="mt-2 divide-y divide-line rounded-[10px] border border-line">
                  {d.people.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={r.name} size={28} square={r.kind === "system"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-[13px] font-medium text-fg">
                          {r.kind === "system" ? <Server className="size-3.5 shrink-0 text-muted" /> : <UserRound className="size-3.5 shrink-0 text-muted" />}
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="truncate text-[12px] text-muted">{r.lastAccessAt ? `Last access ${fmt.ago(r.lastAccessAt)}` : "No access yet"}</div>
                      </div>
                      <ReviewerStatusBadge r={r} />
                    </li>
                  ))}
                  {!d.people.length && <li className="px-3 py-3 text-[13px] text-muted">No reviewers from this organization yet.</li>}
                </ul>
                {d.reqs.some((r) => r.status === "pending") && (
                  <p className="mt-2 text-[12.5px] text-warning-fg">{d.reqs.filter((r) => r.status === "pending").length} access request waiting for review.</p>
                )}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-fg">Most-read documents</h3>
                <ol className="mt-2 grid grid-cols-1 gap-2">
                  {d.top.map((m) => (
                    <li key={m.doc.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-fg">{m.doc.title}</span>
                        <Meter value={m.n} max={d.top[0]!.n} className="mt-1" />
                      </span>
                      <span className="w-8 shrink-0 text-right text-[12.5px] font-medium text-fg">{m.n}</span>
                    </li>
                  ))}
                  {!d.top.length && <li className="text-[13px] text-muted">No documents opened in this range.</li>}
                </ol>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-fg">Questionnaires</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2">
                  {d.qs.map((q) => {
                    const approved = q.items.filter((i) => i.state === "approved").length;
                    return (
                      <li key={q.id} className="rounded-[10px] border border-line px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[13px] font-medium text-fg">{q.title}</span>
                          <Badge tone={q.status === "sent" ? "success" : q.status === "new" ? "info" : "warning"}>
                            {q.status === "in_progress" ? "In progress" : q.status === "in_review" ? "In review" : q.status === "sent" ? "Sent" : "New"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          {approved} of {q.items.length} approved · {q.status === "sent" && q.sentAt ? `sent ${fmt.date(q.sentAt)}` : `due ${fmt.date(q.dueAt)}`}
                        </div>
                      </li>
                    );
                  })}
                  {!d.qs.length && <li className="text-[13px] text-muted">No questionnaires from this organization.</li>}
                </ul>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-fg">API access</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2">
                  {d.ks.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2.5">
                      <KeyRound className="size-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-fg">{k.name}</div>
                        <div className="font-mono text-[11.5px] text-faint">
                          {k.prefix}••••{k.last4} · {k.lastUsedAt ? `used ${fmt.ago(k.lastUsedAt)}` : "never used"}
                        </div>
                      </div>
                      <Badge tone={k.status === "active" ? "success" : "danger"} dot>
                        {k.status === "active" ? "Active" : "Revoked"}
                      </Badge>
                    </li>
                  ))}
                  {!d.ks.length && <li className={cn("text-[13px] text-muted")}>No API key. Systems at this organization use the web portal only.</li>}
                </ul>
              </section>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
