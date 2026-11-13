import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "review" | "info" | "neutral" | "brand" | "tenant";

const badge = cva(
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success-fg",
        warning: "bg-warning-soft text-warning-fg",
        danger: "bg-danger-soft text-danger-fg",
        review: "bg-review-soft text-review-fg",
        info: "bg-info-soft text-info-fg",
        neutral: "bg-neutral-soft text-neutral-fg",
        brand: "bg-brand-soft text-brand-ink",
        tenant: "bg-tenant-soft text-tenant",
      },
      outline: { true: "border border-line-strong bg-transparent text-muted", false: "" },
    },
    defaultVariants: { tone: "neutral", outline: false },
  },
);

const dotColor: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  review: "bg-review",
  info: "bg-info",
  neutral: "bg-neutral",
  brand: "bg-brand",
  tenant: "bg-tenant",
};

export function Badge({
  className,
  tone,
  outline,
  dot,
  pulse,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badge> & { dot?: boolean; pulse?: boolean }) {
  const t = (tone ?? "neutral") as Tone;
  return (
    <span className={cn(badge({ tone, outline }), className)} {...props}>
      {dot && (
        <span className="relative inline-flex size-1.5">
          {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", dotColor[t])} />}
          <span className={cn("relative size-1.5 rounded-full", dotColor[t])} />
        </span>
      )}
      {children}
    </span>
  );
}

export function Chip({ className, active, ...props }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-medium transition-colors duration-150 [&_svg]:size-3.5",
        active
          ? "border-transparent bg-fg text-surface"
          : "border-line-strong bg-surface text-muted hover:bg-subtle hover:text-fg dark:bg-raised",
        className,
      )}
      {...props}
    />
  );
}

export function Mono({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono text-[12px] tracking-tight", className)} {...props} />;
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-raised px-1 font-mono text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--line-strong)]",
        className,
      )}
      {...props}
    />
  );
}
