import type { Metadata } from "next";
import { AdminUpdates } from "@/components/admin/updates";

export const metadata: Metadata = { title: "Updates and notices" };

export default function Page() {
  return <AdminUpdates />;
}
