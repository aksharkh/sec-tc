import type { Metadata } from "next";
import { AdminStatus } from "@/components/admin/status";

export const metadata: Metadata = { title: "Service status" };

export default function Page() {
  return <AdminStatus />;
}
