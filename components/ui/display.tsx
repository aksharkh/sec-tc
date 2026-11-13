import * as React from "react";
import { cn, initials } from "@/lib/utils";

/* ───────── Card ───────── */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

/* ───────── Avatar ───────── */
const hues = ["#1f3fae", "#0e6b5c", "#7a4b9c", "#a5482a", "#2f6f9f", "#5b6b2a", "#9b3d5f", "#3c4a66"];
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return hues[h % hues.length]!;
}

export function Avatar({ name, size = 28, className, square }: { name: string; size?: number; className?: string; square?: boolean }) {
  const c = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 select-none place-items-center bg-[color-mix(in_oklab,var(--av)_14%,var(--surface))] font-semibold tracking-tight text-[color-mix(in_oklab,var(--av)_80%,var(--fg))] ring-2 ring-surface dark:bg-subtle-2 dark:text-fg-2",
        square ? "rounded-[7px]" : "rounded-full",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)), ["--av" as string]: c }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = 24 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {rest > 0 && (
        <span className="inline-grid place-items-center rounded-full bg-subtle text-[10.5px] font-semibold text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ───────── Skeleton ───────── */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("skeleton", className)} style={style} />;
}

/* ───────── Progress ───────── */
export function ProgressBar({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; className?: string; label?: string }) {
  const track = { brand: "bg-brand-soft", success: "bg-success-soft", warning: "bg-warning-soft", danger: "bg-danger-soft" }[tone];
  const fill = { brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn("h-1.5 w-full overflow-hidden rounded-full", track, className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 40, stroke = 4, children, tone = "brand" }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; tone?: "brand" | "success" | "warning" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { brand: "var(--brand)", success: "var(--success)", warning: "var(--warning)" }[tone];
  const track = { brand: "var(--brand-soft)", success: "var(--success-soft)", warning: "var(--warning-soft)" }[tone];
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value / 100)))}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-out)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold">{children}</div>}
    </div>
  );
}

/* ───────── Definition list ───────── */
export function Meta({ items, className, cols = 2 }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string; cols?: 1 | 2 | 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3.5",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12px] text-muted">{it.label}</dt>
          <dd className="mt-0.5 truncate text-[13.5px] font-medium text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
