"use client";

import * as React from "react";
import { Check, Copy, Globe2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { SecureKnotsLogo } from "@/components/brand/SecureKnotsLogo";
import type { FileKind, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/menu";

/* ───────── Page header ───────── */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12.5px] text-muted">{eyebrow}</div>}
        <h1 className="font-serif text-[30px] leading-[1.1] tracking-[-0.01em] text-fg sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───────── Copy button ───────── */
export function CopyButton({
  value,
  label = "Copy",
  className,
  toastText,
  iconOnly,
}: {
  value: string;
  label?: string;
  className?: string;
  toastText?: string;
  iconOnly?: boolean;
}) {
  const [done, setDone] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard can be blocked in previews; the toast still confirms the action */
    }
    setDone(true);
    if (toastText) toast.success(toastText);
    setTimeout(() => setDone(false), 1400);
  };
  const btn = (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-line-strong bg-surface px-2 text-[12px] font-medium text-muted shadow-xs transition-colors hover:bg-raised hover:text-fg dark:bg-raised dark:hover:bg-subtle",
        iconOnly && "w-7 justify-center px-0",
        className,
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <Copy className={cn("absolute size-3.5 transition-all duration-150", done && "scale-50 opacity-0")} />
        <Check className={cn("absolute size-3.5 text-success-fg transition-all duration-150", !done && "scale-50 opacity-0")} />
      </span>
      {!iconOnly && (done ? "Copied" : label)}
    </button>
  );
  return iconOnly ? <Tooltip content={done ? "Copied" : label}>{btn}</Tooltip> : btn;
}

/* ───────── File-type icon ───────── */
const kindStyle: Record<FileKind, { label: string; color: string }> = {
  pdf: { label: "PDF", color: "#c2410c" },
  docx: { label: "DOC", color: "#1d4ed8" },
  xlsx: { label: "XLS", color: "#15803d" },
  json: { label: "JSON", color: "#6d28d9" },
  zip: { label: "ZIP", color: "#a16207" },
};

export function FileIcon({ kind, size = 32, className }: { kind: FileKind; size?: number; className?: string }) {
  const k = kindStyle[kind];
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size * 0.8, height: size }} aria-hidden>
      <svg viewBox="0 0 26 32" className="absolute inset-0 size-full">
        <path d="M3 .5h14.5L25.5 8.5V29A2.5 2.5 0 0 1 23 31.5H3A2.5 2.5 0 0 1 .5 29V3A2.5 2.5 0 0 1 3 .5Z" className="fill-surface stroke-line-strong dark:fill-raised" />
        <path d="M17.5.5V6a2.5 2.5 0 0 0 2.5 2.5h5.5" className="fill-subtle stroke-line-strong" />
      </svg>
      <span
        className="absolute bottom-[18%] left-[-8%] rounded-[3px] px-[3px] font-mono font-semibold leading-[1.35] text-white"
        style={{ background: k.color, fontSize: Math.max(7, size * 0.22) }}
      >
        {k.label}
      </span>
    </span>
  );
}

/* ───────── Visibility ───────── */
export function VisibilityBadge({ value, className }: { value: Visibility; className?: string }) {
  return value === "public" ? (
    <Badge tone="success" className={className}>
      <Globe2 />
      Public
    </Badge>
  ) : (
    <Badge tone="neutral" className={className}>
      <LockKeyhole />
      Restricted
    </Badge>
  );
}

/* ───────── Empty state ───────── */
export function KnotArt({ className }: { className?: string }) {
  return (
    <div className={cn("relative grid size-20 place-items-center", className)} aria-hidden>
      <div className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
      <div className="absolute inset-3 rounded-full bg-subtle" />
      <SecureKnotsLogo variant="knot" className="relative h-9 w-auto text-faint" />
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
  compact,
}: {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 text-center", compact ? "py-8" : "py-14", className)}>
      <KnotArt className={compact ? "scale-90" : undefined} />
      <h3 className={cn("mt-4 font-serif text-fg", compact ? "text-[20px]" : "text-[24px]")}>{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ───────── Section label ───────── */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{children}</h2>
      {action}
    </div>
  );
}

/* ───────── Demo chip ───────── */
export function DemoChip({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2 text-[11.5px] font-medium text-muted", className)}>
      <span className="size-1.5 rounded-full bg-warning" />
      Demo data
    </span>
  );
}
