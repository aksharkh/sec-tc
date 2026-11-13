"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { format, formatDistanceStrict } from "date-fns";
import { Activity, BellRing, CalendarClock, Check, CircleAlert, MessageSquarePlus, Siren, Trash2, Wrench } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Timeline } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/display";
import { Checkbox, Segmented, Select, Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { ComponentStatus, Incident, StatusComponent } from "@/lib/types";
import { DAY, HOUR, cn, fmt, nowMs, uid } from "@/lib/utils";
import { PageSkeleton } from "./common";

type UpdateStatus = Incident["updates"][number]["status"];

const COMPONENT_STATUS: Record<ComponentStatus, { label: string; tone: Tone }> = {
  operational: { label: "Operational", tone: "success" },
  degraded: { label: "Degraded", tone: "warning" },
  outage: { label: "Outage", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "review" },
};

const UPDATE_LABEL: Record<UpdateStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  completed: "Completed",
};

const IMPACT: Record<Incident["impact"], { label: string; tone: Tone }> = {
  minor: { label: "Minor", tone: "warning" },
  major: { label: "Major", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "review" },
};

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 100;
}

function pct(v: number) {
  return `${v >= 99.995 ? "100" : v.toFixed(v >= 99.9 ? 3 : 2)}%`;
}

function barColor(v: number) {
  if (v >= 99.995) return "bg-success";
  if (v >= 99.9) return "bg-success/55";
  if (v >= 99) return "bg-warning";
  return "bg-danger";
}

function toLocalInput(ms: number) {
  return format(new Date(ms), "yyyy-MM-dd'T'HH:mm");
}

function tomorrowAt(h: number) {
  const d = new Date(nowMs() + DAY);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
}

function phase(i: Incident, now: number): "open" | "scheduled" | "in_progress" | "closed" {
  if (i.resolvedAt) return "closed";
  if (i.impact === "maintenance") return new Date(i.startedAt).getTime() > now ? "scheduled" : "in_progress";
  return "open";
}

/* ───────── Page ───────── */

export function AdminStatus() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={0} />;
  return <StatusBody />;
}

type DialogState = { kind: "report"; preset?: string } | { kind: "maintenance" } | { kind: "update"; incident: Incident } | null;

function StatusBody() {
  const components = useTrust((s) => s.components);
  const incidents = useTrust((s) => s.incidents);
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const remove = useTrust((s) => s.remove);
  const patch = useTrust((s) => s.patch);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [historyLimit, setHistoryLimit] = React.useState(5);

  const now = nowMs();
  const worst: ComponentStatus = components.some((c) => c.status === "outage")
    ? "outage"
    : components.some((c) => c.status === "degraded")
      ? "degraded"
      : components.some((c) => c.status === "maintenance")
        ? "maintenance"
        : "operational";
  const overall = avg(components.map((c) => avg(c.uptime)));
  const open = incidents.filter((i) => phase(i, now) === "open" || phase(i, now) === "in_progress");
  const scheduled = incidents.filter((i) => phase(i, now) === "scheduled").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const history = incidents.filter((i) => phase(i, now) === "closed").sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const setComponentStatus = (c: StatusComponent, status: ComponentStatus) => {
    if (c.status === status) return;
    upsert("components", { ...c, status }, { append: true });
    addAudit({ action: "Changed component status", target: c.name, detail: COMPONENT_STATUS[status].label, category: "updates" });
    const hasOpen = useTrust.getState().incidents.some((i) => !i.resolvedAt && i.components.includes(c.id) && new Date(i.startedAt).getTime() <= nowMs());
    if (status !== "operational" && status !== "maintenance" && !hasOpen) {
      toast(`${c.name} set to ${COMPONENT_STATUS[status].label.toLowerCase()}`, {
        description: "The trust page shows this now. Report an incident so subscribers know what is happening.",
        action: { label: "Report incident", onClick: () => setDialog({ kind: "report", preset: c.id }) },
      });
    } else toast.success(`${c.name}: ${COMPONENT_STATUS[status].label.toLowerCase()}`);
  };

  const cancelMaintenance = (i: Incident) => {
    const prev = useTrust.getState().incidents;
    remove("incidents", i.id);
    addAudit({ action: "Canceled maintenance", target: i.title, category: "updates" });
    toast("Maintenance canceled", { action: { label: "Undo", onClick: () => patch({ incidents: prev }) } });
  };

  const banner = {
    operational: { text: "All systems operational", cls: "border-success/30 bg-success-soft text-success-fg", Icon: Check },
    degraded: { text: "Some systems are degraded", cls: "border-warning/30 bg-warning-soft text-warning-fg", Icon: CircleAlert },
    outage: { text: "Service outage", cls: "border-danger/30 bg-danger-soft text-danger-fg", Icon: Siren },
    maintenance: { text: "Maintenance in progress", cls: "border-review/30 bg-review-soft text-review-fg", Icon: Wrench },
  }[worst];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Engagement"
        title="Service status"
        description="Component status, incidents and maintenance for Northwind Workbench. The trust page shows the same status and history."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog({ kind: "maintenance" })}>
              <CalendarClock /> Schedule maintenance
            </Button>
            <Button variant="primary" onClick={() => setDialog({ kind: "report" })}>
              <Siren /> Report incident
            </Button>
          </>
        }
      />

      <div className={cn("flex flex-col gap-2 rounded-[10px] border px-4 py-3 sm:flex-row sm:items-center", banner.cls)}>
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <banner.Icon className="size-4" /> {banner.text}
        </span>
        <span className="text-[12.5px] opacity-80 sm:ml-auto">
          {pct(overall)} uptime across all components, last 90 days · {open.length} open {open.length === 1 ? "incident" : "incidents"}
        </span>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Components" description="Daily uptime for the last 90 days. Hover a bar for the day." action={<Activity className="size-4 text-faint" />} />
        <ul className="mt-3">
          {components.map((c) => (
            <li key={c.id} className="border-t border-line px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-fg">{c.name}</span>
                    <Badge tone={COMPONENT_STATUS[c.status].tone} dot>
                      {COMPONENT_STATUS[c.status].label}
                    </Badge>
                  </div>
                  <div className="text-[12.5px] text-muted">{c.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-muted">
                    <span className="font-medium text-fg">{pct(avg(c.uptime))}</span> uptime
                  </span>
                  <Select
                    size="sm"
                    ariaLabel={`Status of ${c.name}`}
                    className="w-[150px]"
                    value={c.status}
                    onValueChange={(v) => setComponentStatus(c, v as ComponentStatus)}
                    options={(Object.keys(COMPONENT_STATUS) as ComponentStatus[]).map((k) => ({ value: k, label: COMPONENT_STATUS[k].label }))}
                  />
                </div>
              </div>
              <UptimeBars values={c.uptime} name={c.name} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-fg">Open incidents</h2>
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false} mode="popLayout">
              {open.map((i) => (
                <motion.div key={i.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <IncidentCard incident={i} components={components} onUpdate={() => setDialog({ kind: "update", incident: i })} />
                </motion.div>
              ))}
            </AnimatePresence>
            {!open.length && (
              <Card>
                <EmptyState compact title="No open incidents" body="When something goes wrong, report it here. Subscribers to incidents get each update by email." />
              </Card>
            )}
          </div>

          <h2 className="mb-3 mt-6 text-[14px] font-semibold text-fg">Scheduled maintenance</h2>
          <div className="grid grid-cols-1 gap-3">
            {scheduled.map((i) => (
              <IncidentCard
                key={i.id}
                incident={i}
                components={components}
                onUpdate={() => setDialog({ kind: "update", incident: i })}
                extra={
                  <Button size="xs" variant="danger-ghost" onClick={() => cancelMaintenance(i)}>
                    <Trash2 /> Cancel
                  </Button>
                }
              />
            ))}
            {!scheduled.length && (
              <Card className="px-4 py-5 text-[13px] text-muted sm:px-5">Nothing scheduled. Planned work goes out to subscribers as a maintenance notice.</Card>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-fg">History</h2>
          <div className="grid grid-cols-1 gap-3">
            {history.slice(0, historyLimit).map((i) => (
              <IncidentCard key={i.id} incident={i} components={components} />
            ))}
            {!history.length && <Card className="px-4 py-5 text-[13px] text-muted sm:px-5">No past incidents.</Card>}
            {history.length > historyLimit && (
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setHistoryLimit((n) => n + 5)}>
                Show older
              </Button>
            )}
          </div>
        </section>
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent size="md">
          {dialog?.kind === "report" && <ReportForm key="report" preset={dialog.preset} onDone={() => setDialog(null)} />}
          {dialog?.kind === "maintenance" && <MaintenanceForm key="maint" onDone={() => setDialog(null)} />}
          {dialog?.kind === "update" && <PostUpdateForm key={dialog.incident.id} incident={dialog.incident} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ───────── Uptime bars ───────── */

function UptimeBars({ values, name }: { values: number[]; name: string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const now = nowMs();
  const n = values.length;
  const label = (i: number) => {
    const d = new Date(now - (n - 1 - i) * DAY);
    return `${format(d, "MMM d")} · ${pct(values[i]!)}`;
  };
  return (
    <div className="mt-3">
      <div className="relative">
        <div className="flex h-8 items-stretch gap-px sm:gap-[2px]" onMouseLeave={() => setHover(null)} role="img" aria-label={`${name}: daily uptime for the last ${n} days`}>
          {values.map((v, i) => (
            <span
              key={i}
              title={label(i)}
              onMouseEnter={() => setHover(i)}
              className={cn("min-w-0 flex-1 rounded-[2px] transition-opacity", barColor(v), i < n - 30 && "hidden md:block", hover !== null && hover !== i && "opacity-60")}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
        <span className="md:hidden">30 days ago</span>
        <span className="hidden md:inline">{n} days ago</span>
        <span className="font-medium text-muted">{hover !== null ? label(hover) : ""}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/* ───────── Incident card ───────── */

function IncidentCard({ incident: i, components, onUpdate, extra }: { incident: Incident; components: StatusComponent[]; onUpdate?: () => void; extra?: React.ReactNode }) {
  const now = nowMs();
  const ph = phase(i, now);
  const names = i.components.map((id) => components.find((c) => c.id === id)?.name ?? id);
  const duration = i.resolvedAt ? formatDistanceStrict(new Date(i.startedAt), new Date(i.resolvedAt)) : null;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={IMPACT[i.impact].tone}>{IMPACT[i.impact].label}</Badge>
            {ph === "open" && (
              <Badge tone="danger" dot pulse>
                Open
              </Badge>
            )}
            {ph === "in_progress" && (
              <Badge tone="review" dot pulse>
                In progress
              </Badge>
            )}
            {ph === "scheduled" && (
              <Badge tone="neutral" dot>
                Scheduled
              </Badge>
            )}
            {ph === "closed" && (
              <Badge tone="success" dot>
                {i.impact === "maintenance" ? "Completed" : "Resolved"}
              </Badge>
            )}
          </div>
          <div className="mt-2 text-[14.5px] font-semibold text-fg">{i.title}</div>
          <div className="mt-1 text-[12.5px] text-muted">
            {ph === "scheduled" ? `Starts ${fmt.dateTime(i.startedAt)}` : `Started ${fmt.dateTime(i.startedAt)}`}
            {duration && ` · lasted ${duration}`}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {names.map((n) => (
              <span key={n} className="rounded-full border border-line-strong px-1.5 py-px text-[11px] text-muted">
                {n}
              </span>
            ))}
          </div>
        </div>
        {(onUpdate || extra) && ph !== "closed" && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {extra}
            {onUpdate && (
              <Button size="xs" variant="secondary" onClick={onUpdate}>
                <MessageSquarePlus /> Post update
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <Timeline
          items={i.updates.map((u, idx) => ({
            id: `${u.at}-${idx}`,
            tone: u.status === "resolved" || u.status === "completed" ? "success" : u.status === "scheduled" ? "neutral" : "warning",
            title: UPDATE_LABEL[u.status],
            meta: fmt.day(u.at),
            body: u.text,
          }))}
        />
      </div>
    </Card>
  );
}

/* ───────── Forms ───────── */

function ComponentPicker({ value, onChange, components }: { value: string[]; onChange: (v: string[]) => void; components: StatusComponent[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {components.map((c) => {
        const on = value.includes(c.id);
        return (
          <Chip key={c.id} active={on} onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}>
            {on && <Check />}
            {c.name}
          </Chip>
        );
      })}
    </div>
  );
}

function NotifyToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-raised p-3">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
      <span className="text-[13px]">
        <span className="flex items-center gap-1.5 font-medium text-fg">
          <BellRing className="size-3.5 text-muted" /> {label}
        </span>
        <span className="block text-muted">Posts a notice on the trust page and emails subscribers to incidents and maintenance.</span>
      </span>
    </label>
  );
}

function ReportForm({ preset, onDone }: { preset?: string; onDone: () => void }) {
  const components = useTrust((s) => s.components);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const [title, setTitle] = React.useState("");
  const [impact, setImpact] = React.useState<"minor" | "major">("minor");
  const [picked, setPicked] = React.useState<string[]>(preset ? [preset] : []);
  const [text, setText] = React.useState("");
  const [setStatus, setSetStatus] = React.useState(true);
  const [notify, setNotify] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const errors = {
    title: title.trim().length < 6 ? "Describe what users see, for example: Slow document downloads." : "",
    components: !picked.length ? "Pick at least one component." : "",
    text: text.trim().length < 15 ? "Write the first update agencies will read." : "",
  };
  const valid = !errors.title && !errors.components && !errors.text;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const at = new Date(nowMs()).toISOString();
    const inc: Incident = { id: uid("inc"), title: title.trim(), impact, startedAt: at, components: picked, updates: [{ at, status: "investigating", text: text.trim() }] };
    upsert("incidents", inc);
    if (setStatus) {
      const status: ComponentStatus = impact === "major" ? "outage" : "degraded";
      patch({ components: useTrust.getState().components.map((c) => (picked.includes(c.id) ? { ...c, status } : c)) });
    }
    addAudit({ action: "Reported incident", target: inc.title, detail: `${IMPACT[impact].label} impact`, category: "updates" });
    let sent = 0;
    if (notify) sent = publishUpdate({ kind: "incident", title: inc.title, body: text.trim(), audience: "public", status: "published", at }).recipients;
    onDone();
    toast.success("Incident reported", { description: notify ? `Shown on the trust page and sent to ${sent} ${sent === 1 ? "subscriber" : "subscribers"}.` : "Shown on the trust page. No email sent." });
  };

  return (
    <>
      <DialogHeader title="Report an incident" description="Say what is affected and what you know so far. You can post more updates as you learn more." icon={<span className="grid size-9 place-items-center rounded-full bg-danger-soft text-danger-fg"><Siren className="size-4" /></span>} />
      <DialogBody className="grid grid-cols-1 gap-4">
        <Field label="Title" htmlFor="ri-title" error={touched && errors.title}>
          <Input id="ri-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={touched && !!errors.title} />
        </Field>
        <Field label="Impact" hint={impact === "minor" ? "Slow, or part of the service is unavailable." : "The component is unavailable for most users."}>
          <Segmented
            fill
            layoutId="ri-impact"
            value={impact}
            onChange={setImpact}
            options={[
              { value: "minor", label: "Minor" },
              { value: "major", label: "Major" },
            ]}
          />
        </Field>
        <Field label="Affected components" error={touched && errors.components}>
          <ComponentPicker value={picked} onChange={setPicked} components={components} />
        </Field>
        <Field label="First update" htmlFor="ri-text" error={touched && errors.text}>
          <Textarea id="ri-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Some API requests are failing. The web application is not affected. We are investigating." aria-invalid={touched && !!errors.text} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-fg">
          <Checkbox checked={setStatus} onCheckedChange={(v) => setSetStatus(!!v)} aria-label="Update component status" />
          Mark the affected components as {impact === "major" ? "outage" : "degraded"}
        </label>
        <NotifyToggle checked={notify} onChange={setNotify} label="Notify subscribers" />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit}>
          Report incident
        </Button>
      </DialogFooter>
    </>
  );
}

function MaintenanceForm({ onDone }: { onDone: () => void }) {
  const components = useTrust((s) => s.components);
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const [title, setTitle] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [start, setStart] = React.useState(() => toLocalInput(tomorrowAt(2)));
  const [hours, setHours] = React.useState("2");
  const [text, setText] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const startMs = new Date(start).getTime();
  const errors = {
    title: title.trim().length < 6 ? "Name the work, for example: Database maintenance." : "",
    components: !picked.length ? "Pick at least one component." : "",
    start: isNaN(startMs) || startMs < nowMs() ? "Pick a time in the future." : "",
    text: text.trim().length < 15 ? "Say what will be unavailable and for how long." : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const at = new Date(nowMs()).toISOString();
    const startIso = new Date(startMs).toISOString();
    const end = new Date(startMs + Number(hours) * HOUR);
    const windowText = `${fmt.dateTime(startIso)} to ${format(end, "h:mm a")}`;
    const inc: Incident = { id: uid("inc"), title: title.trim(), impact: "maintenance", startedAt: startIso, components: picked, updates: [{ at, status: "scheduled", text: `${text.trim()} Window: ${windowText}.` }] };
    upsert("incidents", inc);
    addAudit({ action: "Scheduled maintenance", target: inc.title, detail: windowText, category: "updates" });
    let sent = 0;
    if (notify) sent = publishUpdate({ kind: "maintenance", title: `Scheduled maintenance: ${inc.title}`, body: `${text.trim()} Window: ${windowText}.`, audience: "public", status: "published", at }).recipients;
    onDone();
    toast.success("Maintenance scheduled", { description: notify ? `Notice sent to ${sent} ${sent === 1 ? "subscriber" : "subscribers"}.` : "Shown on the trust page." });
  };

  return (
    <>
      <DialogHeader title="Schedule maintenance" description="Planned work shows on the trust page ahead of time, with the window and what is affected." icon={<span className="grid size-9 place-items-center rounded-full bg-review-soft text-review-fg"><Wrench className="size-4" /></span>} />
      <DialogBody className="grid grid-cols-1 gap-4">
        <Field label="Title" htmlFor="mt-title" error={touched && errors.title}>
          <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={touched && !!errors.title} />
        </Field>
        <Field label="Affected components" error={touched && errors.components}>
          <ComponentPicker value={picked} onChange={setPicked} components={components} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Starts" htmlFor="mt-start" error={touched && errors.start} hint="Your local time.">
            <Input id="mt-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={touched && !!errors.start} />
          </Field>
          <Field label="Duration">
            <Select
              ariaLabel="Duration"
              value={hours}
              onValueChange={setHours}
              options={[
                { value: "1", label: "1 hour" },
                { value: "2", label: "2 hours" },
                { value: "4", label: "4 hours" },
                { value: "8", label: "8 hours" },
              ]}
            />
          </Field>
        </div>
        <Field label="What to expect" htmlFor="mt-text" error={touched && errors.text}>
          <Textarea id="mt-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Document downloads may pause for up to 10 minutes. Sign-in and the API stay available." aria-invalid={touched && !!errors.text} />
        </Field>
        <NotifyToggle checked={notify} onChange={setNotify} label="Notify subscribers now" />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit}>
          Schedule
        </Button>
      </DialogFooter>
    </>
  );
}

function PostUpdateForm({ incident, onDone }: { incident: Incident; onDone: () => void }) {
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const publishUpdate = useTrust((s) => s.publishUpdate);
  const maintenance = incident.impact === "maintenance";
  const options: UpdateStatus[] = maintenance ? ["monitoring", "completed"] : ["investigating", "identified", "monitoring", "resolved"];
  const last = incident.updates[0]?.status;
  const [status, setStatus] = React.useState<UpdateStatus>(maintenance ? "monitoring" : last === "investigating" ? "identified" : last === "identified" ? "monitoring" : "resolved");
  const [text, setText] = React.useState("");
  const closing = status === "resolved" || status === "completed";
  const [notify, setNotify] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const ok = text.trim().length >= 10;
  const label = (s: UpdateStatus) => (maintenance && s === "monitoring" ? "In progress" : UPDATE_LABEL[s]);

  const submit = () => {
    setTouched(true);
    if (!ok) return;
    const at = new Date(nowMs()).toISOString();
    const next: Incident = {
      ...incident,
      // Starting maintenance early moves its start to now.
      startedAt: maintenance && new Date(incident.startedAt).getTime() > nowMs() ? at : incident.startedAt,
      resolvedAt: closing ? at : undefined,
      updates: [{ at, status, text: text.trim() }, ...incident.updates],
    };
    upsert("incidents", next);
    const state = useTrust.getState();
    if (closing) {
      const minutes = Math.min(1440, (nowMs() - new Date(next.startedAt).getTime()) / 60000);
      const factor = incident.impact === "major" ? 1 : incident.impact === "minor" ? 0.5 : 0;
      patch({
        components: state.components.map((c) => {
          if (!incident.components.includes(c.id)) return c;
          const uptime = [...c.uptime];
          const lastIdx = uptime.length - 1;
          uptime[lastIdx] = Math.max(0, Math.min(uptime[lastIdx]!, Math.round((100 - (minutes / 1440) * 100 * factor) * 100) / 100));
          return { ...c, status: "operational" as const, uptime };
        }),
      });
    } else if (maintenance && status === "monitoring") {
      patch({ components: state.components.map((c) => (incident.components.includes(c.id) ? { ...c, status: "maintenance" as const } : c)) });
    }
    addAudit({ action: closing ? (maintenance ? "Completed maintenance" : "Resolved incident") : "Posted incident update", target: incident.title, detail: label(status), category: "updates" });
    let sent = 0;
    if (notify)
      sent = publishUpdate({
        kind: maintenance ? "maintenance" : "incident",
        title: `${closing ? (maintenance ? "Completed" : "Resolved") : label(status)}: ${incident.title}`,
        body: text.trim(),
        audience: "public",
        status: "published",
        at,
      }).recipients;
    onDone();
    toast.success(closing ? (maintenance ? "Maintenance marked complete" : "Incident resolved") : "Update posted", {
      description: closing ? "Affected components are back to operational." : notify ? `Sent to ${sent} ${sent === 1 ? "subscriber" : "subscribers"}.` : undefined,
    });
  };

  return (
    <>
      <DialogHeader title="Post an update" description={incident.title} />
      <DialogBody className="grid grid-cols-1 gap-4">
        <Field label="Status">
          <Select ariaLabel="Status" value={status} onValueChange={(v) => setStatus(v as UpdateStatus)} options={options.map((o) => ({ value: o, label: label(o) }))} />
        </Field>
        <Field label="Update" htmlFor="pu-text" error={touched && !ok ? "Write what changed since the last update." : undefined}>
          <Textarea
            id="pu-text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={closing ? "Service is back to normal. Cause and the fix in one or two sentences. No data was lost or exposed." : "What you found and what happens next."}
          />
        </Field>
        {closing && <p className="text-[12.5px] text-muted">Resolving sets the affected components back to operational and records the downtime in today&apos;s uptime.</p>}
        <NotifyToggle checked={notify} onChange={setNotify} label="Notify subscribers" />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit}>
          {closing ? (maintenance ? "Mark complete" : "Resolve incident") : "Post update"}
        </Button>
      </DialogFooter>
    </>
  );
}
