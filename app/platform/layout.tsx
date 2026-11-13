import { AppShell } from "@/components/shell/app-shell";

export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  return <AppShell mode="platform">{children}</AppShell>;
}
