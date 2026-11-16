"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BadgeCheck, Check, CircleDashed, ExternalLink, FileJson, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { CopyButton, PageHeader } from "@/components/kit/bits";
import { CodeViewer, DiffViewer } from "@/components/kit/code";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/display";
import { Tabs } from "@/components/ui/controls";
import { JSON_PATH } from "@/lib/mock/package";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import { cn, diffLines, fmt, sleep } from "@/lib/utils";
import { PageSkeleton } from "./common";
import { PackageCompleteness } from "./completeness";

type Step = { label: string; detail: string };

export function AdminMachineReadable() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <Body />;
}

function Body() {
  const pkg = useTrust((s) => s.pkg);
  const docs = useTrust((s) => s.documents);
  const host = useTrust((s) => s.domain.host);
  const regenerate = useTrust((s) => s.regeneratePackage);
  const [tab, setTab] = React.useState<"json" | "diff" | "validation">("json");
  const [running, setRunning] = React.useState(false);
  const [stepIdx, setStepIdx] = React.useState(-1);
  const url = `https://${host}${JSON_PATH}`;
  const stale = pkg.status === "stale";

  const steps: Step[] = [
    { label: "Collect published documents", detail: `${docs.length} documents, ${docs.reduce((a, d) => a + d.versions.length, 0)} versions` },
    { label: "Build the package JSON", detail: "Same records the trust page lists" },
    { label: "Validate against the FedRAMP schema", detail: "Required fields, formats and KSI identifiers" },
    { label: "Publish", detail: url },
  ];

  const run = async () => {
    setRunning(true);
    for (let i = 0; i < steps.length; i++) {
      setStepIdx(i);
      await sleep(520 + i * 120);
    }
    regenerate();
    setStepIdx(steps.length);
    toast.success("Package JSON regenerated and validated", { description: `Revision ${useTrust.getState().pkg.revision} is live at the public URL.` });
    await sleep(900);
    setRunning(false);
  };

  const published = React.useMemo(() => {
    try {
      return JSON.parse(pkg.published) as { documents: { id: string; visibility: string; category: string }[] };
    } catch {
      return { documents: [] };
    }
  }, [pkg.published]);
  const inJson = new Set(published.documents.map((d) => d.id));
  const notInJson = docs.filter((d) => !inJson.has(d.id));
  const visMismatch = docs.filter((d) => inJson.has(d.id) && published.documents.find((x) => x.id === d.id)?.visibility !== d.visibility);
  const versionMismatch = docs.filter((d) => {
    const j = (published.documents as { id: string; version?: string }[]).find((x) => x.id === d.id);
    return j && j.version !== d.versions[0]!.version;
  });

  const diff = React.useMemo(() => diffLines(pkg.baseline, pkg.published), [pkg.baseline, pkg.published]);
  const added = diff.filter((l) => l.kind === "add").length;
  const removed = diff.filter((l) => l.kind === "del").length;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        title="Machine-readable"
        description="The Certification Package Overview JSON that agencies' systems read. It's generated from the same documents as the trust page, so the two always match after you regenerate."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/t/northwind#machine-readable">
                <ExternalLink /> As shown publicly
              </Link>
            </Button>
            <Button variant="primary" onClick={run} loading={running}>
              <RefreshCw /> Regenerate & validate
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-[12.5px] font-medium text-muted">Schema validation</div>
          <div className="mt-2.5">
            <AnimatePresence mode="wait" initial={false}>
              {stale ? (
                <motion.div key="stale" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Badge tone="warning" className="h-7 px-2.5 text-[13px]">
                    <TriangleAlert /> Changes not published
                  </Badge>
                </motion.div>
              ) : (
                <motion.div key="valid" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Badge tone="success" className="h-7 px-2.5 text-[13px]">
                    <BadgeCheck /> Valid against FedRAMP schema
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 text-[12px] text-muted">{stale ? "Documents changed after the last run" : "All 9 checks passed"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12.5px] font-medium text-muted">Revision</div>
          <motion.div key={pkg.revision} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">
            {pkg.revision}
          </motion.div>
          <div className="mt-2 text-[12px] text-muted">{fmt.num(pkg.published.length)} bytes, UTF-8</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12.5px] font-medium text-muted">Last generated</div>
          <div className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.015em] text-fg">{fmt.ago(pkg.generatedAt)}</div>
          <div className="mt-2 text-[12px] text-muted">{fmt.dateTime(pkg.generatedAt)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12.5px] font-medium text-muted">Public URL</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" title={url}>
              {host}
              {JSON_PATH}
            </span>
            <CopyButton value={url} iconOnly label="Copy URL" toastText="Public URL copied" />
          </div>
          <div className="mt-2 text-[12px] text-muted">Open to anyone, no key needed</div>
        </Card>
      </div>

      <AnimatePresence>
        {(running || stepIdx === steps.length) && stepIdx >= 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="mt-4 p-4 sm:p-5">
              <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {steps.map((s, i) => {
                  const done = stepIdx > i;
                  const current = stepIdx === i;
                  return (
                    <li key={s.label} className="flex gap-2.5">
                      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", done ? "bg-success text-white dark:text-[#04120f]" : current ? "text-brand-ink" : "text-faint")}>
                        {done ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                            <Check className="size-3" strokeWidth={3} />
                          </motion.span>
                        ) : current ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <CircleDashed className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className={cn("text-[13px] font-medium", done || current ? "text-fg" : "text-muted")}>{s.label}</div>
                        <div className="truncate text-[12px] text-muted">{s.detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <PackageCompleteness onRegenerate={run} busy={running} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="px-4 sm:px-5">
            <Tabs
              layoutId="mr-tabs"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "json", label: "Published JSON" },
                { value: "diff", label: "Changes since last snapshot", count: added + removed || undefined },
                { value: "validation", label: "Validation" },
              ]}
            />
          </div>
          <div className="p-4 sm:p-5">
            {tab === "json" && <CodeViewer code={pkg.published} title={JSON_PATH} maxHeight={560} />}
            {tab === "diff" && (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  Compared with <span className="font-medium text-fg">{pkg.baselineLabel}</span>
                  <span className="font-mono text-[12px] text-success-fg">+{added}</span>
                  <span className="font-mono text-[12px] text-danger-fg">−{removed}</span>
                </div>
                {added + removed === 0 ? (
                  <div className="rounded-[10px] border border-line bg-raised px-4 py-8 text-center text-[13px] text-muted">No changes since that snapshot.</div>
                ) : (
                  <DiffViewer lines={diff} className="max-h-[520px]" />
                )}
              </div>
            )}
            {tab === "validation" && <Validation stale={stale} count={published.documents.length} />}
          </div>
        </Card>

        <Card className="h-fit p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <FileJson className="size-4 text-muted" /> Page and JSON
          </div>
          <p className="mt-1 text-[12.5px] text-muted">Both come from the same document records. This compares what the trust page shows now with the published file.</p>
          <dl className="mt-4 divide-y divide-line text-[13px]">
            <Row label="Documents on the trust page" value={docs.length} />
            <Row label="Documents in the JSON" value={published.documents.length} warn={published.documents.length !== docs.length} />
            <Row label="Version differences" value={versionMismatch.length} warn={versionMismatch.length > 0} />
            <Row label="Visibility differences" value={visMismatch.length} warn={visMismatch.length > 0} />
          </dl>
          {stale ? (
            <div className="mt-4 rounded-[8px] bg-warning-soft p-3 text-[12.5px] text-warning-fg">
              {notInJson.length > 0 && (
                <div>
                  Not in the JSON yet: <span className="font-medium">{notInJson.map((d) => d.title).join(", ")}</span>.
                </div>
              )}
              {(versionMismatch.length > 0 || visMismatch.length > 0) && <div>Some documents changed version or visibility.</div>}
              {notInJson.length === 0 && versionMismatch.length === 0 && visMismatch.length === 0 && <div>The domain or settings changed since the last run.</div>}
              <Button size="sm" variant="secondary" className="mt-2.5" onClick={run} loading={running}>
                Regenerate now
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-[8px] bg-success-soft p-3 text-[12.5px] text-success-fg">
              <BadgeCheck className="size-4 shrink-0" /> The trust page and the JSON match.
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}

function Row({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-medium", warn ? "text-warning-fg" : "text-fg")}>{value}</dd>
    </div>
  );
}

function Validation({ stale, count }: { stale: boolean; count: number }) {
  const checks = [
    "Matches the Certification Package Overview schema (version 1.0)",
    "Provider, offering and certification fields are present",
    "Certification class and status use allowed values",
    "Dates use ISO 8601 (YYYY-MM-DD)",
    `${count} documents each have an id, version, URL and SHA-256 hash`,
    "Every practice uses a valid KSI family identifier",
    "Visibility is public or restricted for every document",
    "Restricted document URLs require an approved reviewer or API key",
    "Contacts include a security and a vulnerability disclosure address",
  ];
  return (
    <div>
      {stale && (
        <div className="mb-3 rounded-[8px] bg-warning-soft px-3 py-2 text-[12.5px] text-warning-fg">
          These results are for the published revision. Regenerate to validate the latest changes.
        </div>
      )}
      <ul className="grid grid-cols-1 gap-1">
        {checks.map((c) => (
          <li key={c} className="flex items-start gap-2.5 rounded-[8px] px-2 py-2 text-[13px] text-fg hover:bg-raised">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success text-white dark:text-[#04120f]">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted">In this demo the checks show their states; the production build validates with the published FedRAMP JSON schema.</p>
    </div>
  );
}
