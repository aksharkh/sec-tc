"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Activity,
  ChartNoAxesColumn,
  Blocks,
  ClipboardList,
  Megaphone,
  MessagesSquare,
  Network,
  Braces,
  Building2,
  CornerDownLeft,
  FileText,
  Globe2,
  History,
  KeyRound,
  LayoutDashboard,
  Moon,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useTrust } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { Kbd } from "@/components/ui/badge";
import { resetDemo } from "./demo-switcher";

export const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, group: "Trust center" },
  { href: "/admin/documents", label: "Documents", icon: FileText, group: "Trust center" },
  { href: "/admin/access", label: "Access", icon: UsersRound, group: "Trust center" },
  { href: "/admin/logs", label: "Access logs", icon: ScrollText, group: "Trust center" },
  { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesColumn, group: "Trust center" },
  { href: "/admin/updates", label: "Updates and notices", icon: Megaphone, group: "Engagement" },
  { href: "/admin/questionnaires", label: "Q&A and questionnaires", icon: MessagesSquare, group: "Engagement" },
  { href: "/admin/subprocessors", label: "Subprocessors", icon: Network, group: "Engagement" },
  { href: "/admin/status", label: "Service status", icon: Activity, group: "Engagement" },
  { href: "/admin/machine-readable", label: "Machine-readable", icon: Braces, group: "Data and integrations" },
  { href: "/admin/api", label: "API", icon: KeyRound, group: "Data and integrations" },
  { href: "/admin/integrations", label: "Integrations", icon: Blocks, group: "Data and integrations" },
  { href: "/admin/snapshots", label: "Snapshots", icon: History, group: "Data and integrations" },
  { href: "/admin/audit", label: "Audit trail", icon: ClipboardList, group: "Workspace" },
  { href: "/admin/settings", label: "Settings", icon: Settings, group: "Workspace" },
];

const item =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] text-fg outline-none data-[selected=true]:bg-subtle [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted";

export function CommandPalette() {
  const router = useRouter();
  const open = useUi((s) => s.paletteOpen);
  const setUi = useUi((s) => s.set);
  const docs = useTrust((s) => s.documents);
  const reviewers = useTrust((s) => s.reviewers);
  const regenerate = useTrust((s) => s.regeneratePackage);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setUi({ paletteOpen: !useUi.getState().paletteOpen });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setUi]);

  const run = (fn: () => void) => {
    setUi({ paletteOpen: false });
    setTimeout(fn, 10);
  };

  return (
    <D.Root open={open} onOpenChange={(v) => setUi({ paletteOpen: v })}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[12px] border border-line bg-surface shadow-lg outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in dark:bg-raised">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search pages, documents and reviewers, or run an action.</D.Description>
          <Command loop className="flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-faint" />
              <Command.Input
                autoFocus
                placeholder="Search pages, documents, reviewers or actions"
                className="h-12 w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="scroll-thin max-h-[min(420px,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-[13.5px] text-muted">No results. Try a document title or a reviewer&apos;s name.</Command.Empty>
              <Group heading="Actions">
                <Command.Item className={item} onSelect={() => run(() => { setUi({ uploadOpen: true }); router.push("/admin/documents"); })}>
                  <Upload /> Upload a document
                </Command.Item>
                <Command.Item
                  className={item}
                  onSelect={() =>
                    run(() => {
                      regenerate();
                      toast.success("Package JSON regenerated and validated");
                    })
                  }
                >
                  <RefreshCw /> Regenerate and validate package JSON
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                  <Moon /> Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(resetDemo)}>
                  <RotateCcw /> Reset demo data
                </Command.Item>
              </Group>
              <Group heading="Go to">
                {ADMIN_NAV.map((n) => (
                  <Command.Item key={n.href} value={`go ${n.label}`} className={item} onSelect={() => run(() => router.push(n.href))}>
                    <n.icon /> {n.label}
                  </Command.Item>
                ))}
                <Command.Item value="go public trust page" className={item} onSelect={() => run(() => router.push("/t/northwind"))}>
                  <Globe2 /> Public trust page
                </Command.Item>
                <Command.Item value="go reviewer portal" className={item} onSelect={() => run(() => router.push("/t/northwind/portal"))}>
                  <UserRound /> Reviewer portal
                </Command.Item>
                <Command.Item value="go platform all trust centers" className={item} onSelect={() => run(() => router.push("/platform"))}>
                  <Building2 /> All trust centers
                </Command.Item>
              </Group>
              <Group heading="Documents">
                {docs.map((d) => (
                  <Command.Item key={d.id} value={`doc ${d.title} ${d.practices.join(" ")}`} className={item} onSelect={() => run(() => router.push(`/admin/documents/${d.id}`))}>
                    <FileText />
                    <span className="truncate">{d.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11.5px] text-faint">v{d.versions[0]!.version}</span>
                  </Command.Item>
                ))}
              </Group>
              <Group heading="Reviewers">
                {reviewers.map((r) => (
                  <Command.Item key={r.id} value={`reviewer ${r.name} ${r.handle}`} className={item} onSelect={() => run(() => router.push(`/admin/access?tab=inventory&q=${encodeURIComponent(r.name)}`))}>
                    <UserRound />
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto shrink-0 truncate text-[12px] text-faint">{r.handle}</span>
                  </Command.Item>
                ))}
              </Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to move
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                to open
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint"
    >
      {children}
    </Command.Group>
  );
}
