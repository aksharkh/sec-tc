"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay({ className }: { className?: string }) {
  return (
    <D.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-[1.5px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in",
        className,
      )}
    />
  );
}

export function DialogContent({
  className,
  children,
  hideClose,
  size = "md",
  ...props
}: React.ComponentProps<typeof D.Content> & { hideClose?: boolean; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <D.Portal>
      <Overlay />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-y-auto p-3 sm:p-6">
        <D.Content
          className={cn(
            "card pointer-events-auto relative w-full rounded-[12px] shadow-lg outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
            size === "sm" && "max-w-[420px]",
            size === "md" && "max-w-[520px]",
            size === "lg" && "max-w-[680px]",
            size === "xl" && "max-w-[900px]",
            className,
          )}
          {...props}
        >
          {children}
          {!hideClose && (
            <D.Close
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-[8px] text-muted transition-colors hover:bg-subtle hover:text-fg"
              aria-label="Close"
            >
              <X className="size-4" />
            </D.Close>
          )}
        </D.Content>
      </div>
    </D.Portal>
  );
}

export function DialogHeader({ title, description, className, icon }: { title: React.ReactNode; description?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn("px-5 pb-1 pt-5 pr-12 sm:px-6 sm:pt-6", className)}>
      {icon && <div className="mb-3">{icon}</div>}
      <D.Title className="text-[16px] font-semibold tracking-[-0.015em] text-fg">{title}</D.Title>
      {description ? (
        <D.Description className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</D.Description>
      ) : (
        <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4 sm:px-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-line bg-raised/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 rounded-b-[12px] dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

/* ───────── Sheet (side drawer) ───────── */

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  className,
  children,
  width = 520,
  ...props
}: React.ComponentProps<typeof D.Content> & { width?: number }) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        style={{ maxWidth: width }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-lg outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in sm:inset-y-2 sm:right-2 sm:rounded-[12px] sm:border",
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function SheetHeader({ title, description, children, className }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0 flex-1">
        <D.Title className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</D.Title>
        {description ? <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">Details</D.Description>}
        {children}
      </div>
      <D.Close className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] text-muted transition-colors hover:bg-subtle hover:text-fg" aria-label="Close">
        <X className="size-4" />
      </D.Close>
    </div>
  );
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-line px-5 py-3.5", className)} {...props} />;
}
