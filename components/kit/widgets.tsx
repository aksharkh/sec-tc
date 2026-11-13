"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, CloudUpload, FileCheck2 } from "lucide-react";
import { cn, fmt } from "@/lib/utils";
import type { FileKind, TrustDocument } from "@/lib/types";
import { ProgressBar } from "@/components/ui/display";
import { FileIcon } from "./bits";

/* ───────── Sparkline (SVG, 12+ points) ───────── */
export function Sparkline({ values, className, height = 32 }: { values: number[]; className?: string; height?: number }) {
  const w = 120;
  const h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const split = Math.max(1, pts.length - 4);
  const dPrev = pts.slice(0, split + 1).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dCur = pts.slice(split).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="var(--chart-1)" opacity={0.08} />
      <path d={dPrev} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={dCur} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs prior 30d",
  upIsGood = true,
  trend,
  icon,
  footer,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: number[];
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const good = delta === undefined ? null : delta === 0 ? null : delta > 0 === upIsGood;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        {icon && <span className="text-faint [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">{value}</div>
          {delta !== undefined ? (
            <div className="mt-2 flex items-center gap-1 text-[12px] text-muted">
              <span className={cn("inline-flex items-center gap-0.5 font-medium", good === true && "text-success-fg", good === false && "text-danger-fg")}>
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(delta).toFixed(0)}%
              </span>
              <span className="truncate">{deltaLabel}</span>
            </div>
          ) : (
            footer && <div className="mt-2 text-[12px] text-muted">{footer}</div>
          )}
        </div>
        {trend && (
          <div className="w-[42%] max-w-[120px] shrink-0">
            <Sparkline values={trend} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Timeline ───────── */
export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "success" | "neutral" | "warning";
  current?: boolean;
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.li
            key={it.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {i < items.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-20px)] w-px bg-line-strong" aria-hidden />}
            <span
              className={cn(
                "relative z-[1] mt-0.5 grid size-[23px] shrink-0 place-items-center rounded-full border bg-surface [&_svg]:size-3",
                it.tone === "brand" && "border-brand/40 text-brand-ink",
                it.tone === "success" && "border-success/40 text-success-fg",
                it.tone === "warning" && "border-warning/50 text-warning-fg",
                (!it.tone || it.tone === "neutral") && "border-line-strong text-muted",
                it.current && "bg-brand text-brand-fg border-brand",
              )}
            >
              {it.icon ?? <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <div className="text-[13.5px] font-medium text-fg">{it.title}</div>
                {it.meta && <div className="text-[12px] text-muted">{it.meta}</div>}
              </div>
              {it.body && <div className="mt-1 text-[13px] leading-relaxed text-muted">{it.body}</div>}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/* ───────── Document preview (paper page) ───────── */
export function DocPreview({
  doc,
  version,
  watermark,
  tenantName = "Northwind Cloud",
  className,
}: {
  doc: TrustDocument;
  version?: string;
  watermark?: string;
  tenantName?: string;
  className?: string;
}) {
  const v = doc.versions.find((x) => x.version === version) ?? doc.versions[0]!;
  const widths = [96, 88, 92, 70, 0, 94, 86, 90, 62, 0, 90, 95, 78];
  return (
    <div className={cn("@container relative mx-auto aspect-[8.5/11] w-full max-w-[440px] overflow-hidden rounded-[4px] paper", className)}>
      <div className="absolute inset-0 flex flex-col p-[8%] text-[#1c2436]">
        <div className="flex items-center justify-between border-b border-[#1c2436]/15 pb-[3%] text-[clamp(7px,1.9cqw,10px)]">
          <span className="font-semibold tracking-wide">{tenantName.toUpperCase()}</span>
          <span className="font-mono text-[#1c2436]/60">v{v.version} · {fmt.iso(v.publishedAt)}</span>
        </div>
        <div className="mt-[7%] font-serif text-[clamp(16px,5.2cqw,26px)] leading-[1.08]">{doc.title}</div>
        <div className="mt-[3%] text-[clamp(7px,2cqw,10.5px)] leading-snug text-[#1c2436]/70">{doc.summary}</div>
        <div className="mt-[6%] grid grid-cols-3 gap-[3%] border-y border-[#1c2436]/12 py-[3%] text-[clamp(6.5px,1.7cqw,9px)]">
          <div>
            <div className="text-[#1c2436]/50">Classification</div>
            <div className="font-medium">{doc.visibility === "public" ? "Public" : "Controlled"}</div>
          </div>
          <div>
            <div className="text-[#1c2436]/50">Owner</div>
            <div className="truncate font-medium">{v.author}</div>
          </div>
          <div>
            <div className="text-[#1c2436]/50">Pages</div>
            <div className="font-medium">{v.pages}</div>
          </div>
        </div>
        <div className="mt-[6%] space-y-[2.2%]">
          <div className="h-[1.6%] min-h-[5px] w-[38%] rounded-sm bg-[#1c2436]/70" />
          {widths.map((w, i) =>
            w === 0 ? (
              <div key={i} className="h-[1.2%]" />
            ) : (
              <div key={i} className="h-[1.1%] min-h-[3px] rounded-sm bg-[#1c2436]/14" style={{ width: `${w}%` }} />
            ),
          )}
        </div>
        <div className="mt-auto flex justify-between pt-[4%] text-[clamp(6px,1.6cqw,8.5px)] text-[#1c2436]/45">
          <span>{doc.visibility === "public" ? "Public document" : "Restricted. Shared through SecureKnots Trust."}</span>
          <span>1 / {v.pages}</span>
        </div>
      </div>
      {watermark && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
          <div className="-rotate-[28deg] whitespace-nowrap text-center font-medium text-[#1c2436]/[0.11] [font-size:clamp(9px,3cqw,15px)]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-[6%]">
                {watermark} · {watermark}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Dropzone with simulated upload ───────── */
export type UploadedFile = { name: string; sizeKb: number; kind: FileKind };

export function kindFromName(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "json") return "json";
  if (ext === "zip") return "zip";
  return "pdf";
}

export function Dropzone({
  file,
  onFile,
  onClear,
  accept = ".pdf,.docx,.xlsx,.json,.zip",
}: {
  file: UploadedFile | null;
  onFile: (f: UploadedFile) => void;
  onClear: () => void;
  accept?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pending, setPending] = React.useState<UploadedFile | null>(null);

  const start = (f: File | { name: string; size: number }) => {
    const uf: UploadedFile = { name: f.name, sizeKb: Math.max(12, Math.round(f.size / 1024)), kind: kindFromName(f.name) };
    setPending(uf);
    setProgress(0);
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + 9 + Math.random() * 18);
      setProgress(p);
      if (p < 100) setTimeout(tick, 120 + Math.random() * 120);
      else
        setTimeout(() => {
          setPending(null);
          onFile(uf);
        }, 220);
    };
    setTimeout(tick, 150);
  };

  if (file && !pending) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-raised p-3">
        <FileIcon kind={file.kind} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-fg">{file.name}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-success-fg">
            <FileCheck2 className="size-3.5" /> Uploaded · {fmt.size(file.sizeKb)} · virus scan passed
          </div>
        </div>
        <button onClick={onClear} className="rounded-[7px] px-2 py-1 text-[12.5px] font-medium text-muted hover:bg-subtle hover:text-fg">
          Replace
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="rounded-[10px] border border-line bg-raised p-3">
        <div className="flex items-center gap-3">
          <FileIcon kind={pending.kind} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium text-fg">{pending.name}</div>
            <div className="text-[12px] text-muted">{progress < 100 ? `Uploading · ${Math.round(progress)}%` : "Scanning for malware"}</div>
          </div>
        </div>
        <ProgressBar value={progress} className="mt-3" label="Upload progress" />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) start(f);
      }}
      className={cn(
        "relative flex flex-col items-center rounded-[10px] border border-dashed px-4 py-7 text-center transition-colors",
        over ? "border-brand bg-brand-soft/60" : "border-line-strong bg-raised hover:bg-subtle/60",
      )}
    >
      <span className="grid size-10 place-items-center rounded-full border border-line bg-surface shadow-xs">
        <CloudUpload className="size-[18px] text-muted" />
      </span>
      <p className="mt-3 text-[13.5px] font-medium text-fg">Drop a file here, or <button type="button" onClick={() => inputRef.current?.click()} className="text-brand-ink underline-offset-4 hover:underline">browse</button></p>
      <p className="mt-1 text-[12px] text-muted">PDF, DOCX, XLSX, JSON or ZIP, up to 200 MB</p>
      <button
        type="button"
        onClick={() => start({ name: "Supply-Chain-Risk-Management-Plan.pdf", size: 1_240_000 })}
        className="mt-3 text-[12px] font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-fg"
      >
        Use a sample file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) start(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
