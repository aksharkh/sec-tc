"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Download, Ellipsis, FileText, Globe2, LockKeyhole, Mail, Pencil, Plus, Send, Trash2, UsersRound, X } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Card, ProgressBar } from "@/components/ui/display";
import { Checkbox, Segmented, Select, Tabs } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { TOPIC_LABEL, useTrust } from "@/lib/store";
import type { Reviewer, Subscriber, Topic, Update, UpdateKind } from "@/lib/types";
import { DAY, cn, downloadText, fmt, nowMs } from "@/lib/utils";
import { PageSkeleton } from "./common";

/* ───────── Shared helpers ───────── */

export const KIND_META: Record<UpdateKind, { label: string; tone: Tone }> = {
  scn: { label: "Significant change", tone: "review" },
  incident: { label: "Incident", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "warning" },
  document: { label: "Document", tone: "brand" },
  subprocessor: { label: "Subprocessor", tone: "info" },
  general: { label: "General", tone: "neutral" },
};

const KIND_HINT: Record<UpdateKind, string> = {
  scn: "A change to the certified system that agencies must hear about, with its SCN number.",
  incident: "Something affected the service. Say what happened, what data was involved and what you did.",
  maintenance: "Planned work with a time window and what will be unavailable.",
  document: "A new document or a new version in the package.",
  subprocessor: "A subprocessor was added, changed or removed.",
  general: "Anything else agencies should know.",
};

const TOPICS: Topic[] = ["documents", "changes", "incidents", "subprocessors"];

export function topicFor(kind: UpdateKind): Topic {
  if (kind === "incident" || kind === "maintenance") return "incidents";
  if (kind === "scn") return "changes";
  if (kind === "subprocessor") return "subprocessors";
  return "documents";
}

/** Same rule as the store's publishUpdate: confirmed subscribers to the topic; reviewers-only notices go to reviewers. */
export function estimateRecipients(subscribers: Subscriber[], reviewers: Reviewer[], kind: UpdateKind, audience: Update["audience"]) {
  const topic = topicFor(kind);
  return subscribers.filter(
    (x) => x.status === "confirmed" && x.topics.includes(topic) && (audience === "public" || reviewers.some((r) => r.handle === x.email)),
  ).length;
}

function toLocalInput(ms: number) {
  return format(new Date(ms), "yyyy-MM-dd'T'HH:mm");
}

function defaultScheduleMs() {
  const d = new Date(nowMs() + DAY);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

function openRate(u: Update) {
  return u.recipients ? Math.round((u.opens / u.recipients) * 100) : 0;
}

function StatusBadge({ u }: { u: Update }) {
  if (u.status === "published")
    return (
      <Badge tone="success" dot>
        Published
      </Badge>
    );
  if (u.status === "scheduled")
    return (
      <Badge tone="warning" dot>
        Scheduled
      </Badge>
    );
  return (
    <Badge tone="neutral" outline>
      Draft
    </Badge>
  );
}

function AudienceLabel({ audience }: { audience: Update["audience"] }) {
  return audience === "public" ? (
    <span className="inline-flex items-center gap-1">
      <Globe2 className="size-3.5" /> Public
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <LockKeyhole className="size-3.5" /> Reviewers only
    </span>
  );
}

/* ───────── Page ───────── */

type Tab = "notices" | "subscribers";
type Editing = { mode: "new" } | { mode: "edit"; update: Update } | null;

export function AdminUpdates() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <UpdatesBody />;
}

function UpdatesBody() {
  const updates = useTrust((s) => s.updates);
  const subscribers = useTrust((s) => s.subscribers);
  const [tab, setTab] = React.useState<Tab>("notices");
  const [editing, setEditing] = React.useState<Editing>(null);

  const drafts = updates.filter((u) => u.status === "draft").length;
  const confirmed = subscribers.filter((s) => s.status === "confirmed").length;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Engagement"
        title="Updates and notices"
        description="Tell agencies about new documents, significant changes, incidents and maintenance. Published notices appear on the trust page and go by email to subscribers of that topic."
        actions={
          <Button variant="primary" onClick={() => setEditing({ mode: "new" })}>
            <Plus /> New notice
          </Button>
        }
      />
      <Tabs
        layoutId="updates-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "notices", label: "Notices", count: drafts || undefined },
          { value: "subscribers", label: "Subscribers", count: confirmed },
        ]}
      />
      <div className="pt-5">
        {tab === "notices" ? <Notices onEdit={(u) => setEditing({ mode: "edit", update: u })} onNew={() => setEditing({ mode: "new" })} /> : <Subscribers />}
      </div>
      <Composer editing={editing} onClose={() => setEditing(null)} />
    </motion.div>
  );
}

/* ───────── Notices ───────── */

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function Notices({ onEdit, onNew }: { onEdit: (u: Update) => void; onNew: () => void }) {
  const updates = useTrust((s) => s.updates);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const remove = useTrust((s) => s.remove);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [status, setStatus] = React.useState<"all" | Update["status"]>("all");
  const [kind, setKind] = React.useState<"all" | UpdateKind>("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Update | null>(null);

  const now = nowMs();
  const published = updates.filter((u) => u.status === "published");
  const last30 = published.filter((u) => now - new Date(u.at).getTime() < 30 * DAY);
  const withRecipients = published.filter((u) => u.recipients > 0);
  const avgOpen = withRecipients.length ? Math.round(withRecipients.reduce((a, u) => a + openRate(u), 0) / withRecipients.length) : 0;
  const scheduled = updates.filter((u) => u.status === "scheduled");
  const nextScheduled = [...scheduled].sort((a, b) => a.at.localeCompare(b.at))[0];

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return updates
      .filter((u) => (status === "all" || u.status === status) && (kind === "all" || u.kind === kind))
      .filter((u) => !needle || `${u.title} ${u.body}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const rank = (x: Update) => (x.status === "draft" ? 0 : x.status === "scheduled" ? 1 : 2);
        return rank(a) - rank(b) || b.at.localeCompare(a.at);
      });
  }, [updates, status, kind, q]);

  const publishNow = (u: Update) => {
    const res = publishUpdate({ id: u.id, kind: u.kind, title: u.title, body: u.body, audience: u.audience, docId: u.docId, status: "published", at: new Date(nowMs()).toISOString() });
    toast.success("Notice published", { description: `Sent to ${res.recipients} ${res.recipients === 1 ? "subscriber" : "subscribers"} and shown on the trust page.` });
  };

  const cancelScheduled = (u: Update) => {
    const prev = useTrust.getState().updates;
    upsert("updates", { ...u, status: "draft" });
    addAudit({ action: "Canceled scheduled notice", target: u.title, category: "updates" });
    toast("Schedule canceled", { description: "The notice is back in drafts.", action: { label: "Undo", onClick: () => patch({ updates: prev }) } });
  };

  const deleteDraft = (u: Update) => {
    const prev = useTrust.getState().updates;
    remove("updates", u.id);
    addAudit({ action: "Deleted draft notice", target: u.title, category: "updates" });
    toast("Draft deleted", { action: { label: "Undo", onClick: () => patch({ updates: prev }) } });
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published, last 30 days" value={last30.length} sub={`${published.length} published in total`} />
        <Stat label="Average open rate" value={`${avgOpen}%`} sub="Across notices sent by email" />
        <Stat label="Scheduled" value={scheduled.length} sub={nextScheduled ? `Next ${fmt.day(nextScheduled.at)}` : "Nothing scheduled"} />
        <Stat label="Drafts" value={updates.filter((u) => u.status === "draft").length} sub="Only admins can see drafts" />
      </div>

      <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notices" aria-label="Search notices" className="h-8 text-[13px] lg:max-w-[240px]" />
        <div className="scroll-thin -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          {(["all", "published", "scheduled", "draft"] as const).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s === "draft" ? "Drafts" : s[0]!.toUpperCase() + s.slice(1)}
            </Chip>
          ))}
        </div>
        <Select
          size="sm"
          ariaLabel="Kind"
          className="w-full lg:w-[190px]"
          value={kind}
          onValueChange={(v) => setKind(v as "all" | UpdateKind)}
          options={[{ value: "all", label: "All kinds" }, ...(Object.keys(KIND_META) as UpdateKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))]}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((u) => (
            <motion.div key={u.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <Card className="p-4 transition-colors hover:border-line-strong sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(u)}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={KIND_META[u.kind].tone}>{KIND_META[u.kind].label}</Badge>
                      <StatusBadge u={u} />
                    </div>
                    <div className="mt-2 text-[14.5px] font-semibold text-fg">{u.title}</div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{u.body}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
                      <span>
                        {u.status === "scheduled" ? "Goes out " : u.status === "draft" ? "Last edited " : ""}
                        {u.status === "published" ? fmt.date(u.at) : fmt.day(u.at)}
                      </span>
                      <AudienceLabel audience={u.audience} />
                      <span>{u.author}</span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-start gap-3 md:w-[260px] md:justify-end">
                    {u.status === "published" ? (
                      <div className="min-w-0 flex-1 md:max-w-[200px]">
                        <div className="flex justify-between text-[12px] text-muted">
                          <span>
                            <span className="font-medium text-fg">{u.opens}</span> of {u.recipients} opened
                          </span>
                          <span className="font-medium text-fg">{openRate(u)}%</span>
                        </div>
                        <ProgressBar value={openRate(u)} tone="success" className="mt-1.5" label="Open rate" />
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-wrap gap-1.5 md:justify-end">
                        <Button size="xs" variant="secondary" onClick={() => onEdit(u)}>
                          <Pencil /> Edit
                        </Button>
                        <Button size="xs" variant="primary" onClick={() => publishNow(u)}>
                          <Send /> Publish now
                        </Button>
                      </div>
                    )}
                    <Menu>
                      <MenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${u.title}`}>
                          <Ellipsis />
                        </Button>
                      </MenuTrigger>
                      <MenuContent className="w-52">
                        <MenuItem onSelect={() => setOpen(u)}>
                          <FileText /> View details
                        </MenuItem>
                        {u.status !== "published" && (
                          <MenuItem onSelect={() => onEdit(u)}>
                            <Pencil /> Edit
                          </MenuItem>
                        )}
                        {u.status === "scheduled" && (
                          <MenuItem onSelect={() => cancelScheduled(u)}>
                            <X /> Cancel schedule
                          </MenuItem>
                        )}
                        {u.status === "draft" && (
                          <>
                            <MenuSeparator />
                            <MenuItem danger onSelect={() => deleteDraft(u)}>
                              <Trash2 /> Delete draft
                            </MenuItem>
                          </>
                        )}
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && (
          <Card>
            <EmptyState
              compact
              title="No notices match"
              body="Change the filters, or write a new notice for agencies."
              action={
                <Button size="sm" variant="primary" onClick={onNew}>
                  <Plus /> New notice
                </Button>
              }
            />
          </Card>
        )}
      </div>

      <NoticeSheet update={open} onClose={() => setOpen(null)} onEdit={(u) => { setOpen(null); onEdit(u); }} />
    </div>
  );
}

function NoticeSheet({ update, onClose, onEdit }: { update: Update | null; onClose: () => void; onEdit: (u: Update) => void }) {
  const docs = useTrust((s) => s.documents);
  const u = update;
  return (
    <Sheet open={!!u} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={560}>
        {u && (
          <>
            <SheetHeader title={u.title} description={`${KIND_META[u.kind].label} · ${u.status === "published" ? `Published ${fmt.dateTime(u.at)}` : u.status === "scheduled" ? `Scheduled for ${fmt.dateTime(u.at)}` : "Draft"}`}>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge u={u} />
                <Badge tone="neutral" outline>
                  <AudienceLabel audience={u.audience} />
                </Badge>
              </div>
            </SheetHeader>
            <SheetBody className="grid grid-cols-1 content-start gap-5">
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg">{u.body}</p>
              {u.docId && (
                <div className="rounded-[10px] border border-line bg-raised p-3 text-[13px]">
                  <div className="text-[12px] text-muted">Linked document</div>
                  <div className="mt-0.5 font-medium text-fg">{docs.find((d) => d.id === u.docId)?.title ?? u.docId}</div>
                </div>
              )}
              {u.status === "published" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-3">
                    <div className="text-[12px] text-muted">Recipients</div>
                    <div className="mt-1 text-[20px] font-semibold text-fg">{u.recipients}</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-[12px] text-muted">Opened</div>
                    <div className="mt-1 text-[20px] font-semibold text-fg">{u.opens}</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-[12px] text-muted">Open rate</div>
                    <div className="mt-1 text-[20px] font-semibold text-fg">{openRate(u)}%</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-1.5 text-[12.5px] text-muted">
                <div>
                  Topic: <span className="text-fg">{TOPIC_LABEL[topicFor(u.kind)]}</span>
                </div>
                <div>
                  Author: <span className="text-fg">{u.author}</span>
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {u.status !== "published" && (
                <Button variant="primary" onClick={() => onEdit(u)}>
                  <Pencil /> Edit
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ───────── Composer ───────── */

type When = "now" | "schedule" | "draft";

function Composer({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  return (
    <Sheet open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={980}>
        {editing && <ComposerForm key={editing.mode === "edit" ? editing.update.id : "new"} editing={editing} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ComposerForm({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const docs = useTrust((s) => s.documents);
  const subscribers = useTrust((s) => s.subscribers);
  const reviewers = useTrust((s) => s.reviewers);
  const profile = useTrust((s) => s.profile);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const initial = editing.mode === "edit" ? editing.update : null;
  const [kind, setKind] = React.useState<UpdateKind>(initial?.kind ?? "document");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [audience, setAudience] = React.useState<Update["audience"]>(initial?.audience ?? "public");
  const [docId, setDocId] = React.useState(initial?.docId ?? "none");
  const [when, setWhen] = React.useState<When>(initial?.status === "scheduled" ? "schedule" : "now");
  const [scheduleAt, setScheduleAt] = React.useState(() => toLocalInput(initial?.status === "scheduled" ? new Date(initial.at).getTime() : defaultScheduleMs()));
  const [preview, setPreview] = React.useState<"page" | "email">("page");
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const recipients = estimateRecipients(subscribers, reviewers, kind, audience);
  const scheduleMs = new Date(scheduleAt).getTime();
  const errors = {
    title: title.trim().length < 6 ? "Write a short, specific title." : "",
    body: body.trim().length < 20 ? "Say what changed and what agencies need to do, if anything." : "",
    schedule: when === "schedule" && (isNaN(scheduleMs) || scheduleMs < nowMs()) ? "Pick a time in the future." : "",
  };
  const valid = !errors.title && !errors.body && !errors.schedule;
  const linkedDoc = docs.find((d) => d.id === docId);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setTimeout(() => {
      const status: Update["status"] = when === "now" ? "published" : when === "schedule" ? "scheduled" : "draft";
      const at = when === "schedule" ? new Date(scheduleMs).toISOString() : new Date(nowMs()).toISOString();
      const res = publishUpdate({ id: initial?.id, kind, title: title.trim(), body: body.trim(), audience, docId: docId === "none" ? undefined : docId, status, at });
      setBusy(false);
      onClose();
      if (status === "published") toast.success("Notice published", { description: `Emailed to ${res.recipients} ${res.recipients === 1 ? "subscriber" : "subscribers"} and added to the trust page.` });
      else if (status === "scheduled") toast.success("Notice scheduled", { description: `Goes out ${fmt.dateTime(at)}.` });
      else toast("Draft saved", { description: "Only admins can see drafts." });
    }, 450);
  };

  const fromName = profile.name;
  const dateLabel = when === "schedule" && !isNaN(scheduleMs) ? fmt.date(new Date(scheduleMs).toISOString()) : fmt.date(new Date(nowMs()).toISOString());

  return (
    <>
      <SheetHeader title={initial ? "Edit notice" : "New notice"} description="Published notices show on the trust page and go by email to subscribers of the topic." />
      <SheetBody className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="grid grid-cols-1 content-start gap-4 p-5">
            <Field label="Kind" hint={KIND_HINT[kind]}>
              <Select
                ariaLabel="Kind"
                value={kind}
                onValueChange={(v) => setKind(v as UpdateKind)}
                options={(Object.keys(KIND_META) as UpdateKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))}
              />
            </Field>
            <Field label="Title" htmlFor="nt-title" error={touched && errors.title}>
              <Input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "scn" ? "SCN-0143: new region for backups" : "Plan of Action and Milestones updated"} aria-invalid={touched && !!errors.title} />
            </Field>
            <Field label="Message" htmlFor="nt-body" error={touched && errors.body} hint={`${body.trim().length} characters. Plain text; line breaks are kept.`}>
              <Textarea id="nt-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={touched && !!errors.body} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Audience">
                <Segmented
                  fill
                  layoutId="nt-aud"
                  value={audience}
                  onChange={setAudience}
                  options={[
                    { value: "public", label: "Public", icon: <Globe2 /> },
                    { value: "reviewers", label: "Reviewers", icon: <LockKeyhole /> },
                  ]}
                />
              </Field>
              <Field label="Linked document" optional>
                <Select
                  ariaLabel="Linked document"
                  value={docId}
                  onValueChange={setDocId}
                  options={[{ value: "none", label: "None" }, ...docs.map((d) => ({ value: d.id, label: d.title }))]}
                />
              </Field>
            </div>
            <Field label="When">
              <Segmented
                fill
                layoutId="nt-when"
                value={when}
                onChange={setWhen}
                options={[
                  { value: "now", label: "Publish now", icon: <Send /> },
                  { value: "schedule", label: "Schedule", icon: <CalendarClock /> },
                  { value: "draft", label: "Draft", icon: <Pencil /> },
                ]}
              />
            </Field>
            {when === "schedule" && (
              <Field label="Send at" htmlFor="nt-at" error={touched && errors.schedule} hint="Your local time.">
                <Input id="nt-at" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} aria-invalid={touched && !!errors.schedule} />
              </Field>
            )}
            <div className="flex items-start gap-2.5 rounded-[10px] border border-line bg-raised p-3 text-[13px]">
              <UsersRound className="mt-0.5 size-4 shrink-0 text-muted" />
              <div>
                <span className="font-medium text-fg">
                  {when === "draft" ? "No email for drafts." : `About ${recipients} ${recipients === 1 ? "subscriber" : "subscribers"} will get this.`}
                </span>
                <span className="block text-[12.5px] text-muted">
                  Confirmed subscribers to {TOPIC_LABEL[topicFor(kind)].toLowerCase()}
                  {audience === "reviewers" ? " who are approved reviewers" : ""}.
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-line bg-subtle/50 p-5 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-muted">Preview</span>
              <Segmented
                size="sm"
                layoutId="nt-preview"
                value={preview}
                onChange={setPreview}
                options={[
                  { value: "page", label: "On the trust page" },
                  { value: "email", label: "Email", icon: <Mail /> },
                ]}
              />
            </div>
            {preview === "page" ? (
              <div className="card p-4">
                <div className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="size-2 rounded-full bg-tenant" />
                  {dateLabel}
                  <Badge tone={KIND_META[kind].tone} className="ml-auto">
                    {KIND_META[kind].label}
                  </Badge>
                </div>
                <div className="mt-2.5 text-[14.5px] font-semibold text-fg">{title.trim() || "Notice title"}</div>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted">{body.trim() || "The message agencies will read."}</p>
                {linkedDoc && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-[7px] border border-line px-2 py-1 text-[12px] text-fg">
                    <FileText className="size-3.5 text-muted" />
                    {linkedDoc.title}
                    {linkedDoc.visibility === "restricted" && <LockKeyhole className="size-3 text-faint" />}
                  </div>
                )}
                {audience === "reviewers" && <div className="mt-3 text-[12px] text-faint">Shown only to signed-in reviewers.</div>}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
                <div className="grid grid-cols-1 gap-0.5 border-b border-line px-4 py-3 text-[12px] text-muted">
                  <div>
                    From: <span className="text-fg">{fromName} Trust Center &lt;notices@trust.secureknots.com&gt;</span>
                  </div>
                  <div>
                    Subject: <span className="font-medium text-fg">[{KIND_META[kind].label}] {title.trim() || "Notice title"}</span>
                  </div>
                </div>
                <div className="px-4 py-4 text-[13px] leading-relaxed text-fg">
                  <p className="text-muted">Hello,</p>
                  <p className="mt-2 whitespace-pre-line">{body.trim() || "The message agencies will read."}</p>
                  {linkedDoc && (
                    <p className="mt-3">
                      {linkedDoc.visibility === "restricted" ? "Sign in to the reviewer portal to open " : "Download "}
                      <span className="underline underline-offset-2">{linkedDoc.title}</span>.
                    </p>
                  )}
                  <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-faint">
                    You get this because you subscribed to {TOPIC_LABEL[topicFor(kind)].toLowerCase()} on {fromName}&apos;s trust center. Manage topics or unsubscribe from the link in every email.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={busy}>
          {when === "now" ? (
            <>
              <Send /> Publish to {recipients}
            </>
          ) : when === "schedule" ? (
            <>
              <CalendarClock /> Schedule
            </>
          ) : (
            "Save draft"
          )}
        </Button>
      </SheetFooter>
    </>
  );
}

/* ───────── Subscribers ───────── */

function Subscribers() {
  const subscribers = useTrust((s) => s.subscribers);
  const remove = useTrust((s) => s.remove);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | Subscriber["status"]>("all");
  const [topic, setTopic] = React.useState<"all" | Topic>("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const confirmed = subscribers.filter((s) => s.status === "confirmed");
  const data = React.useMemo(
    () => subscribers.filter((s) => (status === "all" || s.status === status) && (topic === "all" || s.topics.includes(topic))),
    [subscribers, status, topic],
  );

  const doRemove = React.useCallback(
    (s: Subscriber) => {
      const prev = useTrust.getState().subscribers;
      remove("subscribers", s.id);
      addAudit({ action: "Removed subscriber", target: s.email, category: "updates" });
      toast(`Removed ${s.email}`, { action: { label: "Undo", onClick: () => patch({ subscribers: prev }) } });
    },
    [remove, addAudit, patch],
  );

  const columns = React.useMemo<ColumnDef<Subscriber, unknown>[]>(
    () => [
      {
        id: "email",
        header: "Subscriber",
        accessorFn: (s) => `${s.email} ${s.name ?? ""} ${s.organization}`,
        sortingFn: (a, b) => a.original.email.localeCompare(b.original.email),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{row.original.name ?? row.original.email}</div>
            {row.original.name && <div className="truncate font-mono text-[11.5px] text-muted">{row.original.email}</div>}
          </div>
        ),
        meta: { className: "max-w-[260px]" },
      },
      { id: "org", header: "Organization", accessorFn: (s) => s.organization, cell: ({ getValue }) => <span className="block max-w-[200px] truncate text-muted">{String(getValue())}</span>, meta: { hideBelow: "md" } },
      {
        id: "topics",
        header: "Topics",
        enableSorting: false,
        accessorFn: (s) => s.topics.join(" "),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.topics.map((t) => (
              <span key={t} className="whitespace-nowrap rounded-full border border-line-strong px-1.5 py-px text-[11px] text-muted">
                {TOPIC_LABEL[t].split(" ")[0]}
              </span>
            ))}
          </div>
        ),
        meta: { hideBelow: "lg" },
      },
      { id: "source", header: "Source", accessorFn: (s) => s.source, cell: ({ getValue }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{String(getValue())}</span>, meta: { hideBelow: "lg" } },
      {
        id: "status",
        header: "Status",
        accessorFn: (s) => s.status,
        cell: ({ row }) =>
          row.original.status === "confirmed" ? (
            <Badge tone="success" dot>
              Confirmed
            </Badge>
          ) : row.original.status === "pending" ? (
            <Badge tone="warning" dot>
              Pending
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Unsubscribed
            </Badge>
          ),
      },
      { id: "at", header: "Since", accessorFn: (s) => s.at, cell: ({ getValue }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{fmt.date(String(getValue()))}</span>, meta: { hideBelow: "md" } },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${s.email}`}>
                  <Ellipsis />
                </Button>
              </MenuTrigger>
              <MenuContent className="w-56">
                {s.status === "pending" && (
                  <MenuItem onSelect={() => toast.success("Confirmation email sent again", { description: s.email })}>
                    <Mail /> Resend confirmation
                  </MenuItem>
                )}
                {s.status === "pending" && (
                  <MenuItem
                    onSelect={() => {
                      upsert("subscribers", { ...s, status: "confirmed" });
                      toast.success(`${s.email} confirmed`);
                    }}
                  >
                    <Send /> Mark as confirmed
                  </MenuItem>
                )}
                {s.status !== "pending" && <MenuItem disabled>{s.status === "confirmed" ? "Receiving notices" : "Not receiving notices"}</MenuItem>}
                <MenuSeparator />
                <MenuItem danger onSelect={() => doRemove(s)}>
                  <Trash2 /> Remove subscriber
                </MenuItem>
              </MenuContent>
            </Menu>
          );
        },
        meta: { className: "w-10 text-right" },
      },
    ],
    [upsert, doRemove],
  );

  const exportCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [["email", "name", "organization", "topics", "source", "status", "subscribed"], ...data.map((s) => [s.email, s.name ?? "", s.organization, s.topics.join(";"), s.source, s.status, s.at.slice(0, 10)])];
    downloadText("northwind-trust-subscribers.csv", rows.map((r) => r.map(esc).join(",")).join("\n"), "text/csv");
    toast.success(`Exported ${data.length} subscribers`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {TOPICS.map((t) => {
          const n = confirmed.filter((s) => s.topics.includes(t)).length;
          return (
            <button
              key={t}
              onClick={() => setTopic(topic === t ? "all" : t)}
              className={cn("card p-4 text-left transition-colors hover:border-line-strong", topic === t && "border-fg/40 ring-1 ring-fg/10")}
              aria-pressed={topic === t}
            >
              <div className="text-[12.5px] font-medium text-muted">{TOPIC_LABEL[t]}</div>
              <div className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">{n}</div>
              <div className="mt-2 text-[12px] text-muted">confirmed subscribers</div>
            </button>
          );
        })}
      </div>
      <DataTable
        className="mt-4"
        data={data}
        columns={columns}
        getRowId={(s) => s.id}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search email or organization"
        initialSorting={[{ id: "at", desc: true }]}
        minWidth={640}
        filters={
          <>
            {(["all", "confirmed", "pending", "unsubscribed"] as const).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s === "all" ? "All" : s[0]!.toUpperCase() + s.slice(1)}
              </Chip>
            ))}
            {topic !== "all" && (
              <Chip active onClick={() => setTopic("all")}>
                {TOPIC_LABEL[topic]} <X />
              </Chip>
            )}
          </>
        }
        toolbarRight={
          <>
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              <Download /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
              <Plus /> <span className="hidden sm:inline">Add subscriber</span>
            </Button>
          </>
        }
        empty={<EmptyState compact title="No subscribers match" body="Change the filters, or add someone who asked for notices by email." />}
      />
      <AddSubscriber open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddSubscriber({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const subscribe = useTrust((s) => s.subscribe);
  const addAudit = useTrust((s) => s.addAudit);
  const subscribers = useTrust((s) => s.subscribers);
  const [email, setEmail] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [topics, setTopics] = React.useState<Topic[]>(["incidents", "changes"]);
  const [touched, setTouched] = React.useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const exists = subscribers.some((s) => s.email.toLowerCase() === email.trim().toLowerCase() && s.status !== "unsubscribed");
  const reset = () => {
    setEmail("");
    setOrg("");
    setTopics(["incidents", "changes"]);
    setTouched(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="md">
        <DialogHeader title="Add subscriber" description="They get a confirmation email first. Notices start once they confirm." />
        <DialogBody className="grid grid-cols-1 gap-4">
          <Field label="Email" htmlFor="as-email" error={touched && (!validEmail ? "Enter a valid email." : exists ? "Already subscribed." : undefined)}>
            <Input id="as-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="security-team@agency.gov" aria-invalid={touched && (!validEmail || exists)} />
          </Field>
          <Field label="Organization" htmlFor="as-org" optional>
            <Input id="as-org" value={org} onChange={(e) => setOrg(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-2">
            <span className="text-[13px] font-medium text-fg">Topics</span>
            {TOPICS.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] border border-line px-3 py-2 text-[13px] text-fg hover:bg-subtle/60">
                <Checkbox checked={topics.includes(t)} onCheckedChange={(v) => setTopics((p) => (v ? [...p, t] : p.filter((x) => x !== t)))} aria-label={TOPIC_LABEL[t]} />
                {TOPIC_LABEL[t]}
              </label>
            ))}
            {touched && !topics.length && <p className="text-[12.5px] text-danger-fg">Pick at least one topic.</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!validEmail || exists || !topics.length) return;
              const sub = subscribe({ email: email.trim(), organization: org, topics, source: "admin" });
              addAudit({ action: "Added subscriber", target: sub.email, detail: topics.map((t) => TOPIC_LABEL[t]).join(", "), category: "updates" });
              onOpenChange(false);
              setTimeout(reset, 200);
              toast.success("Confirmation email sent", { description: sub.email });
            }}
          >
            Send confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
