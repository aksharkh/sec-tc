"use client";

import * as React from "react";
import { HoverCard } from "radix-ui";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { DESIGNS, applyDesign, useDesign, type DesignId } from "@/lib/designs";
import { cn } from "@/lib/utils";

/** A tiny, real rendering of the trust center in another design: the tokens are scoped to this element. */
function Preview({ id, dark }: { id: DesignId; dark: boolean }) {
  const bars = [72, 48, 88, 36, 64];
  return (
    <div data-design={id} className={cn("relative h-[104px] overflow-hidden rounded-[10px] bg-canvas font-sans", dark && "dark")} style={{ backgroundImage: "var(--app-bg)" }}>
      <div className="absolute inset-y-2 left-2 w-[22%] space-y-1.5 p-1.5">
        <div className="h-1.5 w-3/4 rounded-full bg-fg/80" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 rounded-full", i === 1 ? "bg-brand" : "bg-fg/15")} style={{ width: `${55 + i * 9}%` }} />
        ))}
      </div>
      <div data-slot="card" className="absolute inset-y-2 left-[26%] right-2 rounded-xl border border-line bg-surface p-2 shadow-xs">
        <div className="text-[12px] leading-none text-fg" style={{ fontFamily: "var(--font-display)" }}>
          Trust Center
        </div>
        <div className="mt-1 h-1 w-1/2 rounded-full bg-fg/15" />
        <div className="mt-2.5 flex h-[42px] items-end gap-1">
          {bars.map((b, i) => (
            <div key={i} className={cn("flex-1 rounded-[3px]", i === 2 ? "bg-brand" : "bg-fg/20")} style={{ height: `${b}%` }} />
          ))}
          <div className="ml-1 grid size-[34px] shrink-0 place-items-center rounded-full border-[3px] border-brand/80 text-[8px] font-semibold text-fg">96</div>
        </div>
      </div>
    </div>
  );
}

/**
 * One button for the whole look. Hover shows all seven designs as live previews; clicking a
 * preview switches to it. Clicking the button itself moves to the next design. On touch
 * screens a tap opens the previews instead.
 */
export function DesignSwitcher({ className, align = "end" }: { className?: string; align?: "start" | "end" }) {
  const current = useDesign();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const touch = React.useRef(false);
  const shown = current;
  const next = DESIGNS[(DESIGNS.findIndex((d) => d.id === shown.id) + 1) % DESIGNS.length]!;

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={80} closeDelay={160}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          onPointerDown={(e) => (touch.current = e.pointerType !== "mouse")}
          onClick={(e) => {
            if (touch.current) {
              setOpen((o) => !o);
              return;
            }
            applyDesign(next.id, setTheme, { x: e.clientX, y: e.clientY });
          }}
          className={cn(
            "group flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-line-strong bg-surface px-1.5 text-[12.5px] font-medium text-fg shadow-xs transition-colors hover:bg-subtle sm:pr-2.5",
            className,
          )}
          aria-label={`Design: ${shown.name}. Click for ${next.name}, hover to see all`}
        >
          <span className="relative flex size-5 items-center justify-center overflow-hidden rounded-md" data-design={shown.id}>
            <span className="absolute inset-0 bg-canvas" style={{ backgroundImage: "var(--app-bg)" }} />
            <span className="relative size-2.5 rounded-full bg-brand ring-2 ring-surface" />
          </span>
          <span className="hidden md:inline">{shown.name}</span>
          <Palette className="hidden size-3.5 text-muted transition-transform group-hover:rotate-12 sm:block" />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          align={align}
          sideOffset={10}
          collisionPadding={8}
          className="z-[85] max-h-[min(640px,calc(100dvh-80px))] w-[min(640px,calc(100vw-16px))] animate-pop overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-lg"
          style={{ backdropFilter: "blur(24px)" }}
        >
          <div className="flex items-end justify-between px-1 pb-3 pt-1">
            <div>
              <p className="text-[14px] font-semibold text-fg">Choose a look</p>
              <p className="text-[12px] text-muted">Seven complete designs, the same set as Workspace. Click one to switch; the choice is saved.</p>
            </div>
            <span className="hidden shrink-0 text-[11.5px] text-faint sm:block">Click the button to cycle</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DESIGNS.map((d, i) => {
              const on = d.id === shown.id;
              const dark = d.scheme === "dark" || (d.scheme === "both" && resolvedTheme === "dark");
              return (
                <motion.button
                  key={d.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={(e) => {
                    applyDesign(d.id, setTheme, { x: e.clientX, y: e.clientY });
                    if (touch.current) setOpen(false);
                  }}
                  className={cn(
                    "group rounded-xl border p-1.5 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5",
                    on ? "border-fg shadow-[0_0_0_1px_var(--fg)]" : "border-line hover:border-line-strong",
                  )}
                  aria-pressed={on}
                >
                  <Preview id={d.id} dark={dark} />
                  <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-2">
                    <span className="text-[12.5px] font-semibold text-fg">{d.name}</span>
                    <span className="truncate rounded-full bg-subtle px-1.5 py-px text-[10.5px] font-medium text-muted">{d.audience}</span>
                    {on && <Check className="ml-auto size-3.5 shrink-0 text-fg" strokeWidth={3} />}
                  </div>
                  <p className="line-clamp-2 px-1 text-[11.5px] leading-[1.35] text-muted">{d.tagline}</p>
                </motion.button>
              );
            })}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

/** True when the active design fixes the color scheme (light-only or dark-only). */
export function useSchemeLocked() {
  const d = useDesign();
  return d.scheme !== "both" ? d.scheme : null;
}
