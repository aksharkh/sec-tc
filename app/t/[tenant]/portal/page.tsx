import type { Metadata } from "next";
import { ReviewerPortal } from "@/components/tenant/portal";
import { UnknownTenant } from "@/components/tenant/public-page";

export const metadata: Metadata = { title: { absolute: "Reviewer portal | Northwind Cloud Trust Center" } };

export default async function Page(props: PageProps<"/t/[tenant]/portal">) {
  const { tenant } = await props.params;
  if (tenant !== "northwind") return <UnknownTenant slug={tenant} />;
  return <ReviewerPortal />;
}
