import type { Metadata } from "next";
import { AdminAccess } from "@/components/admin/access";

export const metadata: Metadata = { title: "Access" };

export default function Page() {
  return <AdminAccess />;
}
