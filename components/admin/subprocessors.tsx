"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, CalendarClock, Ellipsis, Globe2, LayoutGrid, MapPin, Pencil, Plus, RotateCcw, Rows3, ShieldCheck, Trash2 } from "lucide-react";
import { DataTable } from "@/components/kit/data-table";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Card } from "@/components/ui/display";
import { Segmented, Switch } from "@/components/ui/controls";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { Subprocessor } from "@/lib/types";
import { DAY, cn, fmt, nowMs, uid } from "@/lib/utils";
import { PageSkeleton } from "./common";
import { estimateRecipients } from "./updates";

const NOTICE_DAYS = 30;

function StatusBadge({ s }: { s: Subprocessor }) {
  if (s.status === "active")
    return (
      <Badge tone="success" dot>
        Active
      </Badge>
    );
  if (s.status === "planned")
    return (
      <Badge tone="warning" dot>
        Planned
      </Badge>
    );
  return (
    <Badge tone="neutral" dot>
      Removed
    </Badge>
  );
}

function sinceLabel(s: Subprocessor) {
  if (s.status === "planned") return `Starts ${fmt.date(s.since)}`;
  return fmt.date(s.since);
}

type Editing = { mode: "new" } | { mode: "edit"; item: Subprocessor } | null;

export function AdminSubprocessors() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <Body />;
}

function Body() {
  const subprocessors = useTrust((s) => s.subprocessors);
  const subscribers = useTrust((s) => s.subscribers);
  const updates = useTrust((s) => s.updates);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [view, setView] = React.useState<"table" | "cards">("table");
  const [status, setStatus] = React.useState<"current" | "planned" | "removed" | "all">("current");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Editing>(null);

  const active = subprocessors.filter((s) => s.status === "active");
  const planned = subprocessors.filter((s) => s.status === "planned");
  const removed = subprocessors.filter((s) => s.status === "removed");
  const changeSubs = subscribers.filter((s) => s.status === "confirmed" && s.topics.includes("subprocessors")).length;
  const lastNotice = updates.filter((u) => u.kind === "subprocessor" && u.status === "published").sort((a, b) => b.at.localeCompare(a.at))[0];

  const data = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return subprocessors
      .filter((s) => (status === "all" ? true : status === "current" ? s.status !== "removed" : s.status === status))
      .filter((s) => !needle || `${s.name} ${s.purpose} ${s.data} ${s.location}`.toLowerCase().includes(needle));
  }, [subprocessors, status, q]);

  const markRemoved = React.useCallback(
    (s: Subprocessor) => {
      const prev = useTrust.getState().subprocessors;
      upsert("subprocessors", { ...s, status: "removed" });
      addAudit({ action: "Removed subprocessor", target: s.name, category: "settings" });
      toast(`${s.name} marked as removed`, { description: "It moves to the removed list on the trust page.", action: { label: "Undo", onClick: () => patch({ subprocessors: prev }) } });
    },
    [upsert, addAudit, patch],
  );

  const restore = React.useCallback(
    (s: Subprocessor) => {
      upsert("subprocessors", { ...s, status: "active" });
      addAudit({ action: "Restored subprocessor", target: s.name, category: "settings" });
      toast.success(`${s.name} is active again`);
    },
    [upsert, addAudit],
  );

  const columns = React.useMemo<ColumnDef<Subprocessor, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Subprocessor",
        accessorFn: (s) => `${s.name} ${s.purpose}`,
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{row.original.name}</div>
            <div className="truncate text-[12px] text-muted">{row.original.purpose}</div>
          </div>
        ),
        meta: { className: "max-w-[280px]" },
      },
      { id: "data", header: "Data handled", accessorFn: (s) => s.data, cell: ({ getValue }) => <span className="block max-w-[220px] truncate text-muted">{String(getValue())}</span>, meta: { hideBelow: "md" } },
      { id: "location", header: "Location", accessorFn: (s) => s.location, cell: ({ getValue }) => <span className="whitespace-nowrap text-muted">{String(getValue())}</span>, meta: { hideBelow: "lg" } },
      {
        id: "certs",
        header: "Certifications",
        enableSorting: false,
        accessorFn: (s) => s.certifications.join(" "),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.certifications.map((c) => (
              <span key={c} className="whitespace-nowrap rounded-full border border-line-strong px-1.5 py-px text-[11px] text-muted">
                {c}
              </span>
            ))}
          </div>
        ),
        meta: { hideBelow: "lg" },
      },
      { id: "since", header: "Since", accessorFn: (s) => s.since, cell: ({ row }) => <span className="whitespace-nowrap text-[12.5px] text-muted">{sinceLabel(row.original)}</span> },
      { id: "status", header: "Status", accessorFn: (s) => s.status, cell: ({ row }) => <StatusBadge s={row.original} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => <RowMenu s={row.original} onEdit={() => setEditing({ mode: "edit", item: row.original })} onRemove={markRemoved} onRestore={restore} />,
        meta: { className: "w-10 text-right" },
      },
    ],
    [markRemoved, restore],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Engagement"
        title="Subprocessors"
        description="Third parties that process customer data for Northwind Workbench. The trust page shows this same list."
        actions={
          <Button variant="primary" onClick={() => setEditing({ mode: "new" })}>
            <Plus /> Plan a new subprocessor
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="text-[12.5px] font-medium text-muted">Active</div>
          <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">{active.length}</div>
          <div className="mt-2 text-[12px] text-muted">{removed.length} removed, kept for the record</div>
        </div>
        <div className="card p-4">
          <div className="text-[12.5px] font-medium text-muted">Planned</div>
          <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">{planned.length}</div>
          <div className="mt-2 text-[12px] text-muted">{planned[0] ? `${planned[0].name} starts ${fmt.short(planned[0].since)}` : "Nothing in notice period"}</div>
        </div>
        <div className="card p-4">
          <div className="text-[12.5px] font-medium text-muted">Last change notice</div>
          <div className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.015em] text-fg">{lastNotice ? fmt.ago(lastNotice.at) : "None yet"}</div>
          <div className="mt-2 truncate text-[12px] text-muted">{lastNotice ? lastNotice.title : "Notices go out from this page"}</div>
        </div>
        <div className="card p-4">
          <div className="text-[12.5px] font-medium text-muted">Subscribed to changes</div>
          <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg">{changeSubs}</div>
          <div className="mt-2 text-[12px] text-muted">Confirmed subscribers</div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-line bg-raised px-4 py-3 text-[13px] dark:bg-transparent">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted" />
        <p className="text-muted">
          <span className="font-medium text-fg">{NOTICE_DAYS}-day notice.</span> Northwind tells subscribers at least {NOTICE_DAYS} days before a new subprocessor starts handling customer data. Agencies can object during that window by
          replying to the notice. Removals take effect right away.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, purpose or data" aria-label="Search subprocessors" className="h-8 text-[13px] sm:max-w-[260px]" />
        <div className="scroll-thin -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Chip active={status === "current"} onClick={() => setStatus("current")}>
            Current <span className="opacity-60">{active.length + planned.length}</span>
          </Chip>
          <Chip active={status === "planned"} onClick={() => setStatus("planned")}>
            Planned <span className="opacity-60">{planned.length}</span>
          </Chip>
          <Chip active={status === "removed"} onClick={() => setStatus("removed")}>
            Removed <span className="opacity-60">{removed.length}</span>
          </Chip>
          <Chip active={status === "all"} onClick={() => setStatus("all")}>
            All
          </Chip>
        </div>
        <Segmented
          size="sm"
          layoutId="sp-view"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table", icon: <Rows3 /> },
            { value: "cards", label: "Cards", icon: <LayoutGrid /> },
          ]}
        />
      </div>

      <div className="mt-3">
        {view === "table" ? (
          <DataTable
            data={data}
            columns={columns}
            getRowId={(s) => s.id}
            minWidth={620}
            initialSorting={[{ id: "name", desc: false }]}
            rowClassName={(s) => cn(s.status === "removed" && "opacity-60")}
            empty={<EmptyState compact title="No subprocessors match" body="Change the filters or search." />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {data.map((s) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Card className={cn("flex h-full flex-col p-4", s.status === "removed" && "opacity-60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-semibold text-fg">{s.name}</div>
                        <div className="mt-0.5 text-[12.5px] text-muted">{s.purpose}</div>
                      </div>
                      <RowMenu s={s} onEdit={() => setEditing({ mode: "edit", item: s })} onRemove={markRemoved} onRestore={restore} />
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-1.5 text-[12.5px]">
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-faint">Data</dt>
                        <dd className="text-fg">{s.data}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-faint">Location</dt>
                        <dd className="text-fg">{s.location}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-faint">Since</dt>
                        <dd className="text-fg">{sinceLabel(s)}</dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                      <StatusBadge s={s} />
                      {s.certifications.map((c) => (
                        <span key={c} className="rounded-full border border-line-strong px-1.5 py-px text-[11px] text-muted">
                          {c}
                        </span>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            {!data.length && (
              <Card className="md:col-span-2 xl:col-span-3">
                <EmptyState compact title="No subprocessors match" body="Change the filters or search." />
              </Card>
            )}
          </div>
        )}
      </div>

      <EditSheet editing={editing} onClose={() => setEditing(null)} />
    </motion.div>
  );
}

function RowMenu({ s, onEdit, onRemove, onRestore }: { s: Subprocessor; onEdit: () => void; onRemove: (s: Subprocessor) => void; onRestore: (s: Subprocessor) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${s.name}`}>
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-52">
        <MenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </MenuItem>
        {s.status === "removed" ? (
          <MenuItem onSelect={() => onRestore(s)}>
            <RotateCcw /> Restore
          </MenuItem>
        ) : (
          <>
            <MenuSeparator />
            <MenuItem danger onSelect={() => onRemove(s)}>
              <Trash2 /> Mark as removed
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function dateInput(ms: number) {
  return format(new Date(ms), "yyyy-MM-dd");
}

function EditSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  return (
    <Sheet open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={560}>{editing && <EditForm key={editing.mode === "edit" ? editing.item.id : "new"} editing={editing} onClose={onClose} />}</SheetContent>
    </Sheet>
  );
}

function EditForm({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const subscribers = useTrust((s) => s.subscribers);
  const reviewers = useTrust((s) => s.reviewers);
  const estimate = estimateRecipients(subscribers, reviewers, "subprocessor", "public");
  const upsert = useTrust((s) => s.upsert);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const addAudit = useTrust((s) => s.addAudit);
  const item = editing.mode === "edit" ? editing.item : null;
  const [name, setName] = React.useState(item?.name ?? "");
  const [purpose, setPurpose] = React.useState(item?.purpose ?? "");
  const [data, setData] = React.useState(item?.data ?? "");
  const [location, setLocation] = React.useState(item?.location ?? "United States");
  const [certs, setCerts] = React.useState(item?.certifications.join(", ") ?? "SOC 2");
  const [status, setStatus] = React.useState<"active" | "planned">(item ? (item.status === "planned" ? "planned" : "active") : "planned");
  const [since, setSince] = React.useState(() => dateInput(item ? new Date(item.since).getTime() : nowMs() + NOTICE_DAYS * DAY));
  const [notify, setNotify] = React.useState(!item);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const sinceMs = new Date(`${since}T09:00:00`).getTime();
  const shortNotice = status === "planned" && !isNaN(sinceMs) && sinceMs - nowMs() < (NOTICE_DAYS - 1) * DAY;
  const errors = {
    name: name.trim().length < 2 ? "Enter the company name." : "",
    purpose: purpose.trim().length < 4 ? "Say what it does for Workbench." : "",
    data: data.trim().length < 3 ? "Say which data it handles." : "",
    since: isNaN(sinceMs) ? "Pick a date." : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setTimeout(() => {
      const next: Subprocessor = {
        id: item?.id ?? uid("sp"),
        name: name.trim(),
        purpose: purpose.trim(),
        data: data.trim(),
        location: location.trim() || "United States",
        since: new Date(sinceMs).toISOString(),
        status,
        certifications: certs
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      };
      upsert("subprocessors", next);
      addAudit({ action: item ? "Updated subprocessor" : status === "planned" ? "Planned subprocessor" : "Added subprocessor", target: next.name, detail: status === "planned" ? `Starts ${fmt.date(next.since)}` : undefined, category: "settings" });
      let sent = 0;
      if (notify) {
        const res = publishUpdate({
          kind: "subprocessor",
          title: item ? `Subprocessor change: ${next.name}` : status === "planned" ? `Planned subprocessor: ${next.name}` : `New subprocessor: ${next.name}`,
          body:
            status === "planned"
              ? `${next.name} will start on ${fmt.date(next.since)}. Purpose: ${next.purpose}. Data handled: ${next.data}. Location: ${next.location}. Reply to this notice before that date if your agency has concerns.`
              : `${next.name} processes data for Workbench. Purpose: ${next.purpose}. Data handled: ${next.data}. Location: ${next.location}.`,
          audience: "public",
          status: "published",
          at: new Date(nowMs()).toISOString(),
        });
        sent = res.recipients;
      }
      setBusy(false);
      onClose();
      toast.success(item ? `${next.name} updated` : status === "planned" ? `${next.name} planned` : `${next.name} added`, {
        description: notify ? `Notice sent to ${sent} ${sent === 1 ? "subscriber" : "subscribers"} and posted on the trust page.` : "No notice sent.",
      });
    }, 450);
  };

  return (
    <>
      <SheetHeader title={item ? `Edit ${item.name}` : "Plan a new subprocessor"} description="The trust page lists active and planned subprocessors, with the start date for planned ones." />
      <SheetBody className="grid grid-cols-1 content-start gap-4">
        <Field label="Company" htmlFor="sp-name" error={touched && errors.name}>
          <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!errors.name} />
        </Field>
        <Field label="Purpose" htmlFor="sp-purpose" error={touched && errors.purpose} hint="For example: encrypted offsite backups.">
          <Input id="sp-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-invalid={touched && !!errors.purpose} />
        </Field>
        <Field label="Data handled" htmlFor="sp-data" error={touched && errors.data} hint="Be specific: which customer data, and whether it is stored or only passes through.">
          <Textarea id="sp-data" rows={2} value={data} onChange={(e) => setData(e.target.value)} aria-invalid={touched && !!errors.data} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="sp-loc">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input id="sp-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="pl-8" />
            </div>
          </Field>
          <Field label="Certifications" htmlFor="sp-certs" hint="Comma separated.">
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input id="sp-certs" value={certs} onChange={(e) => setCerts(e.target.value)} className="pl-8" />
            </div>
          </Field>
        </div>
        <Field label="Status">
          <Segmented
            fill
            layoutId="sp-status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              if (v === "planned" && !item) setSince(dateInput(nowMs() + NOTICE_DAYS * DAY));
            }}
            options={[
              { value: "planned", label: "Planned", icon: <CalendarClock /> },
              { value: "active", label: "Active", icon: <Globe2 /> },
            ]}
          />
        </Field>
        <Field
          label={status === "planned" ? "Start date" : "In use since"}
          htmlFor="sp-since"
          error={touched && errors.since}
          hint={shortNotice ? <span className="text-warning-fg">Less than {NOTICE_DAYS} days away. Agencies expect at least {NOTICE_DAYS} days&apos; notice.</span> : status === "planned" ? `Defaults to ${NOTICE_DAYS} days from today.` : undefined}
        >
          <Input id="sp-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-invalid={touched && !!errors.since} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-raised p-3">
          <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify subscribers" className="mt-0.5" />
          <span className="text-[13px]">
            <span className="flex items-center gap-1.5 font-medium text-fg">
              <BellRing className="size-3.5 text-muted" /> Notify subscribers
            </span>
            <span className="block text-muted">
              Posts a subprocessor notice on the trust page and emails about {estimate} {estimate === 1 ? "subscriber" : "subscribers"} to subprocessor changes.
            </span>
          </span>
        </label>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} loading={busy}>
          {item ? "Save changes" : status === "planned" ? "Plan subprocessor" : "Add subprocessor"}
        </Button>
      </SheetFooter>
    </>
  );
}
