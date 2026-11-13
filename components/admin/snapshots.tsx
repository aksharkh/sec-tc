"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { addMonths, startOfMonth } from "date-fns";
import { BellRing, Camera, CheckCircle2, Download, FileArchive, History, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/kit/bits";
import { Timeline } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardHeader, ProgressBar } from "@/components/ui/display";
import { Checkbox } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { Snapshot } from "@/lib/types";
import { cn, fmt, nowMs } from "@/lib/utils";
import { PageSkeleton } from "./common";

const TRIGGER: Record<Snapshot["trigger"], { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  publish: { label: "On publish", tone: "brand" },
  manual: { label: "Manual", tone: "info" },
  restore: { label: "Before restore", tone: "warning" },
};

const CONFIRM_TEXT = "Northwind Cloud";

const expiresIn24h = () => fmt.dateTime(new Date(Date.now() + 86_400_000).toISOString());

export function AdminSnapshots() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={0} />;
  return <SnapshotsBody />;
}

function SnapshotsBody() {
  const snapshots = useTrust((s) => s.snapshots);
  const [restoreTarget, setRestoreTarget] = React.useState<Snapshot | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [snapOpen, setSnapOpen] = React.useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Data and integrations"
        title="Snapshots"
        description="A snapshot seals every published document, its versions and the package JSON at a point in time. They run on the first of each month and whenever Northwind publishes."
        actions={
          <>
            <Button variant="secondary" onClick={() => setExportOpen(true)}>
              <FileArchive />
              Export all client data
            </Button>
            <Button variant="primary" onClick={() => setSnapOpen(true)}>
              <Camera />
              Take snapshot now
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader title="Package snapshots" description={`${snapshots.length} snapshots, newest first`} />
          <div className="px-4 pb-5 pt-4 sm:px-5">
            {snapshots.length ? (
              <Timeline
                items={snapshots.map((s, i) => ({
                  id: s.id,
                  title: s.label,
                  meta: fmt.dateTime(s.createdAt),
                  tone: i === 0 ? "success" : s.trigger === "restore" ? "warning" : "neutral",
                  icon: i === 0 ? <CheckCircle2 /> : undefined,
                  body: (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
                        <Badge tone={TRIGGER[s.trigger].tone}>{TRIGGER[s.trigger].label}</Badge>
                        <span>{s.documents} documents</span>
                        <span aria-hidden>·</span>
                        <span>{s.sizeMb.toLocaleString("en-US", { maximumFractionDigits: 1 })} MB</span>
                        <span aria-hidden className="hidden sm:inline">·</span>
                        <span className="font-mono text-[11.5px] text-faint" title={`sha256 ${s.checksum}`}>
                          sha256 {s.checksum.slice(0, 8)}…{s.checksum.slice(-4)}
                        </span>
                        {s.by !== "Scheduled" && <span className="text-faint">by {s.by}</span>}
                      </div>
                      {i > 0 && (
                        <Button size="xs" variant="ghost" className="self-start sm:self-auto" onClick={() => setRestoreTarget(s)}>
                          <RotateCcw />
                          Restore
                        </Button>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <EmptyState compact title="No snapshots yet" body="The first scheduled snapshot runs on the first of next month." />
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 min-w-0 content-start gap-4">
          <BackupCard snapshots={snapshots} />
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
              <FileArchive className="size-4 text-muted" />
              Export all client data
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              One ZIP with every document version, access logs, reviewers and requests, and the package JSON history. Use it when Northwind leaves the
              service or asks for its records.
            </p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setExportOpen(true)}>
              Start export
            </Button>
          </Card>
        </div>
      </div>

      <SnapshotDialog open={snapOpen} onOpenChange={setSnapOpen} />
      <RestoreDialog target={restoreTarget} onClose={() => setRestoreTarget(null)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </motion.div>
  );
}

/* ───────── Take snapshot, optionally notify subscribers ───────── */

function defaultLabel() {
  return `Package snapshot, ${fmt.date(new Date(nowMs()).toISOString())}`;
}

function SnapshotDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const takeSnapshot = useTrust((s) => s.takeSnapshot);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const upsert = useTrust((s) => s.upsert);
  const docs = useTrust((s) => s.documents);
  const pkg = useTrust((s) => s.pkg);
  const subscribers = useTrust((s) => s.subscribers);
  const reviewers = useTrust((s) => s.reviewers);
  const [label, setLabel] = React.useState("");
  const [publish, setPublish] = React.useState(true);
  const [notify, setNotify] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Same rule the store uses for reviewer-only package notices: confirmed subscribers who follow document updates and have reviewer access.
  const recipients = React.useMemo(
    () => subscribers.filter((x) => x.status === "confirmed" && (x.topics.includes("documents") || x.topics.includes("changes")) && reviewers.some((r) => r.handle === x.email)),
    [subscribers, reviewers],
  );
  const restricted = docs.filter((d) => d.visibility === "restricted").length;
  const name = label.trim() || defaultLabel();
  const title = `Package snapshot sealed: ${name}`;
  const body = `Northwind sealed ${docs.length} published documents (${restricted} restricted) and package JSON revision ${pkg.revision}. Each file's checksum is recorded, so you can confirm that what you downloaded matches this snapshot.`;

  const reset = () => {
    setLabel("");
    setPublish(true);
    setNotify(true);
    setTouched(false);
  };

  const confirm = () => {
    setTouched(true);
    if (label.trim().length > 0 && label.trim().length < 4) return;
    setBusy(true);
    setTimeout(() => {
      takeSnapshot(name);
      let sent = 0;
      if (publish) {
        const u = publishUpdate({ kind: "general", title, body, at: new Date().toISOString(), status: "published", audience: "reviewers" });
        if (notify) sent = u.recipients;
        else upsert("updates", { ...u, recipients: 0 });
      }
      setBusy(false);
      onOpenChange(false);
      setTimeout(reset, 200);
      toast.success("Snapshot taken", {
        description: publish
          ? notify
            ? `${docs.length} documents sealed. Notice emailed to ${sent} ${sent === 1 ? "subscriber" : "subscribers"}.`
            : `${docs.length} documents sealed. Notice posted to the updates feed without email.`
          : `${docs.length} documents and the package JSON sealed. The JSON diff now compares against this snapshot.`,
      });
    }, 700);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader
          title="Take a snapshot"
          description="Seals every published document, its versions and the package JSON as they are right now. The JSON diff then compares against this snapshot."
        />
        <DialogBody className="grid grid-cols-1 gap-5">
          <Field label="Label" htmlFor="snap-label" optional error={touched && label.trim().length > 0 && label.trim().length < 4 ? "Use at least 4 characters, or leave it blank." : undefined}>
            <Input id="snap-label" value={label} placeholder={defaultLabel()} onChange={(e) => setLabel(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-3 rounded-[10px] border border-line p-4">
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={publish} onCheckedChange={(v) => setPublish(!!v)} className="mt-0.5" aria-label="Publish as a package update" />
              <span>
                <span className="block text-[13.5px] font-medium text-fg">Publish as a package update</span>
                <span className="block text-[12.5px] text-muted">Adds a notice to the updates feed for approved reviewers.</span>
              </span>
            </label>
            <label className={cn("flex items-start gap-2.5", publish ? "cursor-pointer" : "cursor-not-allowed opacity-50")}>
              <Checkbox checked={publish && notify} disabled={!publish} onCheckedChange={(v) => setNotify(!!v)} className="mt-0.5" aria-label="Notify subscribers" />
              <span>
                <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-fg">
                  Notify subscribers
                  <Badge tone="neutral">
                    <BellRing /> {recipients.length} {recipients.length === 1 ? "recipient" : "recipients"}
                  </Badge>
                </span>
                <span className="block text-[12.5px] text-muted">Confirmed subscribers who follow document or package changes and have reviewer access.</span>
              </span>
            </label>
          </div>

          {publish && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
                <Mail className="size-3.5" /> Notice preview
              </div>
              <div className="rounded-[10px] border border-line bg-raised p-4 dark:bg-transparent">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">Announcement</Badge>
                  <span className="text-[11.5px] text-faint">Approved reviewers only</span>
                </div>
                <div className="mt-2 text-[14px] font-medium text-fg">{title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} loading={busy}>
            <Camera />
            {publish && notify ? `Take snapshot and notify ${recipients.length}` : "Take snapshot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackupCard({ snapshots }: { snapshots: Snapshot[] }) {
  const latest = snapshots[0];
  const next = startOfMonth(addMonths(new Date(), 1));
  next.setHours(2, 0, 0, 0);
  const totalMb = snapshots.reduce((a, s) => a + s.sizeMb, 0);
  const rows = [
    { k: "Last snapshot", v: latest ? fmt.ago(latest.createdAt) : "None yet" },
    { k: "Next scheduled", v: fmt.dateTime(next.toISOString()) },
    { k: "Storage", v: "Encrypted, two US regions" },
    { k: "Retention", v: "Snapshots kept for 7 years" },
    { k: "Total size", v: `${(totalMb / 1024).toFixed(2)} GB` },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <History className="size-4 text-muted" />
          Backup status
        </div>
        <Badge tone="success">
          <ShieldCheck />
          Healthy
        </Badge>
      </div>
      <dl className="mt-3 divide-y divide-line px-4 sm:px-5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[12.5px] text-muted">{r.k}</dt>
            <dd className="text-right text-[13px] font-medium text-fg">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line bg-raised px-4 py-3 text-[12px] leading-relaxed text-muted sm:px-5 dark:bg-transparent">
        Each snapshot&apos;s checksum is recorded when it is sealed, so a restore can prove the files are unchanged.
      </p>
    </Card>
  );
}

function RestoreDialog({ target, onClose }: { target: Snapshot | null; onClose: () => void }) {
  const restore = useTrust((s) => s.restoreSnapshot);
  const [shown, setShown] = React.useState<Snapshot | null>(target);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (target && target !== shown) {
    setShown(target);
    setTyped("");
  }
  const s = target ?? shown;
  const ok = typed.trim() === CONFIRM_TEXT;

  const confirm = () => {
    if (!s || !ok) return;
    setBusy(true);
    setTimeout(() => {
      restore(s.id);
      setBusy(false);
      onClose();
      toast.success("Restore queued", {
        description: `Published documents and the package JSON will match "${s.label}" within a few minutes. A safety snapshot was taken first.`,
      });
    }, 800);
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent size="md">
        <DialogHeader
          title="Restore this snapshot?"
          description={s ? `${s.label}, sealed ${fmt.dateTime(s.createdAt)}.` : undefined}
        />
        <DialogBody className="grid grid-cols-1 gap-4">
          <ul className="grid grid-cols-1 gap-2 rounded-[8px] border border-line bg-raised p-3 text-[13px] leading-relaxed text-fg">
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
              Published documents and the package JSON are replaced with this snapshot&apos;s {s?.documents ?? 0} documents.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
              A safety snapshot of the current state is taken first, so you can undo the restore.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
              Access logs, reviewers and API keys are not changed.
            </li>
          </ul>
          <Field label={<>Type <span className="font-mono">{CONFIRM_TEXT}</span> to confirm</>} htmlFor="restore-confirm">
            <Input id="restore-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={CONFIRM_TEXT} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!ok} loading={busy}>
            Restore snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EXPORT_PARTS = [
  { id: "docs", label: "Documents and every version", mb: 412 },
  { id: "logs", label: "Access logs, last 6 months", mb: 18 },
  { id: "reviewers", label: "Reviewers, requests and approval history", mb: 2 },
  { id: "json", label: "Package JSON history and snapshots", mb: 6 },
];

const STEPS = ["Packaging documents", "Adding access logs", "Adding reviewers and requests", "Adding package JSON history", "Encrypting the archive"];

function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [parts, setParts] = React.useState<string[]>(EXPORT_PARTS.map((p) => p.id));
  const [phase, setPhase] = React.useState<"pick" | "run" | "done">("pick");
  const [progress, setProgress] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizeMb = EXPORT_PARTS.filter((p) => parts.includes(p.id)).reduce((a, p) => a + p.mb, 0);
  const fileName = `northwind-cloud-export-${fmt.iso(new Date().toISOString())}.zip`;

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => stop, []);

  const reset = () => {
    stop();
    setPhase("pick");
    setProgress(0);
    setParts(EXPORT_PARTS.map((p) => p.id));
  };

  const start = () => {
    setPhase("run");
    setProgress(0);
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + 6 + Math.random() * 9);
      setProgress(p);
      if (p < 100) timer.current = setTimeout(tick, 110 + Math.random() * 60);
      else
        timer.current = setTimeout(() => {
          setPhase("done");
          toast.success("Export ready", { description: `${fileName} · ${sizeMb} MB` });
        }, 250);
    };
    timer.current = setTimeout(tick, 120);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        // A running export keeps going in the background and toasts when it's ready.
        if (!v && phase !== "run") setTimeout(reset, 200);
      }}
    >
      <DialogContent size="md">
        <DialogHeader
          title={phase === "done" ? "Export ready" : "Export all client data"}
          description={
            phase === "done"
              ? "The archive is encrypted. The download link works for 24 hours and is logged."
              : "Builds one encrypted ZIP of Northwind's trust center data. Large exports take a few minutes; you can close this window."
          }
        />
        <DialogBody>
          {phase === "pick" && (
            <div className="grid grid-cols-1 gap-2">
              {EXPORT_PARTS.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] border border-line bg-raised px-3 py-2.5 transition-colors hover:border-line-strong">
                  <Checkbox
                    checked={parts.includes(p.id)}
                    aria-label={p.label}
                    onCheckedChange={(v) => setParts((cur) => (v ? [...cur, p.id] : cur.filter((x) => x !== p.id)))}
                  />
                  <span className="min-w-0 flex-1 text-[13px] text-fg">{p.label}</span>
                  <span className="shrink-0 text-[12px] text-muted">~{p.mb} MB</span>
                </label>
              ))}
              <p className="mt-1 text-[12.5px] text-muted">Estimated size {sizeMb} MB</p>
            </div>
          )}
          {phase === "run" && (
            <div className="py-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-fg">{STEPS[Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length))]}</span>
                <span className="text-muted">{Math.round(progress)}%</span>
              </div>
              <ProgressBar value={progress} className="mt-2.5" label="Export progress" />
            </div>
          )}
          {phase === "done" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-[10px] border border-line bg-raised p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[9px] bg-success-soft text-success-fg">
                <FileArchive className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12.5px] text-fg">{fileName}</div>
                <div className="text-[12px] text-muted">
                  {sizeMb} MB · AES-256 · expires {expiresIn24h()}
                </div>
              </div>
            </motion.div>
          )}
        </DialogBody>
        <DialogFooter>
          {phase === "pick" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={start} disabled={!parts.length}>
                Start export
              </Button>
            </>
          )}
          {phase === "run" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Run in background
            </Button>
          )}
          {phase === "done" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => toast.success(`Downloading ${fileName}`, { description: "Demo files are placeholders." })}
              >
                <Download />
                Download
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
