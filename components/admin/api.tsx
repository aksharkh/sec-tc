"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, KeyRound, Plus, ShieldAlert, TriangleAlert } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { CopyButton, EmptyState, PageHeader } from "@/components/kit/bits";
import { Legend, StackedBars } from "@/components/kit/charts";
import { StatCard } from "@/components/kit/widgets";
import { ApiReference } from "@/components/tenant/api-reference";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/display";
import { Checkbox, Select, Tabs } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useReady } from "@/lib/hooks";
import { LENGTH_LABEL, useTrust } from "@/lib/store";
import { AGENCIES } from "@/lib/mock/catalog";
import { inWindow, pctChange, weeklyCounts } from "@/lib/analytics";
import type { AccessLength, ApiKey, LogEvent } from "@/lib/types";
import { DAY, fmt } from "@/lib/utils";
import { PageSkeleton, agencyName, agencyShort } from "./common";
import { Playground, RequestLog } from "./api-tools";

const SCOPES = [
  { id: "package:read", label: "Package", body: "Read the Certification Package Overview JSON." },
  { id: "documents:read", label: "Documents", body: "List restricted documents and download versions." },
  { id: "logs:read:own", label: "Own access records", body: "Read this agency's own access records, never other agencies'." },
];

const isApi = (e: LogEvent) => e.channel === "api";

export function AdminApi() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={3} />;
  return <ApiBody />;
}

function ApiBody() {
  const keys = useTrust((s) => s.apiKeys);
  const logs = useTrust((s) => s.logs);
  const host = useTrust((s) => s.domain.host);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<ApiKey | null>(null);
  const [tab, setTab] = React.useState<"keys" | "playground" | "log" | "reference">("keys");

  const active = keys.filter((k) => k.status === "active");
  const cur = inWindow(logs, 30).filter(isApi).length;
  const prev = inWindow(logs, 60, 30).filter(isApi).length;
  const lastUsed = active.map((k) => k.lastUsedAt).filter((x): x is string => !!x).sort().at(-1);

  const columns = React.useMemo<ColumnDef<ApiKey, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Key",
        cell: ({ row }) => {
          const k = row.original;
          return (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-fg">{k.name}</div>
              <div className="font-mono text-[11.5px] text-faint">
                {k.prefix}
                {"••••"}
                {k.last4}
              </div>
            </div>
          );
        },
      },
      {
        id: "agency",
        accessorFn: (k) => agencyName(k.agencyId),
        header: "Agency",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-fg" title={agencyName(row.original.agencyId)}>
            {agencyShort(row.original.agencyId)}
          </span>
        ),
      },
      {
        id: "scopes",
        header: "Scopes",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex max-w-[260px] flex-wrap gap-1">
            {row.original.scopes.map((s) => (
              <span key={s} className="rounded-[4px] bg-subtle px-1.5 py-px font-mono text-[11px] text-muted">
                {s}
              </span>
            ))}
          </div>
        ),
        meta: { hideBelow: "md" },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="text-[13px] text-fg">{fmt.date(row.original.createdAt)}</div>
            <div className="text-[11.5px] text-faint">by {row.original.createdBy}</div>
          </div>
        ),
        meta: { hideBelow: "lg" },
      },
      {
        accessorKey: "lastUsedAt",
        header: "Last used",
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-muted">{row.original.lastUsedAt ? fmt.ago(row.original.lastUsedAt) : "Never"}</span>,
      },
      {
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-muted">{row.original.expiresAt ? fmt.date(row.original.expiresAt) : "No expiry"}</span>,
        meta: { hideBelow: "sm" },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <Badge tone="success" dot>
              Active
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              Revoked
            </Badge>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <Button size="xs" variant="danger-ghost" onClick={() => setRevoking(row.original)}>
              Revoke
            </Button>
          ) : null,
        meta: { align: "right" },
      },
    ],
    [],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Data and integrations"
        title="API"
        description="Agency systems pull the package, restricted documents and their own access records with a key issued per agency. Every call is logged."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus />
            Create key
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active keys" value={fmt.num(active.length)} footer={`${keys.length - active.length} revoked or expired`} icon={<KeyRound />} />
        <StatCard label="API requests" value={fmt.num(cur)} delta={pctChange(cur, prev)} trend={weeklyCounts(logs, isApi)} icon={<Activity />} />
        <StatCard label="Last request" value={lastUsed ? fmt.ago(lastUsed).replace(" ago", "") : "None"} footer={lastUsed ? `ago · ${fmt.dateTime(lastUsed)}` : "No key has been used yet"} icon={<Activity />} />
      </div>

      <Tabs
        className="mt-6"
        layoutId="api-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "keys", label: "Keys", count: keys.length },
          { value: "playground", label: "Playground" },
          { value: "log", label: "Request log" },
          { value: "reference", label: "Reference" },
        ]}
      />

      {tab === "keys" && (
      <>
      <div className="mt-5">
        <DataTable
          data={keys}
          columns={columns}
          getRowId={(k) => k.id}
          minWidth={680}
          maxHeight={520}
          rowClassName={(k) => (k.status === "revoked" ? "opacity-60" : undefined)}
          filters={<span className="text-[13px] font-medium text-fg">{keys.length} {keys.length === 1 ? "key" : "keys"}</span>}
          empty={
            <EmptyState
              compact
              title="No API keys yet"
              body="Create a key for an agency's system, then share it through the agency's secure channel."
              action={
                <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
                  Create key
                </Button>
              }
            />
          }
        />
      </div>

      <div className="mt-4">
        <UsageCard logs={logs} keys={keys} />
      </div>
      </>
      )}

      {tab === "playground" && <Playground />}
      {tab === "log" && <RequestLog />}
      {tab === "reference" && (
        <Card className="mt-5 min-w-0">
          <CardHeader title="Endpoint reference" description={`Base URL https://${host}/api/v1 · send the key as a bearer token`} />
          <div className="p-4 sm:p-5">
            <ApiReference host={host} />
          </div>
        </Card>
      )}

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RevokeDialog keyToRevoke={revoking} onClose={() => setRevoking(null)} />
    </motion.div>
  );
}

/** Requests per day for 30 days: the busiest agency, then everyone else (two validated chart colors). */
function usageSeries(logs: LogEvent[], keys: ApiKey[]) {
  const now = Date.now();
  const api = logs.filter((e) => isApi(e) && now - new Date(e.at).getTime() < 30 * DAY);
  const byAgency = new Map<string, number>();
  for (const e of api) byAgency.set(e.agencyId, (byAgency.get(e.agencyId) ?? 0) + 1);
  // Agencies that hold keys, busiest first. Two validated colors: the busiest agency, then everyone else.
  const keyAgencies = [...new Set(keys.map((k) => k.agencyId))];
  const ranked = [...new Set([...byAgency.keys(), ...keyAgencies])].sort((a, b) => (byAgency.get(b) ?? 0) - (byAgency.get(a) ?? 0));
  const first = ranked[0];
  const rest = ranked.slice(1);
  const s = [
    ...(first ? [{ key: "s1", label: agencyName(first), color: "var(--chart-1)" }] : []),
    ...(rest.length ? [{ key: "s2", label: rest.length === 1 ? agencyName(rest[0]!) : "Other agencies", color: "var(--chart-2)" }] : []),
  ];
  const buckets = new Map<string, Record<string, string | number>>();
  for (let i = 29; i >= 0; i--) {
    const d = startOfDay(new Date(now - i * DAY));
    buckets.set(format(d, "yyyy-MM-dd"), { label: format(d, "MMM d"), s1: 0, s2: 0 });
  }
  for (const e of api) {
    const b = buckets.get(format(startOfDay(new Date(e.at)), "yyyy-MM-dd"));
    if (!b) continue;
    const k = e.agencyId === first ? "s1" : "s2";
    b[k] = Number(b[k]) + 1;
  }
  return { data: [...buckets.values()], series: s, total: api.length };
}

function UsageCard({ logs, keys }: { logs: LogEvent[]; keys: ApiKey[] }) {
  const { data, series, total } = React.useMemo(() => usageSeries(logs, keys), [logs, keys]);

  return (
    <Card className="min-w-0">
      <CardHeader title="Usage" description={`${fmt.num(total)} requests per day, last 30 days`} />
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {total ? (
          <>
            <Legend series={series} />
            <div className="mt-3">
              <StackedBars data={data} series={series} xKey="label" unit="requests" height={220} />
            </div>
          </>
        ) : (
          <EmptyState compact title="No API calls yet" body="Requests appear here once an agency system uses its key." />
        )}
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-muted">
          <ShieldAlert className="size-3.5 shrink-0" />
          Rate limit 600 requests per hour per key. Requests over the limit get HTTP 429 and are logged.
        </p>
      </div>
    </Card>
  );
}

const AGENCY_OPTIONS = AGENCIES.filter((a) => a.kind === "agency" || a.kind === "assessor").map((a) => ({
  value: a.id,
  label: a.name,
  hint: a.domain,
}));

function CreateKeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createApiKey = useTrust((s) => s.createApiKey);
  const [name, setName] = React.useState("");
  const [agency, setAgency] = React.useState(AGENCY_OPTIONS[0]!.value);
  const [scopes, setScopes] = React.useState<string[]>(["package:read", "documents:read"]);
  const [expiry, setExpiry] = React.useState<AccessLength>("1y");
  const [touched, setTouched] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);

  const errors = {
    name: name.trim().length < 3 ? "Name the key after the system that will use it." : "",
    scopes: scopes.length === 0 ? "Choose at least one scope." : "",
  };

  const reset = () => {
    setName("");
    setAgency(AGENCY_OPTIONS[0]!.value);
    setScopes(["package:read", "documents:read"]);
    setExpiry("1y");
    setTouched(false);
    setSecret(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.scopes) return;
    const s = createApiKey({ name, agencyId: agency, scopes, expiry });
    setSecret(s);
    toast.success("API key created", { description: `${name.trim()} · ${agencyName(agency)}` });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="md">
        {secret ? (
          <div>
            <DialogHeader title="Copy the key now" description={`${name.trim()} for ${agencyName(agency)}.`} />
            <DialogBody className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-2 rounded-[8px] border border-line-strong bg-raised py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-fg">{secret}</span>
                <CopyButton value={secret} label="Copy key" toastText="API key copied" />
              </div>
              <div className="flex gap-2.5 rounded-[8px] bg-warning-soft p-3 text-[13px] leading-relaxed text-warning-fg">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>You won&apos;t see this key again. Send it to the agency through its secure channel and store it in a secrets manager. If it&apos;s lost, revoke it and create a new one.</span>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader title="Create API key" description="Keys belong to one agency and only reach the documents its reviewers can see." />
            <DialogBody className="grid grid-cols-1 gap-4">
              <Field label="Name" htmlFor="key-name" error={touched && errors.name} hint="For example: FHRO continuous monitoring">
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!errors.name} autoComplete="off" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agency">
                  <Select ariaLabel="Agency" value={agency} onValueChange={setAgency} options={AGENCY_OPTIONS} />
                </Field>
                <Field label="Expires after">
                  <Select
                    ariaLabel="Expires after"
                    value={expiry}
                    onValueChange={(v) => setExpiry(v as AccessLength)}
                    options={(Object.keys(LENGTH_LABEL) as AccessLength[]).map((k) => ({ value: k, label: k === "continuing" ? "No expiry" : LENGTH_LABEL[k] }))}
                  />
                </Field>
              </div>
              <fieldset className="grid grid-cols-1 gap-2">
                <legend className="mb-1.5 text-[13px] font-medium text-fg">Scopes</legend>
                {SCOPES.map((s) => {
                  const checked = scopes.includes(s.id);
                  return (
                    <label key={s.id} className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-raised p-3 transition-colors hover:border-line-strong">
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        aria-label={s.label}
                        onCheckedChange={(v) => setScopes((cur) => (v ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-fg">
                          {s.label}
                          <span className="rounded-[4px] bg-subtle px-1.5 font-mono text-[11px] font-normal text-muted">{s.id}</span>
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-muted">{s.body}</span>
                      </span>
                    </label>
                  );
                })}
                {touched && errors.scopes && <p className="text-[12.5px] text-danger-fg">{errors.scopes}</p>}
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({ keyToRevoke, onClose }: { keyToRevoke: ApiKey | null; onClose: () => void }) {
  const revoke = useTrust((s) => s.revokeApiKey);
  const patch = useTrust((s) => s.patch);
  const [shown, setShown] = React.useState<ApiKey | null>(keyToRevoke);
  if (keyToRevoke && keyToRevoke !== shown) setShown(keyToRevoke);
  const k = keyToRevoke ?? shown;

  const confirm = () => {
    if (!k) return;
    const before = useTrust.getState().apiKeys;
    revoke(k.id);
    onClose();
    toast.success("Key revoked", {
      description: `${k.name} stopped working immediately.`,
      action: { label: "Undo", onClick: () => patch({ apiKeys: before }) },
    });
  };

  return (
    <Dialog open={!!keyToRevoke} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader
          title={`Revoke ${k?.name ?? "key"}?`}
          description={`Requests from ${k ? agencyName(k.agencyId) : "the agency"} using this key fail right away. They will need a new key to keep pulling the package.`}
        />
        <DialogBody>
          <div className="rounded-[8px] border border-line bg-raised px-3 py-2 font-mono text-[12.5px] text-muted">
            {k?.prefix}
            {"••••"}
            {k?.last4}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            Revoke key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
