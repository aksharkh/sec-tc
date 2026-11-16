"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/menu";
import { useTrust } from "@/lib/store";
import { useDesign } from "@/lib/designs";

function StoreHydrator() {
  React.useEffect(() => {
    void useTrust.persist.rehydrate();
  }, []);
  return null;
}

function TenantAccent() {
  const accent = useTrust((s) => s.branding.accent);
  React.useEffect(() => {
    document.documentElement.style.setProperty("--tenant", accent);
  }, [accent]);
  return null;
}

/** Light-only and dark-only designs keep their scheme, even if the saved theme says otherwise. */
function DesignSchemeSync() {
  const design = useDesign();
  const { resolvedTheme, setTheme } = useTheme();
  React.useEffect(() => {
    if (design.scheme !== "both" && resolvedTheme && resolvedTheme !== design.scheme) setTheme(design.scheme);
  }, [design.scheme, resolvedTheme, setTheme]);
  return null;
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      offset={{ bottom: 76, right: 16 }}
      mobileOffset={{ bottom: 76, left: 12, right: 12 }}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[10px] !border !border-line !bg-surface !text-fg !shadow-lg !font-sans !text-[13.5px] !gap-2.5 dark:!bg-raised",
          description: "!text-muted !text-[12.5px]",
          actionButton: "!rounded-[7px] !bg-fg !text-inverse !font-medium !h-7 !px-2.5 !text-[12.5px]",
          cancelButton: "!rounded-[7px] !bg-subtle !text-fg",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          info: "[&_[data-icon]]:!text-info",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          <StoreHydrator />
          <TenantAccent />
          <DesignSchemeSync />
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
