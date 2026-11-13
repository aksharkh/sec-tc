import type { Metadata } from "next";
import { PlatformPage } from "@/components/platform/platform";

export const metadata: Metadata = { title: "All trust centers" };

export default function Page() {
  return <PlatformPage />;
}
