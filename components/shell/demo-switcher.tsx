"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Building2, Ellipsis, Moon, RotateCcw, Sun } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useTrust } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useSchemeLocked } from "@/components/design/design-switcher";

type View = "public" | "reviewer" | "admin";

const VIEWS: { value: View; label: string; href: string }[] = [
  { value: "public", label: "Public", href: "/t/northwind" },
  { value: "reviewer", label: "Reviewer", href: "/t/northwind/portal" },
  { value: "admin", label: "Admin", href: "/admin" },
];

function viewFor(path: string): View | null {
  if (path.startsWith("/t/") && path.includes("/portal")) return "reviewer";
  if (path.startsWith("/t/")) return "public";
  if (path.startsWith("/admin") || path.startsWith("/login")) return "admin";
  return null;
}

export function resetDemo() {
  const s = useTrust.getState();
  const prev = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function"));
  s.reset();
  toast.success("Demo data reset", {
    description: "Everything is back to the seeded Northwind Cloud data.",
    action: { label: "Undo", onClick: () => useTrust.getState().patch(prev) },
  });
}

export function DemoSwitcher() {
  const path = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const signedIn = useTrust((s) => s.session.adminSignedIn);
  const active = viewFor(path);
  const locked = useSchemeLocked();
  if (path === "/") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 print:hidden sm:bottom-4">
      <nav
        aria-label="Demo view switcher"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#111111] p-1 text-white shadow-[0_10px_30px_-10px_rgb(15_23_41/0.55),0_2px_6px_rgb(15_23_41/0.25)] ring-1 ring-white/10 dark:bg-[#f5f5f5] dark:text-[#0a0a0a] dark:ring-black/10"
      >
        <span className="hidden pl-3 pr-1 text-[11.5px] font-medium opacity-55 sm:inline">View as</span>
        {VIEWS.map((v) => {
          const isActive = active === v.value;
          const href = v.value === "admin" && !signedIn ? "/login" : v.href;
          return (
            <Link
              key={v.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-medium transition-opacity",
                isActive ? "opacity-100" : "opacity-65 hover:opacity-100",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="demo-switch"
                  className="absolute inset-0 rounded-full bg-white/[0.14] ring-1 ring-white/10 dark:bg-black/[0.08] dark:ring-black/10"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                />
              )}
              <span className="relative">{v.label}</span>
            </Link>
          );
        })}
        <Menu>
          <MenuTrigger
            suppressHydrationWarning
            aria-label="Demo options"
            className="grid size-8 place-items-center rounded-full opacity-65 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <Ellipsis className="size-4" />
          </MenuTrigger>
          <MenuContent side="top" align="end" sideOffset={10} className="w-60">
            <MenuLabel>Demo</MenuLabel>
            <MenuItem onSelect={() => router.push("/platform")}>
              <Building2 />
              All trust centers (SecureKnots)
            </MenuItem>
            <MenuItem disabled={!!locked} onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {locked ? `This design is ${locked} only` : resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={resetDemo}>
              <RotateCcw />
              Reset demo data
            </MenuItem>
          </MenuContent>
        </Menu>
      </nav>
    </div>
  );
}
