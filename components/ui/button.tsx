import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(15_23_41/0.18)] hover:bg-brand-hover",
        secondary: "border border-line-strong bg-surface text-fg shadow-xs hover:bg-raised hover:border-[color-mix(in_oklab,var(--line-strong)_100%,var(--fg)_6%)] dark:bg-raised dark:hover:bg-subtle",
        ghost: "text-muted hover:bg-subtle hover:text-fg",
        danger: "bg-danger-fg text-white hover:opacity-90 dark:bg-danger dark:text-[#2a0710]",
        "danger-ghost": "text-danger-fg hover:bg-danger-soft",
        tenant: "bg-tenant text-tenant-fg shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(15_23_41/0.18)] hover:brightness-110",
        link: "h-auto px-0 text-brand-ink underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        xs: "h-7 px-2.5 text-[12px] [&_svg]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-[13.5px]",
        lg: "h-10 px-4 text-[14px]",
        icon: "size-9",
        "icon-sm": "size-8 [&_svg]:size-[15px]",
        "icon-xs": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp suppressHydrationWarning data-slot="button" data-variant={variant ?? "secondary"} className={cn(buttonVariants({ variant, size }), className)} disabled={asChild ? undefined : disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80" />
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1.5", loading && "invisible")}>{children}</span>
        </>
      )}
    </Comp>
  );
}
