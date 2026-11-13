"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ColumnDef } from "@tanstack/react-table";
import { Play, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { CodeViewer } from "@/components/kit/code";
import { CopyButton, EmptyState } from "@/components/kit/bits";
import { ENDPOINTS, MethodBadge } from "@/components/tenant/api-reference";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/display";
import { Segmented, Select } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { useTrust } from "@/lib/store";
import { CATEGORY_LABEL } from "@/lib/mock/catalog";
import type { DocCategory, LogEvent } from "@/lib/types";
import { cn, fakeHash, fmt, mulberry32, nowMs, sleep, uid } from "@/lib/utils";
import { agencyShort } from "./common";

const SCOPE_FOR: Record<string, string> = {
  package: "package:read",
  documents: "documents:read",
  document: "documents:read",
  download: "documents:read",
  "access-log": "logs:read:own",
};

type Response = { status: number; ms: number; headers: Record<string, string>; body: unknown; at: string; path: string; keyName: string };

const STATUS_TEXT: Record<number, string> = { 200: "OK", 304: "Not Modified", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found" };

/** Waits a realistic network time and returns how long it took. */
async function simulatedLatency() {
  const started = performance.now();
  await sleep(320 + Math.random() * 260);
  return Math.round(performance.now() - started);
}

function statusTone(code: number) {
  return code < 300 ? "success" : code < 400 ? "neutral" : "danger";
}

/* ───────── Playground ───────── */
export function Playground() {
  const keys = useTrust((s) => s.apiKeys);
  const docs = useTrust((s) => s.documents);
  const pkg = useTrust((s) => s.pkg);
  const logs = useTrust((s) => s.logs);
  const host = useTrust((s) => s.domain.host);
  const logEvent = useTrust((s) => s.logEvent);

  const [keyId, setKeyId] = React.useState(keys.find((k) => k.status === "active")?.id ?? keys[0]?.id ?? "");
  const [ep, setEp] = React.useState("package");
  const [docId, setDocId] = React.useState("poam");
  const [version, setVersion] = React.useState("");
  const [category, setCategory] = React.useState<"" | DocCategory>("");
  const [since, setSince] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<Response | null>(null);
  const [history, setHistory] = React.useState<Response[]>([]);
  const [view, setView] = React.useState<"body" | "headers">("body");

  const key = keys.find((k) => k.id === keyId);
  const base = `https://${host}/api/v1`;
  const doc = docs.find((d) => d.id === docId);

  const path = (() => {
    if (ep === "package") return "/package";
    if (ep === "documents") {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (since) qs.set("updated_since", since);
      const s = qs.toString();
      return `/documents${s ? `?${s}` : ""}`;
    }
    if (ep === "document") return `/documents/${docId}`;
    if (ep === "download") return `/documents/${docId}/download${version ? `?version=${version}` : ""}`;
    return "/access-log";
  })();
  const curl = `curl "${base}${path}" \\\n  -H "Authorization: Bearer ${key ? `${key.prefix}••••${key.last4}` : "$SKT_API_KEY"}"`;

  const send = async () => {
    if (!key) return;
    setBusy(true);
    const ms = await simulatedLatency();
    const now = new Date();
    const usedToday = logs.filter((e) => e.channel === "api" && e.agencyId === key.agencyId && nowMs() - new Date(e.at).getTime() < 3600_000).length;
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": `req_${uid("x").slice(2)}`,
      "x-ratelimit-limit": "600",
      "x-ratelimit-remaining": String(Math.max(0, 599 - usedToday)),
      "cache-control": "no-store",
      date: now.toUTCString(),
    };
    let status = 200;
    let body: unknown;
    const need = SCOPE_FOR[ep]!;
    if (key.status !== "active") {
      status = 401;
      body = { error: "invalid_key", message: "This API key was revoked. Ask Northwind for a new one." };
    } else if (!key.scopes.includes(need)) {
      status = 403;
      body = { error: "insufficient_scope", message: `This key does not have the ${need} scope.`, required_scope: need, key_scopes: key.scopes };
    } else if (ep === "package") {
      const full = JSON.parse(pkg.published) as Record<string, unknown> & { documents: unknown[] };
      body = { ...full, documents: full.documents.slice(0, 3), _truncated: `${full.documents.length - 3} more documents omitted in the playground` };
      headers.etag = `"${fakeHash(pkg.published, 16)}"`;
    } else if (ep === "documents") {
      const list = docs
        .filter((d) => (!category || d.category === category) && (!since || d.versions[0]!.publishedAt.slice(0, 10) >= since))
        .map((d) => ({ id: d.id, title: d.title, category: d.category, version: d.versions[0]!.version, updated: d.versions[0]!.publishedAt.slice(0, 10), visibility: d.visibility }));
      body = { data: list, count: list.length, next_cursor: null };
    } else if (ep === "document") {
      if (!doc) {
        status = 404;
        body = { error: "not_found", message: `No document with id "${docId}".` };
      } else {
        body = {
          id: doc.id,
          title: doc.title,
          category: doc.category,
          visibility: doc.visibility,
          practices: doc.practices,
          versions: doc.versions.map((v) => ({ version: v.version, published_at: v.publishedAt.slice(0, 10), note: v.note, pages: v.pages })),
        };
      }
    } else if (ep === "download") {
      const v = doc ? (version ? doc.versions.find((x) => x.version === version) : doc.versions[0]) : undefined;
      if (!doc || !v) {
        status = 404;
        body = { error: "not_found", message: doc ? `Version ${version} of "${docId}" does not exist.` : `No document with id "${docId}".` };
      } else {
        body = {
          url: `https://files.trust.secureknots.com/northwind/${doc.id}/${v.version}?sig=${fakeHash(doc.id + now.toISOString(), 24)}`,
          expires_at: new Date(now.getTime() + 5 * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
          version: v.version,
          sha256: fakeHash(`${doc.id}@${v.version}`),
          watermark: `${key.name} · ${now.toISOString().slice(0, 10)}`,
        };
      }
    } else {
      body = {
        data: logs
          .filter((e) => e.agencyId === key.agencyId)
          .slice(0, 8)
          .map((e) => ({ at: e.at.replace(/\.\d{3}Z$/, "Z"), actor: e.actorKind === "system" ? e.handle : e.actor, action: e.action, target: e.target, channel: e.channel })),
        next_cursor: "c_8",
      };
    }
    const r: Response = { status, ms, headers, body, at: now.toISOString(), path, keyName: key.name };
    setRes(r);
    setHistory((h) => [r, ...h].slice(0, 6));
    setBusy(false);
    if (status === 200) {
      logEvent({
        actor: key.name,
        handle: `${key.agencyId}-api`,
        actorKind: "system",
        agencyId: key.agencyId,
        docId: ep === "document" || ep === "download" ? docId : undefined,
        target: ep === "package" ? "Certification Package Overview (JSON)" : ep === "access-log" ? "Own access records" : ep === "documents" ? "Document list" : (doc?.title ?? docId),
        action: ep === "download" ? "download" : "api_fetch",
        channel: "api",
      });
    }
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <Card className="h-fit min-w-0">
        <CardHeader title="Request" description="Calls run against this trust center's demo data and are written to the access log." />
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
          <Field label="API key">
            <Select
              ariaLabel="API key"
              value={keyId}
              onValueChange={setKeyId}
              options={keys.map((k) => ({ value: k.id, label: `${k.name} (${k.prefix}••••${k.last4})`, hint: k.status === "active" ? k.scopes.join(", ") : "Revoked" }))}
            />
          </Field>
          <Field label="Endpoint">
            <Select ariaLabel="Endpoint" value={ep} onValueChange={(v) => { setEp(v); setRes(null); }} options={ENDPOINTS.map((e) => ({ value: e.id, label: `GET ${e.path}`, hint: e.title }))} />
          </Field>
          {(ep === "document" || ep === "download") && (
            <Field label="Document id" hint="Try a wrong id to see a 404.">
              <Input value={docId} onChange={(e) => setDocId(e.target.value)} className="font-mono" list="pg-doc-ids" />
              <datalist id="pg-doc-ids">
                {docs.map((d) => (
                  <option key={d.id} value={d.id} />
                ))}
              </datalist>
            </Field>
          )}
          {ep === "download" && (
            <Field label="Version" optional hint={doc ? `Available: ${doc.versions.map((v) => v.version).join(", ")}` : undefined}>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Latest" className="font-mono" />
            </Field>
          )}
          {ep === "documents" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" optional>
                <Select
                  ariaLabel="Category"
                  value={category || "all"}
                  onValueChange={(v) => setCategory(v === "all" ? "" : (v as DocCategory))}
                  options={[{ value: "all", label: "Any" }, ...(Object.keys(CATEGORY_LABEL) as DocCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]}
                />
              </Field>
              <Field label="Updated since" optional>
                <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </Field>
            </div>
          )}
          <div className="rounded-[8px] bg-subtle px-3 py-2 text-[12px] text-muted">
            Needs scope <span className="font-mono text-fg">{SCOPE_FOR[ep]}</span>
            {key && !key.scopes.includes(SCOPE_FOR[ep]!) && <span className="text-danger-fg"> · this key doesn&apos;t have it</span>}
          </div>
          <Button variant="primary" onClick={send} loading={busy} disabled={!key}>
            <Play /> Send request
          </Button>
          <CodeViewer language="shell" code={curl} title="curl" maxHeight={120} />
        </div>
      </Card>

      <div className="grid min-w-0 grid-cols-1 content-start gap-4">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <MethodBadge method="GET" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">/api/v1{res?.path ?? path}</span>
            {res && (
              <>
                <Badge tone={statusTone(res.status)}>
                  {res.status} {STATUS_TEXT[res.status]}
                </Badge>
                <span className="text-[12px] text-muted">{res.ms} ms</span>
              </>
            )}
          </div>
          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              {busy ? (
                <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-[320px] place-items-center text-[13px] text-muted">
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> Waiting for response
                  </span>
                </motion.div>
              ) : res ? (
                <motion.div key={res.at} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Segmented size="sm" layoutId="pg-view" value={view} onChange={setView} options={[{ value: "body", label: "Body" }, { value: "headers", label: "Headers" }]} />
                  <div className="mt-3">
                    {view === "body" ? (
                      <CodeViewer code={JSON.stringify(res.body, null, 2)} title={`${res.status} ${STATUS_TEXT[res.status]}`} maxHeight={420} />
                    ) : (
                      <dl className="divide-y divide-line rounded-[10px] border border-line">
                        {Object.entries(res.headers).map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[170px_minmax(0,1fr)] gap-3 px-3 py-2 font-mono text-[12px]">
                            <dt className="text-muted">{k}</dt>
                            <dd className="truncate text-fg">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </motion.div>
              ) : (
                <EmptyState compact title="Send a request" body="Pick a key and an endpoint. A revoked key returns 401; a key without the scope returns 403." />
              )}
            </AnimatePresence>
          </div>
        </Card>
        {history.length > 0 && (
          <Card className="min-w-0">
            <CardHeader
              title="This session"
              description="Successful calls also appear in the request log"
              action={
                <Button size="xs" variant="ghost" onClick={() => setHistory([])}>
                  <RotateCcw /> Clear
                </Button>
              }
            />
            <ul className="mt-2 divide-y divide-line">
              {history.map((h) => (
                <li key={h.at} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px] sm:px-5">
                  <Badge tone={statusTone(h.status)}>{h.status}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-fg">{h.path}</span>
                  <span className="hidden truncate text-muted sm:inline">{h.keyName}</span>
                  <span className="shrink-0 text-faint">{h.ms} ms</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ───────── Request log ───────── */
type ApiRow = { id: string; at: string; client: string; agencyId: string; path: string; status: number; ms: number; ip: string };

function toRow(e: LogEvent): ApiRow {
  const r = mulberry32(parseInt(fakeHash(e.id, 8), 16));
  const roll = r();
  const status = roll < 0.93 ? 200 : roll < 0.97 ? 304 : 401;
  const path = e.target.startsWith("Certification Package")
    ? "/api/v1/package"
    : e.target === "Own access records"
      ? "/api/v1/access-log"
      : e.target === "Document list"
        ? "/api/v1/documents"
        : e.docId
          ? e.action === "download"
            ? `/api/v1/documents/${e.docId}/download`
            : `/api/v1/documents/${e.docId}`
          : "/api/v1/documents";
  return { id: e.id, at: e.at, client: e.actor, agencyId: e.agencyId, path, status, ms: Math.round(60 + r() * 340), ip: e.ip };
}

export function RequestLog() {
  const logs = useTrust((s) => s.logs);
  const rows = React.useMemo(() => logs.filter((e) => e.channel === "api").map(toRow), [logs]);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "2xx" | "3xx" | "4xx">("all");
  const data = React.useMemo(
    () => rows.filter((r) => status === "all" || (status === "2xx" ? r.status < 300 : status === "3xx" ? r.status >= 300 && r.status < 400 : r.status >= 400)),
    [rows, status],
  );
  const errors = rows.filter((r) => r.status >= 400).length;
  const sorted = [...rows].map((r) => r.ms).sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

  const columns = React.useMemo<ColumnDef<ApiRow, unknown>[]>(
    () => [
      { id: "at", header: "Time", accessorFn: (r) => r.at, cell: ({ getValue }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{fmt.day(String(getValue()))}</span> },
      {
        id: "client",
        header: "Client",
        accessorFn: (r) => `${r.client} ${agencyShort(r.agencyId)}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-fg">{row.original.client}</div>
            <div className="text-[12px] text-muted">{agencyShort(row.original.agencyId)}</div>
          </div>
        ),
        meta: { className: "max-w-[220px]" },
      },
      {
        id: "path",
        header: "Request",
        accessorFn: (r) => r.path,
        cell: ({ getValue }) => (
          <span className="flex items-center gap-2">
            <MethodBadge method="GET" />
            <span className="truncate font-mono text-[12px] text-fg">{String(getValue())}</span>
          </span>
        ),
        meta: { className: "max-w-[320px]" },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.status,
        cell: ({ getValue }) => {
          const c = Number(getValue());
          return <Badge tone={statusTone(c)}>{c}</Badge>;
        },
      },
      { id: "ms", header: "Latency", accessorFn: (r) => r.ms, cell: ({ getValue }) => <span className="text-[12.5px] text-muted">{String(getValue())} ms</span>, meta: { align: "right", hideBelow: "md" } },
      { id: "ip", header: "IP", accessorFn: (r) => r.ip, cell: ({ getValue }) => <span className="font-mono text-[12px] text-muted">{String(getValue())}</span>, meta: { hideBelow: "lg" } },
    ],
    [],
  );

  return (
    <div className="mt-5">
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
        {[
          { k: "API requests, 6 months", v: fmt.num(rows.length) },
          { k: "Errors (4xx)", v: `${errors} · ${rows.length ? ((errors / rows.length) * 100).toFixed(1) : "0"}%` },
          { k: "p95 latency", v: `${p95} ms` },
        ].map((s) => (
          <div key={s.k} className="card p-4">
            <div className="text-[12.5px] text-muted">{s.k}</div>
            <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-fg">{s.v}</div>
          </div>
        ))}
      </div>
      <DataTable
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search client, agency or path"
        pageSize={25}
        initialSorting={[{ id: "at", desc: true }]}
        rowClassName={(r) => cn(r.status >= 400 && "bg-danger-soft/40")}
        filters={
          <>
            {(["all", "2xx", "3xx", "4xx"] as const).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s === "all" ? "All statuses" : s}
              </Chip>
            ))}
          </>
        }
        empty={<EmptyState compact title="No API requests match" body="Change the filters, or send one from the playground." />}
      />
      <p className="mt-3 text-[12px] text-muted">
        Agencies can read their own entries through <span className="font-mono">GET /api/v1/access-log</span>. <CopyButton value="/api/v1/access-log" iconOnly label="Copy path" />
      </p>
    </div>
  );
}
