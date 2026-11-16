"use client";

import * as React from "react";
import { Checkbox as C, Select as S, Switch as Sw } from "radix-ui";
import { motion } from "motion/react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Switch ───────── */
export function Switch({ className, ...props }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-line-strong transition-colors duration-200 data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50 dark:bg-subtle dark:data-[state=checked]:bg-brand",
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgb(15_23_41/0.25)] transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[17px] dark:data-[state=checked]:bg-[#0a0a0a]" />
    </Sw.Root>
  );
}

/* ───────── Checkbox ───────── */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "peer grid size-4 shrink-0 place-items-center rounded-[4.5px] border border-line-strong bg-surface shadow-xs transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand disabled:opacity-50 dark:bg-raised",
        className,
      )}
      {...props}
    >
      <C.Indicator className="text-brand-fg">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </C.Indicator>
    </C.Root>
  );
}

/* ───────── Select ───────── */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  size = "md",
  ariaLabel,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: React.ReactNode; hint?: string }[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-[8px] border border-line-strong bg-surface px-3 text-left text-[13.5px] text-fg shadow-xs outline-none transition-colors hover:bg-raised focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--ring)] data-[placeholder]:text-faint disabled:opacity-50 dark:bg-raised dark:hover:bg-subtle",
          size === "sm" ? "h-8 text-[13px]" : "h-9",
          className,
        )}
      >
        <span className="truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="size-4 text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-lg data-[state=open]:animate-menu-in dark:bg-raised"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-[6px] py-1.5 pl-7 pr-2 text-[13px] text-fg outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-subtle"
              >
                <S.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-3.5" />
                </S.ItemIndicator>
                <div className="min-w-0">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.hint && <div className="text-[12px] text-muted">{o.hint}</div>}
                </div>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

/* ───────── Segmented control ───────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  layoutId,
  fill,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
  layoutId: string;
  fill?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[9px] border border-line bg-subtle p-0.5 dark:bg-[color-mix(in_oklab,var(--canvas),var(--surface)_40%)]",
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 font-medium transition-colors duration-150 [&_svg]:size-3.5",
              size === "sm" ? "h-7 text-[12.5px]" : "h-8 text-[13px]",
              fill && "flex-1",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[7px] border border-line bg-surface shadow-xs dark:bg-raised"
                transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
              {o.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[11px] leading-[17px]", active ? "bg-brand-soft text-brand-ink" : "bg-line text-muted")}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Underline tabs ───────── */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  layoutId,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: React.ReactNode; count?: number }[];
  layoutId: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("scroll-thin -mb-px flex gap-5 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap text-[13.5px] font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-fg text-inverse" : "bg-subtle text-muted")}>{t.count}</span>
            )}
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-fg" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
