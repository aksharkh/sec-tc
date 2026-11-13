import type { Metadata } from "next";
import { AdminSubprocessors } from "@/components/admin/subprocessors";

export const metadata: Metadata = { title: "Subprocessors" };

export default function Page() {
  return <AdminSubprocessors />;
}
