"use client";

import * as React from "react";
import Link from "next/link";
import { SecureKnotsLogo } from "@/components/brand/SecureKnotsLogo";
import { useTrust } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Northwind Cloud's fictional mark: an N whose right stroke points north. */
export function NorthwindMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn("shrink-0 text-tenant", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M10.5 23V10.5L21.5 23V9" fill="none" stroke="var(--tenant-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.3 11.8 21.5 8.6l3.2 3.2" fill="none" stroke="var(--tenant-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TenantLogo({ size = 28, className }: { size?: number; className?: string }) {
  const logo = useTrust((s) => s.branding.logo);
  if (logo) {
    // Uploaded logos are data URLs kept in the browser for the demo.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className={cn("shrink-0 rounded-[8px] object-contain", className)} style={{ width: size, height: size }} />;
  }
  return <NorthwindMark size={size} className={className} />;
}

export function TenantWordmark({ sub = "Trust Center", href = "/t/northwind" }: { sub?: string; href?: string }) {
  const name = useTrust((s) => s.branding.displayName);
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-2.5 rounded-[8px] outline-offset-4">
      <TenantLogo size={30} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14.5px] font-semibold tracking-[-0.015em] text-fg" suppressHydrationWarning>
          {name}
        </span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
    </Link>
  );
}

export function ManagedBy({ className }: { className?: string }) {
  return (
    <a
      href="https://secureknots.com"
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-2 rounded-full text-[12.5px] text-muted transition-colors hover:text-fg", className)}
    >
      <SecureKnotsLogo className="h-[18px] w-auto" onDark />
      <span>
        Trust center managed by <span className="font-medium text-fg">SecureKnots</span>
      </span>
    </a>
  );
}

export function TenantFooter() {
  const legal = useTrust((s) => s.profile.legal);
  return (
    <footer className="border-t border-line bg-surface/60 pb-24 dark:bg-transparent">
      <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-start">
        <div className="max-w-xl">
          <div className="flex items-center gap-2.5">
            <TenantLogo size={22} />
            <span className="text-[13.5px] font-medium text-fg" suppressHydrationWarning>
              {legal}
            </span>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            FedRAMP status on this page is issued by FedRAMP and shown here for convenience. SecureKnots manages this trust center on Northwind&apos;s
            behalf; it shares documents and does not grant, change or vouch for any certification.
          </p>
        </div>
        <ManagedBy />
      </div>
    </footer>
  );
}
