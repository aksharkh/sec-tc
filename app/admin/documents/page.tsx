import type { Metadata } from "next";
import { AdminDocuments } from "@/components/admin/documents";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return <AdminDocuments />;
}
