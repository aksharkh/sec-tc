import type { Metadata } from "next";
import { AdminAutomations } from "@/components/admin/automations";

export const metadata: Metadata = { title: "Automations" };

export default function Page() {
  return <AdminAutomations />;
}
