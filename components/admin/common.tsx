"use client";

import * as React from "react";
import { nowMs } from "@/lib/utils";
import { Skeleton } from "@/components/ui/display";
import { Badge, type Tone } from "@/components/ui/badge";
import type { LogAction, Reviewer } from "@/lib/types";
import { AGENCIES } from "@/lib/mock/catalog";
import { effectiveStatus } from "@/lib/store";

export function PageSkeleton({ stats = 4, table = true }: { stats?: number; table?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between gap-4 pb-6">
        <div>
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3 h-8 w-64" />
          <Skeleton className="mt-3 h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="hidden h-9 w-36 sm:block" />
      </div>
      {stats > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-20" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      )}
      {table && (
        <div className="card mt-4 overflow-hidden">
          <div className="border-b border-line p-3">
            <Skeleton className="h-8 w-60" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${50 + ((i * 13) % 35)}%` }} />
              <Skeleton className="hidden h-3.5 w-24 sm:block" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const agencyName = (id: string) => AGENCIES.find((a) => a.id === id)?.name ?? "Other organization";

/** Display organization for a reviewer: the agency, or what they typed when they are not on the agency list. */
export const reviewerOrg = (r: { agencyId: string; org?: string }) => (r.agencyId === "other" && r.org ? r.org : agencyName(r.agencyId));
export const agencyShort = (id: string) => AGENCIES.find((a) => a.id === id)?.short ?? "Other";

export const ACTION_LABEL: Record<LogAction, string> = {
  sign_in: "Signed in",
  view: "Viewed",
  download: "Downloaded",
  download_all: "Downloaded all",
  api_fetch: "API fetch",
};

export const ACTION_TONE: Record<LogAction, Tone> = {
  sign_in: "neutral",
  view: "info",
  download: "brand",
  download_all: "brand",
  api_fetch: "review",
};

export function ReviewerStatusBadge({ r }: { r: Reviewer }) {
  const s = effectiveStatus(r);
  const soon = s === "active" && r.expiresAt && new Date(r.expiresAt).getTime() - nowMs() < 14 * 86400000;
  if (s === "active")
    return soon ? (
      <Badge tone="warning" dot>
        Expires soon
      </Badge>
    ) : (
      <Badge tone="success" dot>
        Active
      </Badge>
    );
  if (s === "expired")
    return (
      <Badge tone="neutral" dot>
        Expired
      </Badge>
    );
  return (
    <Badge tone="danger" dot>
      Revoked
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: "web" | "api" }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[5px] border border-line-strong px-1.5 font-mono text-[10.5px] font-medium uppercase text-muted">{channel}</span>
  );
}
