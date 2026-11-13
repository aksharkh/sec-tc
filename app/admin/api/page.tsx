import type { Metadata } from "next";
import { AdminApi } from "@/components/admin/api";

export const metadata: Metadata = { title: "API" };

export default function Page() {
  return <AdminApi />;
}
