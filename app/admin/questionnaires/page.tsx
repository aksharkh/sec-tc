import type { Metadata } from "next";
import { AdminQuestionnaires } from "@/components/admin/questionnaires";

export const metadata: Metadata = { title: "Q&A and questionnaires" };

export default function Page() {
  return <AdminQuestionnaires />;
}
