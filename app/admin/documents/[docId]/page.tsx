import type { Metadata } from "next";
import { DocumentDetail } from "@/components/admin/document-detail";

export const metadata: Metadata = { title: "Document" };

export default async function Page(props: PageProps<"/admin/documents/[docId]">) {
  const { docId } = await props.params;
  return <DocumentDetail id={docId} />;
}
