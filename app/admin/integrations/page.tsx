import type { Metadata } from "next";
import { AdminIntegrations } from "@/components/admin/integrations";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <AdminIntegrations />;
}
