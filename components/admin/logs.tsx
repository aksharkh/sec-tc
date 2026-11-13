"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, Download } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Meter } from "@/components/kit/charts";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Avatar, Card, CardHeader, ProgressBar } from "@/components/ui/display";
import { Segmented, Select } from "@/components/ui/controls";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { LogEvent } from "@/lib/types";
import { DAY, downloadText, fmt } from "@/lib/utils";
import { ACTION_LABEL, ACTION_TONE, ChannelBadge, PageSkeleton, agencyName, agencyShort } from "./common";

type Range = "7d" | "30d" | "90d" | "6m";
type ActionFilter = "all" | "view" | "download" | "api_fetch" | "sign_in";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 183 };
const RANGE_LABEL: Record<Range, string> = { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", "6m": "last 6 months" };
const RETENTION_DAYS = 183;

const ACTION_CHIPS: { value: ActionFilter; label: string }[] = [
  { value: "all", label: "All actions" },
  { value: "view", label: "Views" },
  { value: "download", label: "Downloads" },
  { value: "api_fetch", label: "API fetches" },
  { value: "sign_in", label: "Sign-ins" },
];

const isPublic = (e: LogEvent) => e.handle === "anonymous";
const orgLabel = (e: LogEvent) => (isPublic(e) ? "Public visitor" : agencyName(e.agencyId));
const matchesAction = (e: LogEvent, a: ActionFilter) =>
  a === "all" || (a === "download" ? e.action === "download" || e.action === "download_all" : e.action === a);

function logsInRange(logs: LogEvent[], range: Range) {
  const from = Date.now() - RANGE_DAYS[range] * DAY;
  return logs.filter((e) => new Date(e.at).getTime() >= from);
}

function retentionStats(logs: LogEvent[]) {
  const first = logs.reduce<string | null>((min, e) => (!min || e.at < min ? e.at : min), null);
  const days = first ? Math.min(RETENTION_DAYS, Math.ceil((Date.now() - new Date(first).getTime()) / DAY)) : 0;
  return { oldest: first, days, total: logs.length };
}

/** The values each searchable column exposes, so the CSV matches what the table shows. */
const searchFields = (e: LogEvent) => [e.at, e.actor, orgLabel(e), e.target, ACTION_LABEL[e.action], e.channel];

export function AdminLogs() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={0} />;
  return <LogsBody />;
}

function LogsBody() {
  const logs = useTrust((s) => s.logs);
  const [range, setRange] = React.useState<Range>("30d");
  const [action, setAction] = React.useState<ActionFilter>("all");
  const [channel, setChannel] = React.useState<"all" | "web" | "api">("all");
  const [agency, setAgency] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const inRange = React.useMemo(() => logsInRange(logs, range), [logs, range]);

  const filtered = React.useMemo(
    () =>
      inRange.filter(
        (e) =>
          matchesAction(e, action) &&
          (channel === "all" || e.channel === channel) &&
          (agency === "all" || (agency === "public" ? isPublic(e) : !isPublic(e) && e.agencyId === agency)),
      ),
    [inRange, action, channel, agency],
  );

  const searched = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((e) => searchFields(e).some((v) => v.toLowerCase().includes(q)));
  }, [filtered, search]);

  const agencyOptions = React.useMemo(() => {
    const ids = new Set<string>();
    let pub = false;
    for (const e of logs) {
      if (isPublic(e)) pub = true;
      else ids.add(e.agencyId);
    }
    return [
      { value: "all", label: "All organizations" },
      ...[...ids].map((id) => ({ value: id, label: agencyName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
      ...(pub ? [{ value: "public", label: "Public visitors" }] : []),
    ];
  }, [logs]);

  const filtersActive = action !== "all" || channel !== "all" || agency !== "all" || !!search;
  const clearFilters = () => {
    setAction("all");
    setChannel("all");
    setAgency("all");
    setSearch("");
  };

  const exportCsv = () => {
    const header = ["time_utc", "actor", "handle", "actor_type", "organization", "target", "action", "channel", "ip"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = searched.map((e) =>
      [e.at, e.actor, e.handle, e.actorKind, orgLabel(e), e.target, ACTION_LABEL[e.action], e.channel, e.ip].map(esc).join(","),
    );
    downloadText(`northwind-access-log-${fmt.iso(new Date().toISOString())}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
    toast.success(`Exported ${fmt.num(searched.length)} records`, { description: `CSV of the filtered log, ${RANGE_LABEL[range]}.` });
  };

  const columns = React.useMemo<ColumnDef<LogEvent, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: "Time",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="text-[13px] text-fg">{fmt.day(row.original.at)}</div>
            <div className="text-[11.5px] text-faint">{fmt.ago(row.original.at)}</div>
          </div>
        ),
        meta: { className: "w-[150px]" },
      },
      {
        accessorKey: "actor",
        header: "Person or system",
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={e.actor} size={26} square={e.actorKind === "system"} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-fg">{e.actor}</div>
                <div className="truncate text-[11.5px] text-faint">{isPublic(e) ? "Not signed in" : e.handle}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "agency",
        accessorFn: (e) => orgLabel(e),
        header: "Organization",
        cell: ({ row }) => {
          const e = row.original;
          return isPublic(e) ? (
            <span className="text-muted">Public</span>
          ) : (
            <span className="whitespace-nowrap text-fg" title={agencyName(e.agencyId)}>
              {agencyShort(e.agencyId)}
            </span>
          );
        },
        meta: { hideBelow: "md" },
      },
      {
        accessorKey: "target",
        header: "Document",
        cell: ({ row }) => <span className="line-clamp-1 max-w-[280px] text-[13px] text-fg">{row.original.target}</span>,
      },
      {
        id: "action",
        accessorFn: (e) => ACTION_LABEL[e.action],
        header: "Action",
        cell: ({ row }) => <Badge tone={ACTION_TONE[row.original.action]}>{ACTION_LABEL[row.original.action]}</Badge>,
      },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ row }) => <ChannelBadge channel={row.original.channel} />,
        meta: { hideBelow: "sm" },
      },
      {
        accessorKey: "ip",
        header: "IP address",
        enableGlobalFilter: false,
        cell: ({ row }) => <span className="font-mono text-[12px] text-muted">{row.original.ip}</span>,
        meta: { hideBelow: "lg" },
      },
    ],
    [],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Trust center"
        title="Access logs"
        description="Every sign-in, view, download and API call on Northwind's trust center. Each agency sees its own records in the reviewer portal and over the API."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!searched.length}>
            <Download />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <RetentionCard />
        <AgencySummary logs={inRange} range={range} />
      </div>

      <div className="mt-4">
        <DataTable
          data={searched}
          columns={columns}
          getRowId={(e) => e.id}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search people, documents, agencies"
          pageSize={25}
          minWidth={720}
          initialSorting={[{ id: "at", desc: true }]}
          filters={
            <>
              <Segmented
                size="sm"
                layoutId="logs-range"
                value={range}
                onChange={setRange}
                options={[
                  { value: "7d", label: "7d" },
                  { value: "30d", label: "30d" },
                  { value: "90d", label: "90d" },
                  { value: "6m", label: "6 months" },
                ]}
              />
              <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
              {ACTION_CHIPS.map((c) => (
                <Chip key={c.value} active={action === c.value} onClick={() => setAction(c.value)}>
                  {c.label}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
              <Select
                size="sm"
                ariaLabel="Channel"
                className="w-[136px] shrink-0"
                value={channel}
                onValueChange={(v) => setChannel(v as "all" | "web" | "api")}
                options={[
                  { value: "all", label: "Web and API" },
                  { value: "web", label: "Web only" },
                  { value: "api", label: "API only" },
                ]}
              />
              <Select size="sm" ariaLabel="Organization" className="w-[190px] shrink-0" value={agency} onValueChange={setAgency} options={agencyOptions} />
            </>
          }
          toolbarRight={<span className="hidden whitespace-nowrap text-[12px] text-muted xl:inline">{fmt.num(searched.length)} records</span>}
          empty={
            <EmptyState
              compact
              title="No records match"
              body={`Nothing in the ${RANGE_LABEL[range]} matches these filters. Widen the date range or clear the filters.`}
              action={
                <>
                  {filtersActive && (
                    <Button size="sm" variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                  {range !== "6m" && (
                    <Button size="sm" variant="ghost" onClick={() => setRange("6m")}>
                      Show 6 months
                    </Button>
                  )}
                </>
              }
            />
          }
        />
      </div>
    </motion.div>
  );
}

function RetentionCard() {
  const logs = useTrust((s) => s.logs);
  const { oldest, days, total } = React.useMemo(() => retentionStats(logs), [logs]);
  return (
    <Card className="flex flex-col self-start p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <Archive className="size-4 text-muted" />
          6-month retention
        </div>
        <Badge tone="success" dot>
          On schedule
        </Badge>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">{days}</span>
        <span className="text-[13px] text-muted">of {RETENTION_DAYS} days retained</span>
      </div>
      <ProgressBar value={(days / RETENTION_DAYS) * 100} className="mt-3" label="Days of access records retained" />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
        <div>
          <dt className="text-muted">Oldest record</dt>
          <dd className="mt-0.5 font-medium text-fg">{oldest ? fmt.date(oldest) : "None"}</dd>
        </div>
        <div>
          <dt className="text-muted">Records kept</dt>
          <dd className="mt-0.5 font-medium text-fg">{fmt.num(total)}</dd>
        </div>
      </dl>
      <p className="mt-auto pt-4 text-[12px] leading-relaxed text-muted">
        Records older than {RETENTION_DAYS} days are deleted each night. Export a CSV first if you need them longer.
      </p>
    </Card>
  );
}

type AgencyRow = { id: string; name: string; short: string; events: number; downloads: number; people: number; systems: number; last: string };

function AgencySummary({ logs, range }: { logs: LogEvent[]; range: Range }) {
  const rows = React.useMemo(() => {
    const m = new Map<string, AgencyRow & { handles: Map<string, LogEvent["actorKind"]> }>();
    for (const e of logs) {
      const id = isPublic(e) ? "public" : e.agencyId;
      let r = m.get(id);
      if (!r) {
        r = {
          id,
          name: id === "public" ? "Public visitors" : agencyName(id),
          short: id === "public" ? "Public" : agencyShort(id),
          events: 0,
          downloads: 0,
          people: 0,
          systems: 0,
          last: e.at,
          handles: new Map(),
        };
        m.set(id, r);
      }
      r.events++;
      if (e.action === "download" || e.action === "download_all") r.downloads++;
      if (e.at > r.last) r.last = e.at;
      if (!isPublic(e)) r.handles.set(e.handle, e.actorKind);
    }
    return [...m.values()]
      .map(({ handles, ...r }) => ({
        ...r,
        people: [...handles.values()].filter((k) => k === "person").length,
        systems: [...handles.values()].filter((k) => k === "system").length,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 6);
  }, [logs]);
  const max = rows[0]?.events ?? 0;

  return (
    <Card className="min-w-0">
      <CardHeader title="By organization" description={`Activity per agency, ${RANGE_LABEL[range]}`} />
      {rows.length ? (
        <div className="mt-4 grid gap-px overflow-hidden rounded-b-[10px] border-t border-line bg-line sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="min-w-0 bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-fg" title={r.name}>
                    {r.name}
                  </div>
                  <div className="text-[11.5px] text-faint">
                    {r.id === "public" ? "Not signed in" : `${r.people} ${r.people === 1 ? "person" : "people"}${r.systems ? ` · ${r.systems} ${r.systems === 1 ? "system" : "systems"}` : ""}`}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">{r.short}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-4">
                <div>
                  <span className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-fg">{fmt.num(r.events)}</span>
                  <span className="ml-1 text-[12px] text-muted">events</span>
                </div>
                <div>
                  <span className="text-[14px] font-medium text-fg">{fmt.num(r.downloads)}</span>
                  <span className="ml-1 text-[12px] text-muted">downloads</span>
                </div>
              </div>
              <Meter value={r.events} max={max} className="mt-2.5" />
              <div className="mt-2 text-[11.5px] text-faint">Last activity {fmt.ago(r.last)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState compact title="No activity" body="No organization accessed the trust center in this period." />
      )}
    </Card>
  );
}
