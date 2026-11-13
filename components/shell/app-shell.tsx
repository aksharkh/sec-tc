"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Drawer } from "vaul";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Bell,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  FileText,
  Globe2,
  LogOut,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Sun,
  UserRound,
  UserPlus,
} from "lucide-react";
import { SecureKnotsLogo } from "@/components/brand/SecureKnotsLogo";
import { TenantLogo } from "@/components/tenant/chrome";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/display";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/menu";
import { DemoChip } from "@/components/kit/bits";
import { useHydrated, useTrust, effectiveStatus } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { cn, fmt } from "@/lib/utils";
import type { Notice } from "@/lib/types";
import { ADMIN_NAV, CommandPalette } from "./command-palette";
import { resetDemo } from "./demo-switcher";

type Mode = "admin" | "platform";

/** Sidebar collapsed preference, kept per viewer in localStorage. */
const sidebarPref = (() => {
  const KEY = "sk-trust-sidebar";
  const listeners = new Set<() => void>();
  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get() {
      try {
        return localStorage.getItem(KEY) === "collapsed";
      } catch {
        return false;
      }
    },
    set(v: boolean) {
      try {
        localStorage.setItem(KEY, v ? "collapsed" : "open");
      } catch {
        /* storage blocked: keep the in-memory default */
      }
      listeners.forEach((l) => l());
    },
  };
})();

const GROUPS = ["Trust center", "Engagement", "Data and integrations", "Workspace"].map((label) => ({
  label,
  items: ADMIN_NAV.filter((n) => n.group === label),
}));

function useCounts() {
  const hydrated = useHydrated();
  const pending = useTrust((s) => s.requests.filter((r) => r.status === "pending").length);
  const docs = useTrust((s) => s.documents.length);
  const stale = useTrust((s) => s.pkg.status === "stale");
  const openQs = useTrust((s) => s.publicQuestions.filter((q) => q.status === "open").length + s.questionnaires.filter((q) => q.status === "new" || q.status === "in_progress").length);
  const integrationErrors = useTrust((s) => s.integrations.some((i) => i.status === "error") || s.webhooks.some((w) => w.status === "failing"));
  const expiring = useTrust((s) => s.reviewers.filter((r) => effectiveStatus(r) === "active" && r.expiresAt && new Date(r.expiresAt).getTime() - Date.now() < 14 * 86400000).length);
  if (!hydrated) return {} as Record<string, React.ReactNode>;
  return {
    "/admin/documents": <span className="text-[11.5px] text-faint">{docs}</span>,
    "/admin/access": pending ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-[18px] text-brand-fg">{pending}</span> : expiring ? <span className="text-[11.5px] text-faint">{expiring}</span> : null,
    "/admin/machine-readable": stale ? <span className="size-1.5 rounded-full bg-warning" aria-label="Changes not yet published" /> : null,
    "/admin/questionnaires": openQs ? <span className="text-[11.5px] text-faint">{openQs}</span> : null,
    "/admin/integrations": integrationErrors ? <span className="size-1.5 rounded-full bg-danger" aria-label="An integration needs attention" /> : null,
  } as Record<string, React.ReactNode>;
}

function NavLink({ href, label, Icon, collapsed, extra, active, onNavigate }: { href: string; label: string; Icon: React.ElementType; collapsed?: boolean; extra?: React.ReactNode; active: boolean; onNavigate?: () => void }) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-[7px] px-2 text-[13.5px] font-medium transition-colors duration-150",
        active ? "text-fg" : "text-muted hover:bg-subtle/70 hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId={`nav-active-${collapsed ? "c" : "e"}`}
          className="absolute inset-0 rounded-[7px] border border-line bg-surface shadow-xs dark:bg-subtle"
          transition={{ type: "spring", stiffness: 520, damping: 42 }}
        />
      )}
      <Icon className={cn("relative size-4 shrink-0", active ? "text-brand-ink" : "text-faint group-hover:text-muted")} />
      {!collapsed && <span className="relative truncate">{label}</span>}
      {!collapsed && extra && <span className="relative ml-auto flex items-center">{extra}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function WorkspaceSwitcher({ collapsed, mode }: { collapsed?: boolean; mode: Mode }) {
  const router = useRouter();
  const tenants = useTrust((s) => s.tenants);
  const host = useTrust((s) => s.domain.host);
  const hydrated = useHydrated();
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[9px] p-1.5 text-left outline-none transition-colors hover:bg-subtle/80 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-subtle",
          collapsed && "justify-center",
        )}
      >
        {mode === "platform" ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[#0a0a0a] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_0_14px_rgb(255_255_255/0.06)]">
            <SecureKnotsLogo className="h-6 w-auto" onDark />
          </span>
        ) : (
          <TenantLogo size={32} />
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13.5px] font-semibold text-fg">{mode === "platform" ? "SecureKnots" : "Northwind Cloud"}</span>
              <span className="block truncate text-[12px] text-muted" suppressHydrationWarning>
                {mode === "platform" ? "All trust centers" : hydrated ? host : "trust.northwindcloud.com"}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-faint" />
          </>
        )}
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Trust centers</MenuLabel>
        {tenants.map((t) => (
          <MenuItem key={t.id} disabled={t.slug !== "northwind"} onSelect={() => router.push("/admin")}>
            <span className="grid size-5 place-items-center rounded-[5px] text-[10px] font-bold text-white" style={{ background: t.accent }}>
              {t.name[0]}
            </span>
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {t.slug === "northwind" && mode === "admin" ? <Check className="!text-fg" /> : t.slug !== "northwind" ? <span className="text-[11px] text-faint">No demo data</span> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/platform")}>
          <Building2 />
          All trust centers
          {mode === "platform" && <Check className="ml-auto !text-fg" />}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SidebarBody({ collapsed, mode, onNavigate }: { collapsed?: boolean; mode: Mode; onNavigate?: () => void }) {
  const path = usePathname();
  const counts = useCounts();
  const setUi = useUi((s) => s.set);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <div className="flex h-full flex-col">
      <div className="px-2.5 pt-2.5">
        <WorkspaceSwitcher collapsed={collapsed} mode={mode} />
      </div>
      <div className="px-2.5 pt-3">
        {collapsed ? (
          <Tooltip content="Search" shortcut="Ctrl K" side="right">
            <button onClick={() => setUi({ paletteOpen: true })} aria-label="Search" className="grid h-8 w-full place-items-center rounded-[7px] text-muted hover:bg-subtle hover:text-fg">
              <Search className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => {
              onNavigate?.();
              setUi({ paletteOpen: true });
            }}
            className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-faint shadow-xs transition-colors hover:border-line-strong hover:text-muted dark:bg-raised"
          >
            <Search className="size-3.5" />
            Search
            <span className="ml-auto flex gap-0.5">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        )}
      </div>
      <nav className="scroll-thin mt-3 flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Main">
        {mode === "platform" ? (
          <div className="grid grid-cols-1 gap-0.5">
            {!collapsed && <div className="px-2 pb-1 pt-2 text-[11.5px] font-medium text-faint">SecureKnots</div>}
            <NavLink href="/platform" label="Trust centers" Icon={Building2} collapsed={collapsed} active={path.startsWith("/platform")} onNavigate={onNavigate} />
            {!collapsed && <div className="px-2 pb-1 pt-4 text-[11.5px] font-medium text-faint">Open a client</div>}
            <NavLink href="/admin" label="Northwind Cloud admin" Icon={ArrowUpRight} collapsed={collapsed} active={false} onNavigate={onNavigate} />
          </div>
        ) : (
          GROUPS.map((g) => (
            <div key={g.label} className="mb-3 grid grid-cols-1 gap-0.5">
              {!collapsed ? <div className="px-2 pb-1 pt-2 text-[11.5px] font-medium text-faint">{g.label}</div> : <div className="mx-2 my-2 h-px bg-line" />}
              {g.items.map((n) => (
                <NavLink key={n.href} href={n.href} label={n.label} Icon={n.icon} collapsed={collapsed} extra={counts[n.href]} active={isActive(n.href)} onNavigate={onNavigate} />
              ))}
            </div>
          ))
        )}
      </nav>
      <div className="border-t border-line p-2.5">
        {mode === "admin" && (
          <NavLink href="/t/northwind" label="View public page" Icon={Globe2} collapsed={collapsed} active={false} onNavigate={onNavigate} />
        )}
        <div className={cn("mt-2 flex items-center gap-2 px-2 pb-1", collapsed && "justify-center px-0")}>
          <SecureKnotsLogo className="h-5 w-auto shrink-0" onDark />
          {!collapsed && (
            <>
              <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-fg">
                SecureKnots <span className="font-normal text-muted">Trust</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const NOTICE_ICON: Record<Notice["kind"], React.ElementType> = {
  request: UserPlus,
  approval: BadgeCheck,
  expiry: Clock3,
  json: BadgeCheck,
  domain: Globe2,
  upload: FileText,
};

function Notifications() {
  const router = useRouter();
  const hydrated = useHydrated();
  const notices = useTrust((s) => s.notices);
  const readAt = useTrust((s) => s.noticesReadAt);
  const markRead = useTrust((s) => s.markNoticesRead);
  const unread = hydrated ? notices.filter((n) => n.at > readAt).length : 0;
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Notifications">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
            <Bell />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-canvas" />}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-[min(360px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[13.5px] font-semibold text-fg">Notifications</span>
          <button onClick={markRead} disabled={!unread} className="text-[12.5px] font-medium text-brand-ink disabled:text-faint">
            Mark all read
          </button>
        </div>
        <ul className="scroll-thin max-h-[380px] overflow-y-auto p-1.5">
          {notices.slice(0, 12).map((n) => {
            const Icon = NOTICE_ICON[n.kind];
            const isUnread = n.at > readAt;
            return (
              <li key={n.id}>
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(n.href);
                  }}
                  className="flex w-full gap-3 rounded-[8px] px-2.5 py-2.5 text-left transition-colors hover:bg-subtle"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-subtle text-muted">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                      {n.title}
                      {isUnread && <span className="size-1.5 rounded-full bg-brand" aria-label="Unread" />}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">{n.body}</span>
                    <span className="block text-[11.5px] text-faint">{fmt.ago(n.at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <Tooltip content={dark ? "Light theme" : "Dark theme"}>
      <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")}>
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </Tooltip>
  );
}

function UserMenu({ mode }: { mode: Mode }) {
  const router = useRouter();
  const signOut = useTrust((s) => s.setAdminSignedIn);
  return (
    <Menu>
      <MenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <Avatar name="Seema Abdul" size={30} />
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name="Seema Abdul" size={32} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13.5px] font-medium text-fg">Seema Abdul</div>
            <div className="truncate text-[12px] text-muted">SecureKnots · Trust center manager</div>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/t/northwind")}>
          <Globe2 /> Public trust page
        </MenuItem>
        <MenuItem onSelect={() => router.push("/t/northwind/portal")}>
          <UserRound /> Reviewer portal
        </MenuItem>
        {mode === "admin" ? (
          <MenuItem onSelect={() => router.push("/platform")}>
            <Building2 /> All trust centers
          </MenuItem>
        ) : (
          <MenuItem onSelect={() => router.push("/admin")}>
            <ArrowUpRight /> Northwind Cloud admin
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onSelect={resetDemo}>
          <RotateCcw /> Reset demo data
        </MenuItem>
        <MenuItem
          onSelect={() => {
            signOut(false);
            router.push("/login");
          }}
        >
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const LABELS: Record<string, string> = {
  documents: "Documents",
  access: "Access",
  logs: "Access logs",
  analytics: "Analytics",
  "machine-readable": "Machine-readable",
  api: "API",
  snapshots: "Snapshots",
  settings: "Settings",
  updates: "Updates and notices",
  questionnaires: "Q&A and questionnaires",
  subprocessors: "Subprocessors",
  status: "Service status",
  integrations: "Integrations",
  audit: "Audit trail",
};

function Breadcrumbs({ mode }: { mode: Mode }) {
  const path = usePathname();
  const docs = useTrust((s) => s.documents);
  const hydrated = useHydrated();
  const parts = path.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];
  if (mode === "platform") crumbs.push({ label: "SecureKnots" }, { label: "Trust centers" });
  else {
    crumbs.push({ label: "Northwind Cloud", href: "/admin" });
    if (parts.length === 1) crumbs.push({ label: "Overview" });
    if (parts[1]) crumbs.push({ label: LABELS[parts[1]] ?? parts[1], href: parts[2] ? `/admin/${parts[1]}` : undefined });
    if (parts[2]) crumbs.push({ label: hydrated ? (docs.find((d) => d.id === parts[2])?.title ?? "Document") : "Document" });
  }
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => (
          <li key={i} className={cn("flex min-w-0 items-center gap-1", i < crumbs.length - 1 && "hidden sm:flex")}>
            {i > 0 && <ChevronRight className={cn("size-3.5 shrink-0 text-faint", i === crumbs.length - 1 && "hidden sm:block")} />}
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href} className="truncate text-muted hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-fg" : "text-muted")}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AppShell({ children, mode = "admin" }: { children: React.ReactNode; mode?: Mode }) {
  const router = useRouter();
  const path = usePathname();
  const hydrated = useHydrated();
  const signedIn = useTrust((s) => s.session.adminSignedIn);
  const setUi = useUi((s) => s.set);
  const mobileOpen = useUi((s) => s.mobileNavOpen);
  const collapsed = React.useSyncExternalStore(sidebarPref.subscribe, sidebarPref.get, () => false);
  const toggle = () => sidebarPref.set(!collapsed);

  React.useEffect(() => {
    if (hydrated && !signedIn) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [hydrated, signedIn, router, path]);

  return (
    <div className="min-h-dvh bg-canvas">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-canvas transition-[width] duration-200 ease-[var(--ease-out)] lg:block",
          collapsed ? "w-[60px]" : "w-[248px]",
        )}
      >
        <SidebarBody collapsed={collapsed} mode={mode} />
      </aside>

      <Drawer.Root direction="left" open={mobileOpen} onOpenChange={(v) => setUi({ mobileNavOpen: v })}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay" />
          <Drawer.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-line bg-canvas outline-none" aria-describedby={undefined}>
            <Drawer.Title className="sr-only">Navigation</Drawer.Title>
            <SidebarBody mode={mode} onNavigate={() => setUi({ mobileNavOpen: false })} />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <div className={cn("transition-[padding] duration-200 ease-[var(--ease-out)]", collapsed ? "lg:pl-[60px]" : "lg:pl-[248px]")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas/95 px-3 supports-[backdrop-filter]:bg-canvas/80 supports-[backdrop-filter]:backdrop-blur-md sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={() => setUi({ mobileNavOpen: true })}>
            <MenuIcon />
          </Button>
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" aria-label="Toggle sidebar" onClick={toggle}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Tooltip>
          <div className="mx-1 hidden h-5 w-px bg-line lg:block" />
          <Breadcrumbs mode={mode} />
          <div className="ml-auto flex items-center gap-1">
            <DemoChip className="mr-1 hidden md:inline-flex" />
            <Tooltip content="Search" shortcut="Ctrl K">
              <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setUi({ paletteOpen: true })}>
                <Search />
              </Button>
            </Tooltip>
            <Notifications />
            <ThemeToggle />
            <div className="ml-1">
              <UserMenu mode={mode} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
