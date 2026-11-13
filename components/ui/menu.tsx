"use client";

import * as React from "react";
import { DropdownMenu as M, Popover as P, Tooltip as T } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "./badge";

const panel =
  "z-50 rounded-[10px] border border-line bg-surface p-1 text-fg shadow-lg outline-none dark:bg-raised data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn(panel, "min-w-[200px] origin-[var(--radix-dropdown-menu-content-transform-origin)]", className)} {...props} />
    </M.Portal>
  );
}

const item =
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded-[6px] px-2 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted";

export function MenuItem({ className, danger, shortcut, children, ...props }: React.ComponentProps<typeof M.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <M.Item className={cn(item, danger && "text-danger-fg data-[highlighted]:bg-danger-soft [&_svg]:text-danger-fg", className)} {...props}>
      {children}
      {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
    </M.Item>
  );
}

export function MenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(item, "pl-7", className)} {...props}>
      <M.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="size-3.5 !text-fg" />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 pb-1 pt-1.5 text-[11.5px] font-medium text-faint", className)} {...props} />;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} />;
}

/* ───────── Popover ───────── */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn(panel, "w-72 origin-[var(--radix-popover-content-transform-origin)] p-0", className)} {...props} />
    </P.Portal>
  );
}

/* ───────── Tooltip ───────── */
export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
  asChild = true,
}: {
  content: React.ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return (
    <T.Root>
      <T.Trigger asChild={asChild}>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[60] flex max-w-64 items-center gap-2 rounded-[7px] bg-fg px-2 py-1.5 text-[12px] font-medium text-surface shadow-md data-[state=delayed-open]:animate-menu-in"
        >
          {content}
          {shortcut && (
            <span className="rounded-[4px] bg-surface/15 px-1 font-mono text-[10.5px] text-surface/80">{shortcut}</span>
          )}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
