"use client";

import * as React from "react";
import { Command } from "cmdk";
import { toast } from "sonner";
import { Check, ChevronDown, Globe2, LockKeyhole, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented, Select } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { Dropzone, type UploadedFile } from "@/components/kit/widgets";
import { CATEGORY_LABEL, PRACTICES } from "@/lib/mock/catalog";
import { useTrust } from "@/lib/store";
import { useUi } from "@/lib/ui";
import type { DocCategory, Visibility } from "@/lib/types";
import { cn, fakeHash, sleep } from "@/lib/utils";
import { KIND_LABEL, detect, excerptFor, type Excerpt, type RedactionFinding } from "@/lib/redaction";

const SAMPLE = "Supply-Chain-Risk-Management-Plan.pdf";

function titleFromFile(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function PracticesSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="grid grid-cols-1 gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-[8px] border border-line-strong bg-surface px-3 text-left text-[13.5px] shadow-xs outline-none hover:bg-raised focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--ring)] dark:bg-raised"
          >
            <span className={value.length ? "text-fg" : "text-faint"}>{value.length ? `${value.length} selected` : "Select Key Security Indicators"}</span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px]">
          <Command>
            <Command.Input placeholder="Search KSI families" className="h-10 w-full border-b border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-faint" />
            <Command.List className="scroll-thin max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">No match</Command.Empty>
              {PRACTICES.map((p) => {
                const on = value.includes(p.id);
                return (
                  <Command.Item
                    key={p.id}
                    value={`${p.id} ${p.name}`}
                    onSelect={() => toggle(p.id)}
                    className="flex h-9 cursor-default items-center gap-2.5 rounded-[6px] px-2 text-[13px] text-fg outline-none data-[selected=true]:bg-subtle"
                  >
                    <span className={cn("grid size-4 place-items-center rounded-[4px] border", on ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="font-mono text-[12px]">{p.id}</span>
                    <span className="truncate text-muted">{p.name}</span>
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-soft pl-2 pr-1 font-mono text-[11.5px] text-brand-ink">
              {id}
              <button type="button" aria-label={`Remove ${id}`} onClick={() => toggle(id)} className="grid size-4 place-items-center rounded-full hover:bg-brand/15">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function UploadDrawer({ onPublished }: { onPublished?: (id: string) => void }) {
  const router = useRouter();
  const open = useUi((s) => s.uploadOpen);
  const setUi = useUi((s) => s.set);
  const upload = useTrust((s) => s.uploadDocument);
  const regenerate = useTrust((s) => s.regeneratePackage);
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [f, setF] = React.useState({ title: "", summary: "", category: "policies" as DocCategory, version: "1.0", date: today(), visibility: "restricted" as Visibility, practices: [] as string[] });
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setFile(null);
    setF({ title: "", summary: "", category: "policies", version: "1.0", date: today(), visibility: "restricted", practices: [] });
    setTouched(false);
    setAnalysis({ step: -1, result: null });
    setRedact({});
  };

  const [analysis, setAnalysis] = React.useState<{ step: number; result: Analysis | null }>({ step: -1, result: null });
  // Finding id -> true to redact (the default), false to keep.
  const [redact, setRedact] = React.useState<Record<string, boolean>>({});

  const onFile = async (uf: UploadedFile) => {
    setFile(uf);
    const title = titleFromFile(uf.name);
    setF((p) => ({ ...p, title: p.title || title }));
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setAnalysis({ step: i, result: null });
      await sleep(420);
    }
    const result = analyze(uf, title);
    setAnalysis({ step: ANALYSIS_STEPS.length, result });
    setF((p) => ({
      ...p,
      title: p.title || title,
      category: result.category,
      summary: p.summary || (uf.name === SAMPLE ? "How Northwind identifies, assesses and monitors supply chain risk for Workbench components and suppliers." : result.summary),
      practices: result.practices,
      visibility: result.visibility,
    }));
  };

  const errors = {
    file: !file ? "Upload the file first." : "",
    title: f.title.trim().length < 3 ? "Enter a title." : "",
    summary: f.summary.trim().length < 12 ? "Write a one-line summary reviewers will see." : "",
    version: !/^\d+(\.\d+)*$/.test(f.version.trim()) ? "Use a number like 1.0" : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const publish = () => {
    setTouched(true);
    if (!valid || !file) return;
    setBusy(true);
    setTimeout(() => {
      const date = new Date(`${f.date}T${new Date().toTimeString().slice(0, 8)}`);
      const doc = upload({
        title: f.title,
        summary: f.summary,
        category: f.category,
        kind: file.kind,
        version: f.version.trim(),
        date: (isNaN(date.getTime()) ? new Date() : date).toISOString(),
        visibility: f.visibility,
        practices: f.practices,
        words: Math.max(400, Math.round(file.sizeKb * 2.6)),
        sizeKb: file.sizeKb,
      });
      const redacted = analysis.result?.findings.filter((x) => redact[x.id] !== false) ?? [];
      const kept = analysis.result?.findings.filter((x) => redact[x.id] === false) ?? [];
      if (redacted.length) {
        useTrust.getState().addAudit({ action: "Redacted before publishing", target: doc.title, detail: redacted.map((x) => `${KIND_LABEL[x.kind]} on page ${x.page}`).join("; "), category: "documents" });
      }
      if (kept.length) {
        useTrust.getState().addAudit({ action: "Kept flagged text", target: doc.title, detail: kept.map((x) => `${KIND_LABEL[x.kind]} "${x.value}" on page ${x.page}`).join("; "), category: "documents" });
      }
      setBusy(false);
      setUi({ uploadOpen: false });
      setTimeout(reset, 250);
      onPublished?.(doc.id);
      toast.success(`Published ${doc.title}`, {
        description: "It's live on the trust page. The package JSON needs regenerating to include it.",
        action: {
          label: "Regenerate JSON",
          onClick: () => {
            regenerate();
            toast.success("Package JSON regenerated and validated");
            router.push("/admin/machine-readable");
          },
        },
      });
    }, 700);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setUi({ uploadOpen: v });
        if (!v) setTimeout(reset, 250);
      }}
    >
      <SheetContent width={540}>
        <SheetHeader title="Upload document" description="Publishes to Northwind's trust page and the package JSON." />
        <SheetBody className="grid grid-cols-1 content-start gap-5">
          <div>
            <Dropzone file={file} onFile={onFile} onClear={() => { setFile(null); setAnalysis({ step: -1, result: null }); }} />
            {touched && errors.file && <p className="mt-1.5 text-[12.5px] text-danger-fg">{errors.file}</p>}
          </div>
          {file && analysis.step >= 0 && <PrePublishChecks step={analysis.step} result={analysis.result} redact={redact} onRedact={setRedact} />}
          <Field label="Title" htmlFor="up-title" error={touched && errors.title}>
            <Input id="up-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={touched && !!errors.title} />
          </Field>
          <Field label="Summary" htmlFor="up-summary" error={touched && errors.summary} hint="One or two sentences. Shown on the trust page under the title.">
            <Textarea id="up-summary" rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} aria-invalid={touched && !!errors.summary} />
          </Field>
          <Field label="Section">
            <Select
              ariaLabel="Section"
              value={f.category}
              onValueChange={(v) => setF({ ...f, category: v as DocCategory })}
              options={(["package", "reports", "policies"] as DocCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Version" htmlFor="up-version" error={touched && errors.version}>
              <Input id="up-version" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} className="font-mono" aria-invalid={touched && !!errors.version} />
            </Field>
            <Field label="Effective date" htmlFor="up-date">
              <Input id="up-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
          </div>
          <Field
            label="Visibility"
            hint={f.visibility === "public" ? "Anyone can download it from the trust page." : "Only approved reviewers and agency API keys can open it. Downloads are watermarked."}
          >
            <Segmented
              fill
              layoutId="up-vis"
              value={f.visibility}
              onChange={(v) => setF({ ...f, visibility: v })}
              options={[
                { value: "public", label: "Public", icon: <Globe2 /> },
                { value: "restricted", label: "Restricted", icon: <LockKeyhole /> },
              ]}
            />
          </Field>
          <Field label="FedRAMP practices" optional hint="Links the document to Key Security Indicator families in the package JSON.">
            <PracticesSelect value={f.practices} onChange={(practices) => setF({ ...f, practices })} />
          </Field>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" onClick={() => setUi({ uploadOpen: false })}>
            Cancel
          </Button>
          <Button variant="primary" onClick={publish} loading={busy}>
            Publish document
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ───────── Read the document: auto-fill and pre-publish checks ───────── */
type Analysis = {
  category: DocCategory;
  practices: string[];
  visibility: Visibility;
  summary: string;
  excerpt: Excerpt[];
  findings: RedactionFinding[];
  pages: number;
  similar?: string;
};

const ANALYSIS_STEPS = ["Reading pages and text", "Scanning for sensitive data", "Removing hidden metadata", "Tagging section and Key Security Indicators"];

const KSI_KEYWORDS: [RegExp, string][] = [
  [/access|identity|account|mfa|password/i, "KSI-IAM"],
  [/incident|breach|response/i, "KSI-INR"],
  [/vendor|supply|third|subprocessor|supplier/i, "KSI-TPR"],
  [/change|release|deploy/i, "KSI-CMT"],
  [/backup|recover|continuity|disaster/i, "KSI-RPL"],
  [/log|monitor|audit|siem/i, "KSI-MLA"],
  [/training|awareness|education/i, "KSI-CED"],
  [/encrypt|config|vulnerab|scan|harden|key/i, "KSI-SVC"],
  [/architecture|boundary|network|cloud/i, "KSI-CNA"],
  [/inventory|policy|plan|governance|risk/i, "KSI-PIY"],
];

function analyze(uf: UploadedFile, title: string): Analysis {
  const t = `${title} ${uf.name}`;
  const category: DocCategory = /poam|ksi|boundary|matrix|scn|conmon|continuous monitoring|package/i.test(t)
    ? "package"
    : /report|assessment|test|scan|soc|iso|certificate|audit|vpat/i.test(t)
      ? "reports"
      : "policies";
  const practices = Array.from(new Set(KSI_KEYWORDS.filter(([re]) => re.test(t)).map(([, id]) => id))).slice(0, 4);
  const visibility: Visibility = /certificate|soc 3|soc3|acceptable use|retention|vpat|overview/i.test(t) ? "public" : "restricted";
  const lower = title.toLowerCase();
  const summary =
    category === "policies"
      ? `Northwind's ${lower}: scope, who is responsible, the controls it requires and how often it is reviewed.`
      : category === "reports"
        ? `Results of the ${lower}, with scope, method, findings and their status.`
        : `${title} for the FedRAMP 20x package, kept current through continuous monitoring.`;
  const h = parseInt(fakeHash(uf.name, 6), 16);
  const pages = Math.max(3, Math.round(uf.sizeKb / 90));
  const excerpt = excerptFor(h, pages);
  const findings = detect(excerpt);
  const similar = /vendor|supply/i.test(t) ? "Vendor Risk Management Policy (38% overlap; looks like a companion document, not a duplicate)" : undefined;
  return { category, practices: practices.length ? practices : ["KSI-PIY"], visibility, summary, excerpt, findings, pages, similar };
}

function PrePublishChecks({ step, result, redact, onRedact }: { step: number; result: Analysis | null; redact: Record<string, boolean>; onRedact: (v: Record<string, boolean>) => void }) {
  const done = step >= ANALYSIS_STEPS.length && result;
  return (
    <div className="overflow-clip rounded-[10px] border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-raised px-3.5 py-2.5 dark:bg-transparent">
        <span className="text-[13px] font-medium text-fg">{done ? "Read and checked" : "Reading the document"}</span>
        {done && <span className="text-[12px] text-muted">Fields below were filled in for you</span>}
      </div>
      <ul className="grid gap-1.5 px-3.5 py-3">
        {ANALYSIS_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2.5 text-[12.5px]">
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full", i < step || done ? "bg-success text-white dark:text-[#04120f]" : i === step ? "text-fg" : "text-faint")}>
              {i < step || done ? <Check className="size-2.5" strokeWidth={3.5} /> : i === step ? <span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <span className={i <= step || done ? "text-fg" : "text-muted"}>{label}</span>
          </li>
        ))}
      </ul>
      {done && result && (
        <div className="grid grid-cols-1 gap-3 border-t border-line px-3.5 py-3 text-[12.5px]">
          {result.findings.length > 0 ? (
            <RedactionReview excerpt={result.excerpt} findings={result.findings} redact={redact} onRedact={onRedact} />
          ) : (
            <div className="text-success-fg">No sensitive data found.</div>
          )}
          <div className="text-muted">
            Hidden metadata removed: author names, revision history, comments. {result.pages} pages. Suggested section: <span className="font-medium text-fg">{CATEGORY_LABEL[result.category]}</span>, {result.visibility}.
          </div>
          {result.similar && <div className="text-muted">Similar document already published: {result.similar}.</div>}
        </div>
      )}
    </div>
  );
}

/** Every flagged value, highlighted in place, with a redact or keep choice for each. */
function RedactionReview({ excerpt, findings, redact, onRedact }: { excerpt: Excerpt[]; findings: RedactionFinding[]; redact: Record<string, boolean>; onRedact: (v: Record<string, boolean>) => void }) {
  const on = (f: RedactionFinding) => redact[f.id] !== false;
  const count = findings.filter(on).length;
  const setAll = (v: boolean) => onRedact(Object.fromEntries(findings.map((f) => [f.id, v])));
  return (
    <div className="overflow-clip rounded-[8px] border border-warning/40">
      <div className="flex flex-wrap items-center gap-2 bg-warning-soft px-3 py-2">
        <span className="flex-1 font-medium text-warning-fg">
          Found {findings.length} {findings.length === 1 ? "item" : "items"} that should not be shared. {count} will be redacted.
        </span>
        <button type="button" className="text-[12px] font-medium text-fg underline-offset-4 hover:underline" onClick={() => setAll(true)}>
          Redact all
        </button>
        <button type="button" className="text-[12px] font-medium text-fg underline-offset-4 hover:underline" onClick={() => setAll(false)}>
          Keep all
        </button>
      </div>
      <div className="grid gap-2 border-b border-line bg-white px-3 py-2.5 font-serif text-[13.5px] leading-relaxed text-[#1c2436]">
        {excerpt.map((ex, line) => {
          const fs = findings.filter((f) => f.line === line);
          const parts: React.ReactNode[] = [];
          let at = 0;
          for (const f of fs) {
            parts.push(ex.text.slice(at, f.start));
            parts.push(
              <mark
                key={f.id}
                title={`${KIND_LABEL[f.kind]}: ${on(f) ? "will be redacted" : "kept"}`}
                className={cn("rounded-[3px] px-0.5 font-sans text-[12.5px] transition-colors", on(f) ? "bg-[#1c2436] text-transparent [text-shadow:none] selection:bg-transparent" : "bg-[#fde68a] text-[#1c2436]")}
              >
                {f.value}
              </mark>,
            );
            at = f.end;
          }
          parts.push(ex.text.slice(at));
          return (
            <p key={line}>
              <span className="mr-2 font-sans text-[10.5px] text-[#8d929c]">p. {ex.page}</span>
              {parts}
            </p>
          );
        })}
      </div>
      <ul className="divide-y divide-line">
        {findings.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2">
            <span className="w-28 shrink-0 text-[12px] text-muted">{KIND_LABEL[f.kind]}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">{f.value}</code>
            <span className="text-[11.5px] text-faint">p. {f.page}</span>
            <Segmented
              size="sm"
              layoutId={`rd-${f.id}`}
              value={on(f) ? "redact" : "keep"}
              onChange={(v) => onRedact({ ...redact, [f.id]: v === "redact" })}
              options={[
                { value: "redact", label: "Redact" },
                { value: "keep", label: "Keep" },
              ]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
