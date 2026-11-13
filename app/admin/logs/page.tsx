import type { Metadata } from "next";
import { AdminLogs } from "@/components/admin/logs";

export const metadata: Metadata = { title: "Access logs" };

export default function Page() {
  return <AdminLogs />;
}
