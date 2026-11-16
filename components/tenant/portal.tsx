"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  KeyRound,
  LogOut,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkle,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, Card, CardHeader, ProgressBar, Skeleton } from "@/components/ui/display";
import { Checkbox, Segmented, Select, Tabs } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { CopyButton, EmptyState, FileIcon, VisibilityBadge } from "@/components/kit/bits";
import { DocViewer } from "@/components/kit/doc-viewer";
import { CodeViewer } from "@/components/kit/code";
import { ACTION_LABEL, ChannelBadge, agencyName, reviewerOrg } from "@/components/admin/common";
import { CATEGORY_LABEL } from "@/lib/mock/catalog";
import { useReady } from "@/lib/hooks";
import { LENGTH_LABEL, TOPIC_LABEL, effectiveStatus, useTrust } from "@/lib/store";
import type { AccessLength, AccessRequest, LogEvent, Questionnaire, Reviewer, Topic, TrustDocument, UpdateKind } from "@/lib/types";
import { HOUR, cn, downloadText, fakeHash, fmt, nowMs, sleep, uid } from "@/lib/utils";
import { TenantFooter, TenantWordmark } from "./chrome";
import { RequestAccessDialog } from "./request-access";
import { KsiDashboard } from "./ksi-dashboard";
import { StandardView } from "./public/engage";
import { AskBox } from "./public/ask";
import { DesignSwitcher } from "@/components/design/design-switcher";

export function ReviewerPortal() {
  const ready = useReady();
  const email = useTrust((s) => s.session.reviewerEmail);
  const reviewer = useTrust((s) => s.reviewers.find((r) => r.handle === email && r.kind === "person"));
  const requests = useTrust((s) => s.requests);
  const request = React.useMemo(() => requests.find((r) => r.email === email), [requests, email]);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const name = reviewer?.name ?? request?.name;

  let state: "loading" | "none" | "pending" | "denied" | "ended" | "active" = "loading";
  if (ready) {
    if (reviewer && effectiveStatus(reviewer) === "active") state = "active";
    else if (request?.status === "pending") state = "pending";
    else if (reviewer) state = "ended";
    else if (request?.status === "denied") state = "denied";
    else state = "none";
  }

  return (
    <div className="app-bg flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 supports-[backdrop-filter]:bg-canvas/85 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-3 px-4 sm:px-6">
          <TenantWordmark sub="Reviewer portal" />
          <div className="ml-auto flex items-center gap-2">
            <DesignSwitcher />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/t/northwind">Public page</Link>
            </Button>
            {ready && name && <IdentityMenu name={name} email={email} />}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        {state === "loading" && <PortalSkeleton />}
        {state === "active" && reviewer && <ActivePortal key={reviewer.id} reviewer={reviewer} />}
        {state === "pending" && request && <Pending request={request} />}
        {state === "denied" && request && (
          <Ended
            title="Request not approved"
            body={
              <>
                Northwind didn&apos;t approve the request from {request.email}
                {request.reason ? <>: &ldquo;{request.reason}&rdquo;</> : "."}
              </>
            }
            onRequest={() => setRequestOpen(true)}
          />
        )}
        {state === "ended" && reviewer && (
          <Ended
            title={effectiveStatus(reviewer) === "revoked" ? "Your access was revoked" : "Your access has ended"}
            body={
              effectiveStatus(reviewer) === "revoked"
                ? "Northwind revoked access for this account. Contact security@northwindcloud.com if you still need the documents."
                : `Access for ${reviewer.handle} ended on ${reviewer.expiresAt ? fmt.date(reviewer.expiresAt) : "its expiry date"}. Request again to renew it.`
            }
            onRequest={() => setRequestOpen(true)}
          />
        )}
        {state === "none" && (
          <Ended title="You don't have access yet" body="Restricted documents are shared with approved reviewers. Request access with your work email." onRequest={() => setRequestOpen(true)} />
        )}
      </main>
      <TenantFooter />
      <RequestAccessDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-4 h-10 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[420px] rounded-[10px]" />
        <Skeleton className="h-[260px] rounded-[10px]" />
      </div>
    </div>
  );
}

function IdentityMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const reviewers = useTrust((s) => s.reviewers);
  const requests = useTrust((s) => s.requests);
  const setReviewer = useTrust((s) => s.setReviewer);
  const people = React.useMemo(() => {
    const map = new Map<string, string>();
    reviewers.filter((r) => r.kind === "person").forEach((r) => map.set(r.handle, r.name));
    requests.filter((r) => r.status === "pending").forEach((r) => map.set(r.email, r.name));
    return [...map.entries()].slice(0, 9);
  }, [reviewers, requests]);
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring sm:pr-3" aria-label="Account">
        <Avatar name={name} size={30} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-medium text-fg">{name}</span>
          <span className="block max-w-[180px] truncate text-[11.5px] text-muted">{email}</span>
        </span>
      </MenuTrigger>
      <MenuContent className="w-72">
        <MenuLabel>Demo: view the portal as</MenuLabel>
        {people.map(([handle, n]) => (
          <MenuItem key={handle} onSelect={() => setReviewer(handle)}>
            <UserRound />
            <span className="min-w-0 flex-1 truncate">{n}</span>
            {handle === email && <Check className="!text-fg" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            toast("Signed out", { description: "Sign-in links work once and expire after use." });
            router.push("/t/northwind");
          }}
        >
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Ended({ title, body, onRequest }: { title: string; body: React.ReactNode; onRequest: () => void }) {
  return (
    <div className="card mx-auto max-w-xl">
      <EmptyState
        title={title}
        body={body}
        action={
          <>
            <Button variant="tenant" size="sm" onClick={onRequest}>
              Request access
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/t/northwind">Public documents</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}

function Pending({ request }: { request: AccessRequest }) {
  const steps = [
    { t: "Request sent", d: fmt.dateTime(request.submittedAt), done: true },
    { t: "Northwind reviews it", d: "Usually within one business day", current: true },
    { t: "Sign-in link emailed", d: `To ${request.email}` },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <p className="text-[13px] text-muted">Signed in as {request.email}</p>
      <h1 className="mt-2 font-serif text-[34px] leading-tight text-fg sm:text-[40px]">Your request is with Northwind</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Requests from {request.email.split("@")[1]} aren&apos;t on the automatic approval list, so Northwind&apos;s security team reviews them. You&apos;ll get an email as soon as it&apos;s decided.
      </p>
      <Card className="mt-6 p-5">
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-3 sm:flex-col">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-[12px] font-medium",
                  s.done && "border-success bg-success text-white dark:text-[#04120f]",
                  s.current && "border-tenant text-tenant",
                  !s.done && !s.current && "border-line-strong text-faint",
                )}
              >
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : s.current ? <Clock3 className="size-3.5" /> : i + 1}
              </span>
              <div>
                <div className="text-[13.5px] font-medium text-fg">{s.t}</div>
                <div className="text-[12.5px] text-muted">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
          <span className="font-medium text-fg">Your purpose:</span> {request.purpose}
        </div>
      </Card>
      <div className="mt-4 rounded-[10px] border border-dashed border-line-strong bg-raised p-4">
        <div className="text-[12px] font-medium text-muted">Demo shortcut</div>
        <p className="mt-1 text-[13px] text-fg">Approve this request as Northwind&apos;s admin, then come back here. The documents appear straight away.</p>
        <Button asChild size="sm" variant="primary" className="mt-3">
          <Link href="/admin/access">
            Open Admin › Access <ArrowRight />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

/* ───────── Active portal ───────── */

const UPDATE_KIND: Record<UpdateKind, { label: string; tone: "warning" | "danger" | "neutral" | "success" | "review" | "brand" }> = {
  scn: { label: "Significant change", tone: "review" },
  incident: { label: "Incident", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "warning" },
  document: { label: "Document", tone: "neutral" },
  subprocessor: { label: "Subprocessor", tone: "brand" },
  general: { label: "Notice", tone: "neutral" },
};

/** The reviewer's previous visit: the latest sign-in older than the current session (6 hours). */
function previousVisit(logs: LogEvent[], r: Reviewer): string {
  const now = nowMs();
  const prev = logs
    .filter((e) => e.handle === r.handle && e.action === "sign_in" && now - new Date(e.at).getTime() > 6 * HOUR)
    .map((e) => e.at)
    .sort()
    .at(-1);
  return prev ?? r.grantedAt;
}

const isPast = (iso: string) => new Date(iso).getTime() <= nowMs();

function ActivePortal({ reviewer }: { reviewer: Reviewer }) {
  const docs = useTrust((s) => s.documents);
  const logs = useTrust((s) => s.logs);
  const logEvent = useTrust((s) => s.logEvent);
  const watermark = useTrust((s) => s.security.watermark);
  const watchlist = useTrust((s) => s.session.watchlist);
  const toggleWatch = useTrust((s) => s.toggleWatch);
  const [since] = React.useState(() => previousVisit(logs, reviewer));
  const [tab, setTab] = React.useState<"restricted" | "public" | "watched">("restricted");
  const [section, setSection] = React.useState<"documents" | "ksi" | "questionnaires">("documents");
  const standards = useTrust((s) => s.standardQuestionnaires);
  const [stdId, setStdId] = React.useState<"caiq" | "sig-lite">("caiq");
  const [preview, setPreview] = React.useState<{ doc: TrustDocument; version: string } | null>(null);
  const [versions, setVersions] = React.useState<Record<string, string>>({});
  const [zipping, setZipping] = React.useState(false);

  const scoped = React.useMemo(() => docs.filter((d) => reviewer.scope === "all" || d.category === "package" || d.visibility === "public"), [docs, reviewer.scope]);
  const restricted = scoped.filter((d) => d.visibility === "restricted");
  const pub = scoped.filter((d) => d.visibility === "public");
  const watched = scoped.filter((d) => watchlist.includes(d.id));
  const list = tab === "restricted" ? restricted : tab === "public" ? pub : watched;
  const isNew = (d: TrustDocument) => d.versions[0]!.publishedAt > since;

  const base = { actor: reviewer.name, handle: reviewer.handle, actorKind: "person" as const, agencyId: reviewer.agencyId, channel: "web" as const };
  const download = (d: TrustDocument, version: string) => {
    const v = d.versions.find((x) => x.version === version) ?? d.versions[0]!;
    logEvent({ ...base, docId: d.id, target: d.title, action: "download" });
    toast.success(`Downloading ${d.title} v${v.version}`, { description: `${fmt.size(v.sizeKb)}${watermark ? ", watermarked with your name" : ""}. Logged in your access history.` });
  };
  const open = (d: TrustDocument, version: string) => {
    logEvent({ ...base, docId: d.id, target: d.title, action: "view" });
    setPreview({ doc: d, version });
  };
  const watch = (d: TrustDocument) => {
    const on = !watchlist.includes(d.id);
    toggleWatch(d.id);
    toast(on ? `Watching ${d.title}` : `Stopped watching ${d.title}`, {
      description: on ? `We'll email ${reviewer.handle} when a new version is published.` : "You won't get emails about new versions of this document.",
    });
  };
  const downloadAll = async () => {
    setZipping(true);
    await sleep(1200);
    setZipping(false);
    const size = restricted.reduce((a, d) => a + d.versions[0]!.sizeKb, 0);
    logEvent({ ...base, target: "All restricted documents (ZIP)", action: "download_all" });
    toast.success(`Downloading ${restricted.length} documents`, { description: `northwind-restricted-documents.zip, ${fmt.size(size)}. Current versions only.` });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <p className="text-[13px] text-muted">
        Shared with {reviewer.name}, {reviewerOrg(reviewer)}
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-serif text-[34px] leading-[1.08] text-fg sm:text-[42px]">
          {section === "documents" ? "Restricted documents" : section === "ksi" ? "Key Security Indicators" : "Security questionnaires"}
        </h1>
        {section === "documents" && (
          <Button variant="tenant" onClick={downloadAll} loading={zipping} className="self-start sm:self-auto">
            <FileArchive /> Download all ({restricted.length})
          </Button>
        )}
      </div>

      <AskBox who="reviewer" className="mt-5" canRead={(d) => scoped.some((x) => x.id === d.id)} onOpenDoc={(d) => open(d, d.versions[0]!.version)} />

      <Tabs
        className="mt-6"
        layoutId="portal-section"
        value={section}
        onChange={setSection}
        tabs={[
          { value: "documents", label: "Documents", count: scoped.length },
          { value: "ksi", label: "KSI dashboard" },
          { value: "questionnaires", label: "CAIQ and SIG Lite", count: standards.reduce((a, x) => a + x.items.length, 0) },
        ]}
      />

      {section === "ksi" && (
        <div className="mt-6">
          <KsiDashboard onOpenDoc={(d) => open(d, d.versions[0]!.version)} />
        </div>
      )}

      {section === "questionnaires" && (
        <div className="mt-6">
          <Segmented
            layoutId="portal-std"
            value={stdId}
            onChange={setStdId}
            options={standards.map((x) => ({ value: x.id, label: x.id === "caiq" ? "CAIQ v4" : "SIG Lite", count: x.items.length }))}
          />
          <div className="mt-4">
            <StandardView
              key={stdId}
              id={stdId}
              onOpenDoc={(d) => open(d, d.versions[0]!.version)}
              onDownload={() => {
                const sq = standards.find((x) => x.id === stdId)!;
                logEvent({ ...base, target: `${sq.name} (spreadsheet)`, action: "download" });
                downloadText(
                  `northwind-${sq.id}-${sq.version}.csv`,
                  ["ID,Domain,Question,Answer,Detail", ...sq.items.map((i) => [i.id, i.domain, i.question, i.answer, i.detail].map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n"),
                  "text/csv",
                );
                toast.success(`Downloaded ${sq.name}`, { description: "Logged in your access history." });
              }}
            />
          </div>
        </div>
      )}

      {section === "documents" && (
      <>
      <WhatsNew since={since} docs={scoped} onOpen={(d) => open(d, d.versions[0]!.version)} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Segmented
              layoutId="portal-tab"
              value={tab}
              onChange={setTab}
              options={[
                { value: "restricted", label: "Restricted", count: restricted.length },
                { value: "public", label: "Public", count: pub.length },
                { value: "watched", label: "Watched", icon: <Bell />, count: watched.length },
              ]}
            />
          </div>
          <Card className="mt-3 overflow-hidden">
            {list.length === 0 ? (
              <EmptyState
                compact
                title="Not watching any documents"
                body="Use the bell on a document to get an email whenever Northwind publishes a new version."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setTab("restricted")}>
                    Browse restricted documents
                  </Button>
                }
              />
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {list.map((d) => {
                    const ver = versions[d.id] ?? d.versions[0]!.version;
                    const watching = watchlist.includes(d.id);
                    return (
                      <motion.li
                        key={d.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-0 sm:flex-row sm:items-center sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 gap-3">
                          <FileIcon kind={d.kind} size={32} className="mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <button onClick={() => open(d, ver)} className="text-left text-[14px] font-medium text-fg hover:text-tenant">
                                {d.title}
                              </button>
                              {watching && isNew(d) && (
                                <Badge tone="tenant" dot>
                                  New version
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                              <span>{CATEGORY_LABEL[d.category]}</span>
                              <span aria-hidden>·</span>
                              <span>Updated {fmt.date(d.versions[0]!.publishedAt)}</span>
                              {tab === "watched" && d.visibility === "public" && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span>Public</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 pl-[38px] sm:pl-0">
                          {d.versions.length > 1 ? (
                            <Select
                              size="sm"
                              ariaLabel={`Version of ${d.title}`}
                              className="w-[108px]"
                              value={ver}
                              onValueChange={(v) => setVersions((s) => ({ ...s, [d.id]: v }))}
                              options={d.versions.map((x, i) => ({ value: x.version, label: `v${x.version}`, hint: i === 0 ? "Latest" : fmt.date(x.publishedAt) }))}
                            />
                          ) : (
                            <span className="w-[108px] px-2 font-mono text-[12px] text-muted">v{ver}</span>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => open(d, ver)} aria-label={`Preview ${d.title}`}>
                            <Eye />
                            <span className="hidden xl:inline">Preview</span>
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => download(d, ver)} aria-label={`Download ${d.title}`}>
                            <Download />
                            <span className="hidden xl:inline">Download</span>
                          </Button>
                          <Tooltip content={watching ? "Stop watching" : "Watch for new versions"}>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-pressed={watching}
                              aria-label={watching ? `Stop watching ${d.title}` : `Watch ${d.title}`}
                              onClick={() => watch(d)}
                              className={cn(watching && "text-tenant hover:text-tenant")}
                            >
                              {watching ? <BellRing /> : <Bell />}
                            </Button>
                          </Tooltip>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-1 content-start gap-4">
          <AccessSummary reviewer={reviewer} />
          <AgencyQuestionnaires reviewer={reviewer} />
          <AskNorthwind reviewer={reviewer} />
          <NotificationPrefs reviewer={reviewer} />
          <ApiKeyCard reviewer={reviewer} />
        </div>
      </div>

      <History reviewer={reviewer} />
      </>
      )}

      <Sheet open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <SheetContent width={1100}>
          {preview && (
            <>
              <SheetHeader
                title={preview.doc.title}
                description={`Version ${preview.version} · ${CATEGORY_LABEL[preview.doc.category]} · ${(preview.doc.versions.find((x) => x.version === preview.version) ?? preview.doc.versions[0]!).pages} pages`}
              >
                <div className="mt-2">
                  <VisibilityBadge value={preview.doc.visibility} />
                </div>
              </SheetHeader>
              <SheetBody className="flex flex-col overflow-hidden p-3 sm:p-4">
                <DocViewer
                  className="min-h-[420px] flex-1"
                  doc={preview.doc}
                  version={preview.version}
                  viewer={{ name: reviewer.name, organization: reviewerOrg(reviewer) }}
                  watermarkDefault={watermark && preview.doc.visibility === "restricted"}
                />
              </SheetBody>
              <SheetFooter>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Close
                </Button>
                <Button variant="tenant" onClick={() => download(preview.doc, preview.version)}>
                  <Download /> Download v{preview.version}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

/* ───────── New since your last visit ───────── */
function WhatsNew({ since, docs, onOpen }: { since: string; docs: TrustDocument[]; onOpen: (d: TrustDocument) => void }) {
  const updates = useTrust((s) => s.updates);
  const changed = React.useMemo(
    () => docs.filter((d) => d.versions[0]!.publishedAt > since).sort((a, b) => b.versions[0]!.publishedAt.localeCompare(a.versions[0]!.publishedAt)),
    [docs, since],
  );
  const published = React.useMemo(
    () => updates.filter((u) => u.status === "published" && (u.audience === "public" || u.audience === "reviewers") && isPast(u.at)).sort((a, b) => b.at.localeCompare(a.at)),
    [updates],
  );
  const notices = published.filter((u) => u.at > since);
  const empty = changed.length === 0 && notices.length === 0;

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-tenant-soft text-tenant">
            <Sparkle className="size-3.5" />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-fg">New since your last visit</div>
            <div className="text-[12px] text-muted">Last visit {fmt.dateTime(since)}</div>
          </div>
        </div>
        {!empty && (
          <span className="text-[12.5px] text-muted">
            {changed.length} {changed.length === 1 ? "document" : "documents"} · {notices.length} {notices.length === 1 ? "notice" : "notices"}
          </span>
        )}
      </div>
      {empty ? (
        <div className="px-4 py-5 sm:px-5">
          <div className="flex items-center gap-2 text-[13.5px] text-fg">
            <Check className="size-4 text-success-fg" /> You&apos;re up to date. Nothing changed since your last visit.
          </div>
          {published.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-medium text-muted">Recent notices</div>
              <ul className="mt-2 grid grid-cols-1 gap-2">
                {published.slice(0, 3).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <Badge tone={UPDATE_KIND[u.kind].tone}>{UPDATE_KIND[u.kind].label}</Badge>
                    <span className="text-fg">{u.title}</span>
                    <span className="text-[12px] text-muted">{fmt.date(u.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-line">
          <div className="min-w-0 border-b border-line md:border-b-0">
            <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted sm:px-5">Updated documents</div>
            {changed.length ? (
              <ul className="px-2 pb-2 sm:px-3">
                {changed.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button onClick={() => onOpen(d)} className="flex w-full items-start gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-raised">
                      <FileIcon kind={d.kind} size={26} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[13.5px] font-medium text-fg">{d.title}</span>
                          <span className="font-mono text-[11.5px] text-muted">v{d.versions[0]!.version}</span>
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">{d.versions[0]!.note}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-faint">{fmt.short(d.versions[0]!.publishedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 pt-1 text-[13px] text-muted sm:px-5">No documents changed.</p>
            )}
          </div>
          <div className="min-w-0">
            <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-muted sm:px-5">Notices</div>
            {notices.length ? (
              <ul className="px-4 pb-3 sm:px-5">
                {notices.slice(0, 5).map((u) => (
                  <li key={u.id} className="border-b border-line py-2.5 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={UPDATE_KIND[u.kind].tone}>{UPDATE_KIND[u.kind].label}</Badge>
                      <span className="text-[12px] text-faint">{fmt.date(u.at)}</span>
                      {u.audience === "reviewers" && <span className="text-[12px] text-faint">· Reviewers only</span>}
                    </div>
                    <div className="mt-1 text-[13.5px] font-medium text-fg">{u.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{u.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 pt-1 text-[13px] text-muted sm:px-5">No new notices.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────── Access summary + request more time ───────── */
function AccessSummary({ reviewer }: { reviewer: Reviewer }) {
  const audit = useTrust((s) => s.audit);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const requested = React.useMemo(() => audit.find((a) => a.actor === reviewer.name && a.action === "Requested more time"), [audit, reviewer.name]);
  const granted = new Date(reviewer.grantedAt).getTime();
  const end = reviewer.expiresAt ? new Date(reviewer.expiresAt).getTime() : null;
  const left = end ? Math.max(0, Math.ceil((end - nowMs()) / 86400000)) : null;
  const pct = end ? ((nowMs() - granted) / (end - granted)) * 100 : 0;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <ShieldCheck className="size-4 text-muted" /> Your access
        </span>
        <Badge tone="success" dot>
          Active
        </Badge>
      </div>
      <dl className="mt-3 divide-y divide-line text-[13px]">
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Granted by</dt>
          <dd className="text-right font-medium text-fg">{reviewer.grantedBy.replace("Auto-approval: ", "Automatic, rule ")}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Granted on</dt>
          <dd className="font-medium text-fg">{fmt.date(reviewer.grantedAt)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Valid until</dt>
          <dd className="text-right font-medium text-fg">{reviewer.expiresAt ? fmt.date(reviewer.expiresAt) : "Continuing access"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Documents</dt>
          <dd className="font-medium text-fg">{reviewer.scope === "all" ? "All restricted" : "Certification package"}</dd>
        </div>
      </dl>
      {left !== null && (
        <div className="mt-2">
          <ProgressBar value={pct} tone={left < 14 ? "warning" : "brand"} label="Access period used" />
          <div className="mt-1.5 text-[12px] text-muted">{left} days left.</div>
        </div>
      )}
      {requested ? (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-subtle px-3 py-2 text-[12.5px] text-fg">
          <CalendarClock className="mt-px size-3.5 shrink-0 text-muted" />
          <span>
            You asked for more time {fmt.ago(requested.at)}. Northwind will reply by email.
          </span>
        </div>
      ) : (
        reviewer.expiresAt && (
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setMoreOpen(true)}>
            <CalendarClock /> Request more time
          </Button>
        )
      )}
      <MoreTimeDialog reviewer={reviewer} open={moreOpen} onOpenChange={setMoreOpen} />
    </Card>
  );
}

function MoreTimeDialog({ reviewer, open, onOpenChange }: { reviewer: Reviewer; open: boolean; onOpenChange: (v: boolean) => void }) {
  const addAudit = useTrust((s) => s.addAudit);
  const patch = useTrust((s) => s.patch);
  const [length, setLength] = React.useState<AccessLength>("90d");
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const ok = reason.trim().length >= 10;

  const submit = () => {
    setTouched(true);
    if (!ok) return;
    addAudit({ actor: reviewer.name, action: "Requested more time", target: reviewer.name, detail: `${LENGTH_LABEL[length]}. ${reason.trim()}`, category: "access" });
    const notices = useTrust.getState().notices;
    patch({
      notices: [
        {
          id: uid("nt"),
          at: new Date().toISOString(),
          kind: "expiry",
          title: "Reviewer asked for more time",
          body: `${reviewer.name}, ${reviewerOrg(reviewer)}: ${LENGTH_LABEL[length].toLowerCase()}`,
          href: `/admin/access?tab=inventory&q=${encodeURIComponent(reviewer.name)}`,
        },
        ...notices,
      ],
    });
    onOpenChange(false);
    setTimeout(() => {
      setReason("");
      setTouched(false);
    }, 200);
    toast.success("Request sent to Northwind", { description: "They'll review it and email you. Your access stays the same until then." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title="Request more time" description={`Your access ends on ${reviewer.expiresAt ? fmt.date(reviewer.expiresAt) : "its expiry date"}. Northwind decides on extensions.`} />
        <DialogBody className="grid grid-cols-1 gap-4">
          <Field label="How much longer">
            <Select
              ariaLabel="Extension length"
              value={length}
              onValueChange={(v) => setLength(v as AccessLength)}
              options={(Object.keys(LENGTH_LABEL) as AccessLength[]).map((k) => ({ value: k, label: LENGTH_LABEL[k] }))}
            />
          </Field>
          <Field label="Reason" htmlFor="mt-reason" error={touched && !ok ? "Tell Northwind briefly why you need more time." : undefined}>
            <Textarea id="mt-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: our authorization review runs until March." aria-invalid={touched && !ok} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="tenant" onClick={submit}>
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Agency questionnaires ───────── */
const Q_STATUS: Record<Questionnaire["status"], { label: string; tone: "neutral" | "warning" | "review" | "success" }> = {
  new: { label: "Received", tone: "neutral" },
  in_progress: { label: "In progress", tone: "warning" },
  in_review: { label: "Final review", tone: "review" },
  sent: { label: "Answered", tone: "success" },
};

function AgencyQuestionnaires({ reviewer }: { reviewer: Reviewer }) {
  const questionnaires = useTrust((s) => s.questionnaires);
  const mine = React.useMemo(() => questionnaires.filter((q) => q.agencyId === reviewer.agencyId && reviewer.agencyId !== "other"), [questionnaires, reviewer.agencyId]);
  if (!mine.length) return null;
  return (
    <Card className="p-4 sm:p-5">
      <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
        <ClipboardCheck className="size-4 text-muted" /> Your agency&apos;s questionnaires
      </span>
      <ul className="mt-3 grid grid-cols-1 gap-3">
        {mine.map((q) => {
          const answered = q.items.filter((i) => i.state === "approved" || i.state === "edited").length;
          const pct = q.status === "sent" ? 100 : (answered / Math.max(1, q.items.length)) * 100;
          return (
            <li key={q.id} className="rounded-[8px] border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium leading-snug text-fg">{q.title}</span>
                <Badge tone={Q_STATUS[q.status].tone}>{Q_STATUS[q.status].label}</Badge>
              </div>
              <div className="mt-1 text-[12px] text-muted">
                From {q.requester} · {q.status === "sent" && q.sentAt ? `sent ${fmt.date(q.sentAt)}` : `due ${fmt.date(q.dueAt)}`}
              </div>
              <ProgressBar value={pct} tone={q.status === "sent" ? "success" : "brand"} className="mt-2.5" label="Questions answered" />
              <div className="mt-1.5 text-[12px] text-muted">
                {q.status === "sent" ? `All ${q.items.length} questions answered` : `Northwind has answered ${answered} of ${q.items.length} questions`}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ───────── Ask Northwind ───────── */
function AskNorthwind({ reviewer }: { reviewer: Reviewer }) {
  const questions = useTrust((s) => s.publicQuestions);
  const askQuestion = useTrust((s) => s.askQuestion);
  const mine = React.useMemo(() => questions.filter((q) => q.email === reviewer.handle), [questions, reviewer.handle]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ok = text.trim().length >= 10;

  const send = async () => {
    if (!ok) return;
    setBusy(true);
    await sleep(500);
    askQuestion({ question: text.trim(), name: reviewer.name, email: reviewer.handle, organization: reviewerOrg(reviewer) });
    setBusy(false);
    setText("");
    toast.success("Question sent to Northwind", { description: "The security team usually answers within two business days. The answer appears here and in your email." });
  };

  return (
    <Card className="p-4 sm:p-5">
      <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
        <MessageSquareText className="size-4 text-muted" /> Ask Northwind
      </span>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">Questions about a control or a finding go to Northwind&apos;s security team, not to SecureKnots.</p>
      <Textarea className="mt-3" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: is the moderate finding in POAM-061 on track for January?" aria-label="Your question" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[12px] text-faint">{ok ? "Sent from " + reviewer.handle : "At least 10 characters"}</span>
        <Button size="sm" variant="secondary" onClick={send} disabled={!ok} loading={busy}>
          <Send /> Send
        </Button>
      </div>
      {mine.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4">
          <AnimatePresence initial={false}>
            {mine.slice(0, 4).map((q) => (
              <motion.li key={q.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-fg">{q.question}</span>
                  {q.status === "answered" ? <Badge tone="success">Answered</Badge> : <Badge tone="neutral">Waiting</Badge>}
                </div>
                <div className="mt-0.5 text-[12px] text-faint">Asked {fmt.ago(q.askedAt)}</div>
                {q.answer && <p className="mt-1.5 rounded-[8px] bg-subtle px-3 py-2 text-[12.5px] leading-relaxed text-fg">{q.answer}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

/* ───────── Notification preferences ───────── */
const ALL_TOPICS = Object.keys(TOPIC_LABEL) as Topic[];

function NotificationPrefs({ reviewer }: { reviewer: Reviewer }) {
  const subscribers = useTrust((s) => s.subscribers);
  const subscribe = useTrust((s) => s.subscribe);
  const upsert = useTrust((s) => s.upsert);
  const existing = React.useMemo(() => subscribers.find((x) => x.email === reviewer.handle), [subscribers, reviewer.handle]);
  const saved = existing && existing.status !== "unsubscribed" ? existing.topics : [];
  const [topics, setTopics] = React.useState<Topic[]>(saved);
  const dirty = topics.length !== saved.length || topics.some((t) => !saved.includes(t));

  const save = () => {
    if (topics.length) {
      subscribe({ email: reviewer.handle, organization: reviewerOrg(reviewer), topics, source: "reviewer portal", name: reviewer.name });
      toast.success("Notification settings saved", { description: `Emails go to ${reviewer.handle}.` });
    } else if (existing) {
      upsert("subscribers", { ...existing, topics: [], status: "unsubscribed" });
      toast("Unsubscribed from all emails", { description: "Sign-in links and access decisions still arrive by email." });
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <Bell className="size-4 text-muted" /> Email me about
        </span>
        {existing && existing.status === "confirmed" && saved.length > 0 && <span className="text-[12px] text-muted">Since {fmt.short(existing.at)}</span>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1">
        {ALL_TOPICS.map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-[7px] px-1.5 py-1.5 text-[13px] text-fg hover:bg-subtle">
            <Checkbox checked={topics.includes(t)} onCheckedChange={(v) => setTopics((s) => (v ? [...s, t] : s.filter((x) => x !== t)))} aria-label={TOPIC_LABEL[t]} />
            {TOPIC_LABEL[t]}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[12px] text-faint">{saved.length ? `${saved.length} of ${ALL_TOPICS.length} topics` : "Not subscribed"}</span>
        <Button size="sm" variant="secondary" onClick={save} disabled={!dirty}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function ApiKeyCard({ reviewer }: { reviewer: Reviewer }) {
  const keys = useTrust((s) => s.apiKeys);
  const host = useTrust((s) => s.domain.host);
  const key = keys.find((k) => k.agencyId === reviewer.agencyId && k.status === "active");
  const [shown, setShown] = React.useState(false);
  if (!key)
    return (
      <Card className="p-4 sm:p-5">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <KeyRound className="size-4 text-muted" /> Agency API key
        </span>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {agencyName(reviewer.agencyId)} has no API key yet. Systems can pull the package and documents automatically once Northwind issues one.
        </p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => toast.success("Request sent to Northwind", { description: "They'll reply to your email with the key details." })}>
          Ask for a key
        </Button>
      </Card>
    );
  const full = `${key.prefix}${fakeHash(key.id, 28)}${key.last4}`;
  const masked = `${key.prefix}${"•".repeat(12)}${key.last4}`;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <KeyRound className="size-4 text-muted" /> Agency API key
        </span>
        <span className="text-[12px] text-muted">{key.name}</span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 rounded-[8px] border border-line-strong bg-raised py-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">{shown ? full : masked}</span>
        <button
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide key" : "Reveal key"}
          className="grid size-7 place-items-center rounded-[7px] text-muted hover:bg-subtle hover:text-fg"
        >
          {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <CopyButton value={full} iconOnly label="Copy key" toastText="API key copied" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {key.scopes.map((s) => (
          <span key={s} className="rounded-[5px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">
            {s}
          </span>
        ))}
      </div>
      <CodeViewer className="mt-3" language="shell" copy={false} code={`curl https://${host}/api/v1/package \\\n  -H "Authorization: Bearer $SKT_API_KEY"`} />
      <p className="mt-2 text-[12px] text-muted">Shared by your agency&apos;s systems. Last used {key.lastUsedAt ? fmt.ago(key.lastUsedAt) : "never"}.</p>
    </Card>
  );
}

function History({ reviewer }: { reviewer: Reviewer }) {
  const logs = useTrust((s) => s.logs);
  const mine = React.useMemo(() => logs.filter((e) => e.handle === reviewer.handle).slice(0, 25), [logs, reviewer.handle]);
  return (
    <Card className="mt-4 overflow-hidden">
      <CardHeader
        title="Your access history"
        description="Each organization sees only its own records. Northwind keeps them for six months."
        action={<Users className="size-4 text-faint" />}
      />
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-y border-line bg-raised text-left text-[12px] text-muted dark:bg-transparent">
              <th className="px-4 py-2 font-medium sm:px-5">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-4 py-2 font-medium sm:px-5">IP address</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((e) => (
              <motion.tr key={e.id} layout initial={{ opacity: 0, backgroundColor: "var(--brand-soft)" }} animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 1.2 }} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted sm:px-5">{fmt.day(e.at)}</td>
                <td className="px-3 py-2.5 text-fg">{ACTION_LABEL[e.action]}</td>
                <td className="max-w-[320px] truncate px-3 py-2.5 text-fg">{e.action === "sign_in" ? "Email sign-in link" : e.target}</td>
                <td className="px-3 py-2.5">
                  <ChannelBadge channel={e.channel} />
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-muted sm:px-5">{e.ip}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!mine.length && <p className="px-5 py-6 text-[13px] text-muted">No activity yet. Views and downloads appear here as you use the portal.</p>}
      </div>
    </Card>
  );
}
