import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[8px] border border-line-strong bg-surface px-3 text-[13.5px] text-fg shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-[color-mix(in_oklab,var(--line-strong),var(--fg)_10%)] focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_30%,transparent)] dark:bg-raised";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  // Autofill features add attributes such as fdprocessedid before hydration.
  return <input suppressHydrationWarning className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea suppressHydrationWarning className={cn(control, "min-h-20 resize-y py-2 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-fg", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="text-[12px] text-faint">Optional</span>}
      </div>
      {children}
      {error ? (
        <p className="text-[12.5px] text-danger-fg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <div className="text-[12.5px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" className={cn(vertical ? "w-px self-stretch bg-line" : "h-px w-full bg-line", className)} />;
}
