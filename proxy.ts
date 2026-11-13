import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * In production each client's trust center is served on its own domain
 * (trust.northwindcloud.com). This rewrites that host to the tenant route,
 * so the browser keeps the client's URL. The demo runs on localhost and uses
 * the /t/<tenant> paths directly, so nothing is rewritten there.
 */
const TENANT_HOSTS: Record<string, string> = {
  "trust.northwindcloud.com": "northwind",
  "trust.halcyonanalytics.com": "halcyon",
  "trust.copperlinedata.com": "copperline",
};

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const slug = TENANT_HOSTS[host] ?? (host.endsWith(".trust.secureknots.com") ? host.split(".")[0] : undefined);
  if (!slug) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/t/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/login")) return NextResponse.next();
  url.pathname = url.pathname === "/" ? `/t/${slug}` : url.pathname === "/portal" ? `/t/${slug}/portal` : url.pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
