import type { Metadata } from "next";
import { PublicTrustPage, UnknownTenant } from "@/components/tenant/public-page";

export async function generateMetadata(props: PageProps<"/t/[tenant]">): Promise<Metadata> {
  const { tenant } = await props.params;
  return tenant === "northwind"
    ? { title: { absolute: "Northwind Cloud Trust Center" }, description: "FedRAMP 20x certification package, audit reports and security policies for Northwind Workbench." }
    : { title: "Trust center" };
}

export default async function Page(props: PageProps<"/t/[tenant]">) {
  const { tenant } = await props.params;
  if (tenant !== "northwind") return <UnknownTenant slug={tenant} />;
  return <PublicTrustPage />;
}
