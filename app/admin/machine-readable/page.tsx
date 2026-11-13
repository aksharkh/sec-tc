import type { Metadata } from "next";
import { AdminMachineReadable } from "@/components/admin/machine-readable";

export const metadata: Metadata = { title: "Machine-readable" };

export default function Page() {
  return <AdminMachineReadable />;
}
