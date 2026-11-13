import type { Metadata } from "next";
import { AdminSnapshots } from "@/components/admin/snapshots";

export const metadata: Metadata = { title: "Snapshots" };

export default function Page() {
  return <AdminSnapshots />;
}
