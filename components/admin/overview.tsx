"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Blocks, Braces, CalendarClock, ChevronRight, Clock3, Download, Eye, FileClock, Globe2, LockKeyhole, MessagesSquare, ShieldCheck, TriangleAlert, Upload, UserPlus, UsersRound } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/kit/bits";
import { StatCard } from "@/components/kit/widgets";
import { Legend, Meter, StackedBars } from "@/components/kit/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Avatar } from "@/components/ui/display";
import { Segmented } from "@/components/ui/controls";
import { useReady } from "@/lib/hooks";
import { effectiveStatus, useTrust } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { activeReviewerTrend, activitySeries, inWindow, isDownload, isView, pctChange, weeklyCounts } from "@/lib/analytics";
import { fmt, nowMs } from "@/lib/utils";
import { ACTION_LABEL, ChannelBadge, PageSkeleton, agencyShort } from "./common";

const SERIES = [
  { key: "web", label: "Reviewers on the web", color: "var(--chart-1)" },
  { key: "api", label: "Agency systems (API)", color: "var(--chart-2)" },
];

export function AdminOverview() {
  const ready = useReady();
  if (!ready) return <PageSkeleton />;
  return <OverviewBody />;
}

function OverviewBody() {
  const logs = useTrust((s) => s.logs);
  const reviewers = useTrust((s) => s.reviewers);
  const requests = useTrust((s) => s.requests);
  const docs = useTrust((s) => s.documents);
  const setUi = useUi((s) => s.set);
  const [range, setRange] = React.useState<"30d" | "90d" | "6m">("30d");

  const { cur, prev } = React.useMemo(() => ({ cur: inWindow(logs, 30), prev: inWindow(logs, 60, 30) }), [logs]);
  const views = cur.filter(isView).length;
  const downloads = cur.filter(isDownload).length;
  const active = reviewers.filter((r) => effectiveStatus(r) === "active");
  const newReviewers = active.filter((r) => nowMs() - new Date(r.grantedAt).getTime() < 30 * 86400000).length;
  const pending = requests.filter((r) => r.status === "pending");
  const oldest = pending.at(-1);
  const series = activitySeries(logs, range);
  const totals = series.reduce((a, b) => ({ web: a.web + b.web, api: a.api + b.api }), { web: 0, api: 0 });

  const top = React.useMemo(() => {
    const m = new Map<string, { views: number; downloads: number }>();
    for (const e of cur) {
      if (!e.docId || (!isView(e) && !isDownload(e))) continue;
      const v = m.get(e.docId) ?? { views: 0, downloads: 0 };
      if (isView(e)) v.views++;
      else v.downloads++;
      m.set(e.docId, v);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ doc: docs.find((d) => d.id === id), ...v, total: v.views + v.downloads }))
      .filter((x) => x.doc)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [cur, docs]);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow={`${fmt.date(new Date().toISOString())}`}
        title="Overview"
        description="How agencies are using Northwind's trust center, and anything waiting on you."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/t/northwind">
                <Globe2 />
                View public page
              </Link>
            </Button>
            <Button variant="primary" onClick={() => setUi({ uploadOpen: true })} asChild>
              <Link href="/admin/documents">
                <Upload />
                Upload document
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Document views" value={fmt.num(views)} delta={pctChange(views, prev.filter(isView).length)} trend={weeklyCounts(logs, isView)} icon={<Eye />} />
        <StatCard label="Downloads" value={fmt.num(downloads)} delta={pctChange(downloads, prev.filter(isDownload).length)} trend={weeklyCounts(logs, isDownload)} icon={<Download />} />
        <StatCard label="Active reviewers" value={fmt.num(active.length)} footer={`${newReviewers} added in the last 30 days`} trend={activeReviewerTrend(reviewers)} icon={<UsersRound />} />
        <StatCard
          label="Pending requests"
          value={fmt.num(pending.length)}
          footer={oldest ? `Oldest waiting ${fmt.ago(oldest.submittedAt).replace(" ago", "")}` : "Nothing waiting"}
          icon={<UserPlus />}
        />
      </div>

      <NeedsAttention />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader
            title="Access over time"
            description={`${fmt.num(totals.web + totals.api)} views, downloads and API fetches ${range === "30d" ? "per day, last 30 days" : range === "90d" ? "per week, last 90 days" : "per week, last 6 months"}`}
            action={
              <Segmented
                size="sm"
                layoutId="ov-range"
                value={range}
                onChange={setRange}
                options={[
                  { value: "30d", label: "30d" },
                  { value: "90d", label: "90d" },
                  { value: "6m", label: "6m" },
                ]}
              />
            }
          />
          <div className="px-4 pb-4 pt-3 sm:px-5">
            <Legend series={SERIES} />
            <div className="mt-3">
              <StackedBars data={series} series={SERIES} xKey="label" unit="events" />
            </div>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Top documents" description="Views and downloads, last 30 days" action={<Button asChild variant="ghost" size="xs"><Link href="/admin/documents">All documents</Link></Button>} />
          {top.length ? (
            <ol className="px-4 pb-3 pt-2 sm:px-5">
              {top.map((t, i) => (
                <li key={t.doc!.id} className="border-b border-line py-2.5 last:border-0">
                  <Link href={`/admin/documents/${t.doc!.id}`} className="group flex items-center gap-3">
                    <span className="w-4 shrink-0 text-[12px] font-medium text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg group-hover:text-brand-ink">
                        <span className="truncate">{t.doc!.title}</span>
                        {t.doc!.visibility === "restricted" && <LockKeyhole className="size-3 shrink-0 text-faint" />}
                      </span>
                      <Meter value={t.total} max={top[0]!.total} className="mt-1.5" />
                    </span>
                    <span className="w-20 shrink-0 text-right text-[12px] text-muted">
                      <span className="font-medium text-fg">{t.views}</span> views
                      <br />
                      <span className="font-medium text-fg">{t.downloads}</span> downloads
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState compact title="No activity yet" body="Views and downloads appear here once reviewers sign in." />
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader title="Recent access" description="Every view, download and API call is logged for six months" action={<Button asChild variant="ghost" size="xs"><Link href="/admin/logs">Access logs <ArrowRight /></Link></Button>} />
          <ul className="px-2 pb-2 pt-2 sm:px-3">
            {logs.slice(0, 7).map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-[8px] px-2 py-2 hover:bg-raised">
                <Avatar name={e.actor} size={28} square={e.actorKind === "system"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-fg">
                    <span className="font-medium">{e.actor}</span> <span className="text-muted">{ACTION_LABEL[e.action].toLowerCase()}</span> {e.action !== "sign_in" && e.target}
                  </div>
                  <div className="text-[12px] text-muted">
                    {agencyShort(e.agencyId)} · {fmt.ago(e.at)}
                  </div>
                </div>
                <ChannelBadge channel={e.channel} />
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-1 min-w-0 content-start gap-4">
          <PendingCard />
          <JsonStatusCard />
          <DomainCard />
        </div>
      </div>
    </motion.div>
  );
}

function PendingCard() {
  const requests = useTrust((s) => s.requests);
  const pending = React.useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const approve = useTrust((s) => s.approveRequest);
  return (
    <Card>
      <CardHeader title="Waiting for approval" description={pending.length ? `${pending.length} access ${pending.length === 1 ? "request" : "requests"}` : "No requests waiting"} action={<Button asChild variant="ghost" size="xs"><Link href="/admin/access">Review</Link></Button>} />
      <ul className="px-4 pb-3 pt-2 sm:px-5">
        {pending.slice(0, 3).map((r) => (
          <motion.li layout key={r.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <Avatar name={r.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-fg">{r.name}</div>
              <div className="truncate text-[12px] text-muted">{r.organization}</div>
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                approve(r.id, "90d");
                toast.success(`Approved ${r.name} for 90 days`, { description: "A sign-in link is on its way to their inbox." });
              }}
            >
              Approve 90 days
            </Button>
          </motion.li>
        ))}
        {!pending.length && <li className="py-3 text-[13px] text-muted">New requests appear here and in your notifications.</li>}
      </ul>
    </Card>
  );
}

function JsonStatusCard() {
  const pkg = useTrust((s) => s.pkg);
  const stale = pkg.status === "stale";
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <Braces className="size-4 text-muted" />
          Package JSON
        </div>
        {stale ? (
          <Badge tone="warning" dot>
            Changes not published
          </Badge>
        ) : (
          <Badge tone="success">
            <BadgeCheck />
            Valid
          </Badge>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Revision {pkg.revision}, generated {fmt.ago(pkg.generatedAt)}.{stale ? " Documents changed since then." : " Matches the published documents."}
      </p>
      <Button asChild size="sm" variant={stale ? "primary" : "secondary"} className="mt-3">
        <Link href="/admin/machine-readable">{stale ? "Regenerate & validate" : "Open machine-readable"}</Link>
      </Button>
    </Card>
  );
}

function DomainCard() {
  const d = useTrust((s) => s.domain);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <Globe2 className="size-4 text-muted" />
          Custom domain
        </div>
        {d.status === "verified" ? (
          <Badge tone="success">
            <ShieldCheck />
            Verified, TLS active
          </Badge>
        ) : (
          <Badge tone="warning">
            <TriangleAlert />
            Pending DNS
          </Badge>
        )}
      </div>
      <div className="mt-2 truncate font-mono text-[13px] text-fg">{d.host}</div>
      <p className="mt-1 text-[12.5px] text-muted">
        CNAME to <span className="font-mono">{d.target}</span>
        {d.verifiedAt && <> · verified {fmt.date(d.verifiedAt)}</>}
      </p>
      <Button asChild size="sm" variant="ghost" className="-ml-2 mt-2">
        <Link href="/admin/settings#domain">Domain settings</Link>
      </Button>
    </Card>
  );
}

/* ───────── Needs attention: one list across every module ───────── */
type Attention = { id: string; icon: React.ElementType; text: string; detail: string; href: string; tone: "danger" | "warning" | "neutral" };

function NeedsAttention() {
  const requests = useTrust((s) => s.requests);
  const reviewers = useTrust((s) => s.reviewers);
  const questionnaires = useTrust((s) => s.questionnaires);
  const publicQuestions = useTrust((s) => s.publicQuestions);
  const pkg = useTrust((s) => s.pkg);
  const integrations = useTrust((s) => s.integrations);
  const webhooks = useTrust((s) => s.webhooks);
  const docs = useTrust((s) => s.documents);
  const updates = useTrust((s) => s.updates);

  const items = React.useMemo<Attention[]>(() => {
    const now = nowMs();
    const out: Attention[] = [];
    const pending = requests.filter((r) => r.status === "pending");
    if (pending.length) out.push({ id: "req", icon: UserPlus, text: `${pending.length} access ${pending.length === 1 ? "request" : "requests"} waiting`, detail: pending.map((r) => r.name).slice(0, 3).join(", "), href: "/admin/access", tone: "warning" });
    const dueQs = questionnaires.filter((q) => q.status !== "sent" && new Date(q.dueAt).getTime() - now < 7 * 86400000);
    if (dueQs.length) {
      const overdue = dueQs.some((q) => new Date(q.dueAt).getTime() < now);
      out.push({ id: "qn", icon: MessagesSquare, text: `${dueQs.length} ${dueQs.length === 1 ? "questionnaire" : "questionnaires"} due within 7 days`, detail: dueQs.map((q) => q.title).slice(0, 2).join(", "), href: "/admin/questionnaires", tone: overdue ? "danger" : "warning" });
    }
    const openQs = publicQuestions.filter((q) => q.status === "open");
    if (openQs.length) out.push({ id: "pq", icon: MessagesSquare, text: `${openQs.length} ${openQs.length === 1 ? "question" : "questions"} from the trust page`, detail: openQs[0]!.question, href: "/admin/questionnaires?tab=inbox", tone: "neutral" });
    const expiring = reviewers.filter((r) => effectiveStatus(r) === "active" && r.expiresAt && new Date(r.expiresAt).getTime() - now < 14 * 86400000);
    if (expiring.length) out.push({ id: "exp", icon: Clock3, text: `${expiring.length} reviewer ${expiring.length === 1 ? "access ends" : "accesses end"} within 14 days`, detail: expiring.map((r) => r.name).join(", "), href: "/admin/access?tab=inventory", tone: "neutral" });
    if (pkg.status === "stale") out.push({ id: "pkg", icon: Braces, text: "Package JSON is behind the trust page", detail: `Revision ${pkg.revision} was generated before the latest document changes`, href: "/admin/machine-readable", tone: "warning" });
    const broken = [...integrations.filter((i) => i.status === "error").map((i) => i.name), ...webhooks.filter((w) => w.status === "failing").map((w) => new URL(w.url).host)];
    if (broken.length) out.push({ id: "int", icon: Blocks, text: `${broken.length} ${broken.length === 1 ? "integration needs" : "integrations need"} attention`, detail: broken.join(", "), href: "/admin/integrations", tone: "danger" });
    const review = docs.filter((d) => d.category === "policies" && now - new Date(d.versions[0]!.publishedAt).getTime() > 150 * 86400000);
    if (review.length) out.push({ id: "rev", icon: FileClock, text: `${review.length} policies due for annual review soon`, detail: review.map((d) => d.title).slice(0, 2).join(", "), href: "/admin/documents", tone: "neutral" });
    const scheduled = updates.filter((u) => u.status === "scheduled").sort((a, b) => a.at.localeCompare(b.at));
    if (scheduled[0]) out.push({ id: "sch", icon: CalendarClock, text: "Scheduled notice", detail: `${scheduled[0].title}, ${fmt.date(scheduled[0].at)}`, href: "/admin/updates", tone: "neutral" });
    return out;
  }, [requests, questionnaires, publicQuestions, reviewers, pkg, integrations, webhooks, docs, updates]);

  if (!items.length) return null;
  return (
    <Card className="mt-4 overflow-hidden">
      <CardHeader title="Needs attention" description="Across access, questionnaires, the package and integrations" action={<Badge tone="neutral">{items.length}</Badge>} />
      <ul className="mt-3 grid grid-cols-1 border-t border-line md:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.id} className={i % 2 === 0 ? "md:border-r md:border-line" : undefined}>
            <Link href={it.href} className="group flex items-center gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-raised sm:px-5">
              <span
                className={
                  it.tone === "danger"
                    ? "grid size-8 shrink-0 place-items-center rounded-full bg-danger-soft text-danger-fg"
                    : it.tone === "warning"
                      ? "grid size-8 shrink-0 place-items-center rounded-full bg-warning-soft text-warning-fg"
                      : "grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-muted"
                }
              >
                <it.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-fg">{it.text}</span>
                <span className="block truncate text-[12.5px] text-muted">{it.detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
