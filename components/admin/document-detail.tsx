"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Download, ExternalLink, Eye, FilePlus2, Globe2, LockKeyhole, Workflow } from "lucide-react";
import { EmptyState, FileIcon, VisibilityBadge } from "@/components/kit/bits";
import { Dropzone, Timeline, type UploadedFile } from "@/components/kit/widgets";
import { DocViewer } from "@/components/kit/doc-viewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Meta, Avatar } from "@/components/ui/display";
import { Select } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { CATEGORY_LABEL, PRACTICES } from "@/lib/mock/catalog";
import { useReady } from "@/lib/hooks";
import { effectiveStatus, useTrust } from "@/lib/store";
import { isDownload, isView } from "@/lib/analytics";
import type { TrustDocument } from "@/lib/types";
import { fmt, nowMs } from "@/lib/utils";
import { ACTION_LABEL, PageSkeleton, agencyShort, reviewerOrg } from "./common";

export function DocumentDetail({ id }: { id: string }) {
  const ready = useReady();
  const doc = useTrust((s) => s.documents.find((d) => d.id === id));
  if (!ready) return <PageSkeleton stats={0} />;
  if (!doc)
    return (
      <div className="card">
        <EmptyState
          title="Document not found"
          body="It may have been removed, or the demo data was reset."
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/admin/documents">Back to documents</Link>
            </Button>
          }
        />
      </div>
    );
  return <Body doc={doc} />;
}

function nextVersion(v: string) {
  const [maj = "1", min = "0"] = v.split(".");
  return `${maj}.${Number(min) + 1}`;
}

function Body({ doc }: { doc: TrustDocument }) {
  const logs = useTrust((s) => s.logs);
  const reviewers = useTrust((s) => s.reviewers);
  const setVisibility = useTrust((s) => s.setVisibility);
  // Watermark preview uses a real active reviewer, so admins see exactly what a download looks like.
  const sampleViewer = React.useMemo(() => {
    const r = reviewers.find((x) => x.kind === "person" && effectiveStatus(x) === "active");
    return r ? { name: r.name, organization: reviewerOrg(r) } : { name: "Reviewer name", organization: "Agency" };
  }, [reviewers]);
  const [version, setVersion] = React.useState(doc.versions[0]!.version);
  const [newOpen, setNewOpen] = React.useState(false);
  const v = doc.versions.find((x) => x.version === version) ?? doc.versions[0]!;
  const latest = doc.versions[0]!;

  const activity = React.useMemo(() => logs.filter((e) => e.docId === doc.id), [logs, doc.id]);
  const last30 = activity.filter((e) => nowMs() - new Date(e.at).getTime() < 30 * 86400000);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <Link href="/admin/documents" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Documents
      </Link>
      <div className="mt-3 flex flex-col gap-4 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <FileIcon kind={doc.kind} size={44} className="mt-1 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="font-serif text-[30px] leading-[1.1] text-fg sm:text-[34px]">{doc.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <VisibilityBadge value={doc.visibility} />
              <Badge tone="neutral">{CATEGORY_LABEL[doc.category]}</Badge>
              <Badge tone={doc.source === "workspace" ? "brand" : "neutral"}>
                <Workflow />
                {doc.source === "workspace" ? "Approved in SecureKnots Workspace" : "Uploaded in Trust"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">{doc.summary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const to = doc.visibility === "public" ? "restricted" : "public";
              setVisibility([doc.id], to);
              toast.success(`Now ${to}`, { description: "Regenerate the package JSON to publish the change." });
            }}
          >
            {doc.visibility === "public" ? <LockKeyhole /> : <Globe2 />}
            Make {doc.visibility === "public" ? "restricted" : "public"}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/t/northwind#documents">
              <ExternalLink />
              Trust page
            </Link>
          </Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <FilePlus2 />
            New version
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Eye className="size-4" /> Preview
              {v.version !== latest.version && <Badge tone="warning">Older version</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Select
                size="sm"
                ariaLabel="Version"
                className="w-[150px]"
                value={version}
                onValueChange={setVersion}
                options={doc.versions.map((x, i) => ({ value: x.version, label: `v${x.version}${i === 0 ? " (current)" : ""}` }))}
              />
              <Button size="sm" variant="secondary" onClick={() => toast.success(`Downloading v${v.version}`, { description: `${doc.kind.toUpperCase()} · ${fmt.size(v.sizeKb)}. Demo files are placeholders.` })}>
                <Download />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <DocViewer
              className="h-[560px] md:h-[720px]"
              doc={doc}
              version={v.version}
              viewer={sampleViewer}
              watermarkDefault={false}
              watermarkLabel="Preview as reviewer"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 min-w-0 content-start gap-4">
          <Card className="p-4 sm:p-5">
            <Meta
              items={[
                { label: "Current version", value: <span className="font-mono">v{latest.version}</span> },
                { label: "Last updated", value: fmt.date(latest.publishedAt) },
                { label: "Owner", value: latest.author },
                { label: "Size", value: `${latest.pages} pages · ${fmt.size(latest.sizeKb)}` },
                { label: "Word count", value: fmt.num(latest.words) },
                { label: "Last 30 days", value: `${last30.filter(isView).length} views · ${last30.filter(isDownload).length} downloads` },
              ]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-[12px] text-muted">FedRAMP practices</div>
              {doc.practices.length ? (
                <ul className="mt-2 grid grid-cols-1 gap-1.5">
                  {doc.practices.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[13px]">
                      <span className="rounded-[5px] bg-brand-soft px-1.5 py-0.5 font-mono text-[11px] text-brand-ink">{p}</span>
                      <span className="text-muted">{PRACTICES.find((x) => x.id === p)?.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13px] text-faint">Not linked to a KSI family.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Version history" description={`${doc.versions.length} ${doc.versions.length === 1 ? "version" : "versions"}; reviewers can open any of them`} />
            <div className="px-4 pb-5 pt-4 sm:px-5">
              <Timeline
                items={doc.versions.map((x, i) => ({
                  id: x.version,
                  current: i === 0,
                  tone: i === 0 ? "brand" : "neutral",
                  title: (
                    <button className="font-mono text-[13px] hover:text-brand-ink" onClick={() => setVersion(x.version)}>
                      v{x.version}
                      {x.version === version && <span className="ml-2 font-sans text-[11.5px] font-normal text-brand-ink">Previewing</span>}
                    </button>
                  ),
                  meta: fmt.date(x.publishedAt),
                  body: (
                    <>
                      {x.note}
                      <span className="mt-0.5 block text-[12px] text-faint">
                        {x.author} · {fmt.num(x.words)} words
                      </span>
                    </>
                  ),
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent access" description="Who opened this document" />
            <ul className="px-2 pb-2 pt-2 sm:px-3">
              {activity.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-[8px] px-2 py-2">
                  <Avatar name={e.actor} size={26} square={e.actorKind === "system"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-fg">
                      <span className="font-medium">{e.actor}</span> <span className="text-muted">{ACTION_LABEL[e.action].toLowerCase()}</span>
                    </div>
                    <div className="text-[12px] text-muted">
                      {agencyShort(e.agencyId)} · {fmt.ago(e.at)}
                    </div>
                  </div>
                </li>
              ))}
              {!activity.length && <li className="px-2 py-3 text-[13px] text-muted">No one has opened this document yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
      <NewVersionDialog doc={doc} open={newOpen} onOpenChange={setNewOpen} onDone={(ver) => setVersion(ver)} />
    </motion.div>
  );
}

function NewVersionDialog({ doc, open, onOpenChange, onDone }: { doc: TrustDocument; open: boolean; onOpenChange: (v: boolean) => void; onDone: (v: string) => void }) {
  const addVersion = useTrust((s) => s.addVersion);
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [ver, setVer] = React.useState(nextVersion(doc.versions[0]!.version));
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const valid = !!file && note.trim().length > 4 && /^\d+(\.\d+)*$/.test(ver) && !doc.versions.some((x) => x.version === ver);
  const reset = () => {
    setFile(null);
    setVer(nextVersion(doc.versions[0]!.version));
    setNote("");
    setTouched(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
        else reset();
      }}
    >
      <DialogContent>
        <DialogHeader title={`New version of ${doc.title}`} description="Reviewers see the new version first; older versions stay available in the version picker." />
        <DialogBody className="grid grid-cols-1 gap-4">
          <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} />
          {touched && !file && <p className="-mt-2 text-[12.5px] text-danger-fg">Upload the file first.</p>}
          <Field label="Version" htmlFor="nv-ver" error={touched && doc.versions.some((x) => x.version === ver) ? "That version already exists." : undefined}>
            <Input id="nv-ver" value={ver} onChange={(e) => setVer(e.target.value)} className="font-mono" />
          </Field>
          <Field label="What changed" htmlFor="nv-note" error={touched && note.trim().length <= 4 ? "Describe the change in a few words." : undefined}>
            <Textarea id="nv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: closed 2 findings and added 1 from November scanning" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!valid || !file) return;
              addVersion(doc.id, { version: ver, note: note.trim(), date: new Date().toISOString(), words: Math.round(doc.versions[0]!.words * 1.03), sizeKb: file.sizeKb });
              onOpenChange(false);
              onDone(ver);
              toast.success(`Published v${ver}`, { description: "Regenerate the package JSON so agencies' systems pick it up." });
            }}
          >
            Publish version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
