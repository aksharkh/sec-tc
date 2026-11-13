"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeViewer } from "@/components/kit/code";
import { Segmented } from "@/components/ui/controls";

export type Endpoint = {
  id: string;
  method: "GET";
  path: string;
  title: string;
  body: string;
  scope: string;
  example: (base: string) => string;
  response: string;
};

export const ENDPOINTS: Endpoint[] = [
  {
    id: "package",
    method: "GET",
    path: "/package",
    title: "Certification package overview",
    body: "The same JSON file published on the trust page, with signed links to the restricted documents your key can read.",
    scope: "package:read",
    example: (b) => `curl ${b}/package \\\n  -H "Authorization: Bearer $SKT_API_KEY"`,
    response: `{\n  "revision": 41,\n  "generated_at": "2026-11-13T07:02:11Z",\n  "certification": { "program": "FedRAMP 20x", "class": "C", "status": "certified" },\n  "documents": [ … ]\n}`,
  },
  {
    id: "documents",
    method: "GET",
    path: "/documents",
    title: "List documents",
    body: "Documents your key can read. Filter by category or by documents changed since a date.",
    scope: "documents:read",
    example: (b) => `curl "${b}/documents?category=package&updated_since=2026-10-01" \\\n  -H "Authorization: Bearer $SKT_API_KEY"`,
    response: `{\n  "data": [\n    { "id": "poam", "title": "Plan of Action and Milestones", "version": "14.0", "updated": "2026-11-01" }\n  ],\n  "next_cursor": null\n}`,
  },
  {
    id: "document",
    method: "GET",
    path: "/documents/{id}",
    title: "Get a document",
    body: "Metadata, FedRAMP practices and the full version history for one document.",
    scope: "documents:read",
    example: (b) => `curl ${b}/documents/poam \\\n  -H "Authorization: Bearer $SKT_API_KEY"`,
    response: `{\n  "id": "poam",\n  "visibility": "restricted",\n  "practices": ["KSI-MLA", "KSI-CMT"],\n  "versions": [ { "version": "14.0", "published_at": "2026-11-01" } ]\n}`,
  },
  {
    id: "download",
    method: "GET",
    path: "/documents/{id}/download",
    title: "Download a version",
    body: "Returns a signed URL that works for 5 minutes. Pass a version to get an older file; every download is logged.",
    scope: "documents:read",
    example: (b) => `curl "${b}/documents/poam/download?version=13.0" \\\n  -H "Authorization: Bearer $SKT_API_KEY"`,
    response: `{\n  "url": "https://files.trust.secureknots.com/…",\n  "expires_at": "2026-11-13T09:07:11Z",\n  "sha256": "9c1e…a40f"\n}`,
  },
  {
    id: "access-log",
    method: "GET",
    path: "/access-log",
    title: "Your access records",
    body: "Your organization's own access records for the last six months. You never see other agencies' records.",
    scope: "logs:read:own",
    example: (b) => `curl "${b}/access-log?from=2026-08-01" \\\n  -H "Authorization: Bearer $SKT_API_KEY"`,
    response: `{\n  "data": [\n    { "at": "2026-11-13T05:12:40Z", "actor": "ofsa-conmon-01", "action": "api_fetch", "target": "package" }\n  ]\n}`,
  },
];

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[5px] bg-success-soft px-1.5 font-mono text-[10.5px] font-semibold text-success-fg">{method}</span>
  );
}

export function ApiReference({ host, compact }: { host: string; compact?: boolean }) {
  const base = `https://${host}/api/v1`;
  const [active, setActive] = React.useState(ENDPOINTS[0]!.id);
  const [tab, setTab] = React.useState<"request" | "response">("request");
  const ep = ENDPOINTS.find((e) => e.id === active)!;
  return (
    <div className={cn("grid gap-4", !compact && "lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]")}>
      <ul className="grid grid-cols-1 gap-1">
        {ENDPOINTS.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => setActive(e.id)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors",
                active === e.id ? "bg-subtle" : "hover:bg-subtle/60",
              )}
            >
              <MethodBadge method={e.method} />
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] text-fg">{e.path}</span>
                <span className="block text-[12px] text-muted">{e.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={ep.method} />
          <span className="break-all font-mono text-[13px] text-fg">{ep.path}</span>
          <span className="rounded-full bg-subtle px-2 py-0.5 font-mono text-[11px] text-muted">{ep.scope}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{ep.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Segmented
            size="sm"
            layoutId={`api-tab-${compact ? "c" : "f"}`}
            value={tab}
            onChange={setTab}
            options={[
              { value: "request", label: "curl" },
              { value: "response", label: "Response" },
            ]}
          />
          <span className="hidden text-[12px] text-muted sm:inline">600 requests per hour per key</span>
        </div>
        <CodeViewer
          className="mt-2"
          code={tab === "request" ? ep.example(base) : ep.response}
          language={tab === "request" ? "shell" : "json"}
          title={tab === "request" ? "Request" : "200 OK"}
          maxHeight={260}
        />
      </div>
    </div>
  );
}
