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
import { cn } from "@/lib/utils";

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
  };

  const onFile = (uf: UploadedFile) => {
    setFile(uf);
    setF((p) => ({
      ...p,
      title: p.title || titleFromFile(uf.name),
      ...(uf.name === SAMPLE && !p.summary
        ? { summary: "How Northwind identifies, assesses and monitors supply chain risk for Workbench components and suppliers.", practices: ["KSI-TPR", "KSI-PIY"] }
        : {}),
      category: uf.kind === "xlsx" ? "package" : p.category,
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
            <Dropzone file={file} onFile={onFile} onClear={() => setFile(null)} />
            {touched && errors.file && <p className="mt-1.5 text-[12.5px] text-danger-fg">{errors.file}</p>}
          </div>
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
