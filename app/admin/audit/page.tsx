import type { Metadata } from "next";
import { AdminAudit } from "@/components/admin/audit";

export const metadata: Metadata = { title: "Audit trail" };

export default function Page() {
  return <AdminAudit />;
}
