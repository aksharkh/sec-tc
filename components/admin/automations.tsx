"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Clock3, Filter, Play, Plus, Sparkles, Zap } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { StatCard } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/display";
import { Checkbox, Select, Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useReady } from "@/lib/hooks";
import { ADMIN_NAME, useTrust } from "@/lib/store";
import type { Automation, AutomationCategory } from "@/lib/types";
import { cn, fmt, nowMs, sleep, uid } from "@/lib/utils";
import { PageSkeleton } from "./common";

const CAT_LABEL: Record<AutomationCategory, string> = {
  access: "Access",
  documents: "Documents",
  monitoring: "Monitoring",
  questionnaires: "Questionnaires",
  reporting: "Reporting",
};

const TRIGGERS = [
  "Access request received",
  "Reviewer access ends in 14 days",
  "Document approved in SecureKnots Workspace",
  "A KSI check fails in the daily run",
  "Package JSON validation fails",
  "Policy version is 11 months old",
  "Agency questionnaire uploaded",
  "Question asked on the trust page",
  "API key unused for 90 days",
  "New reviewer signs in for the first time",
  "1st of every month, 2:00 AM",
];
const CONDITIONS = ["None", "Email matches an enabled allowlist rule", "Reviewer was active in the last 30 days", "Document is restricted", "Client is on the Trust plan", "A library answer matches strongly"];
const ACTIONS = [
  "Approve for the rule's access length",
  "Email a sign-in link",
  "Post to #trust-center-alerts",
  "Notify Northwind admins",
  "Publish to the trust center as restricted",
  "Regenerate and validate the package JSON",
  "Notify subscribers to document updates",
  "Draft a status notice for review",
  "Draft a POA&M entry",
  "Create a review task in Workspace",
  "Send the reviewer a welcome packet with the KSI summary",
  "Take a package snapshot",
  "Email a one-page digest to leadership",
];

const SUGGESTED: Omit<Automation, "id" | "runs" | "createdBy" | "enabled">[] = [
  { name: "Welcome new reviewers", category: "access", trigger: "New reviewer signs in for the first time", actions: ["Send the reviewer a welcome packet with the KSI summary", "Notify Northwind admins"], minutesPerRun: 10, template: true },
  { name: "Stop a broken package from going out", category: "monitoring", trigger: "Package JSON validation fails", actions: ["Notify Northwind admins", "Post to #trust-center-alerts", "Draft a status notice for review"], minutesPerRun: 30, template: true },
  { name: "Auto-reply to repeat questions", category: "questionnaires", trigger: "Question asked on the trust page", condition: "A library answer matches strongly", actions: ["Draft the reply from the library answer", "Notify Northwind admins"], minutesPerRun: 12, template: true },
];

export function AdminAutomations() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} />;
  return <Body />;
}

function hoursSaved(autos: Automation[], runs: { automationId: string; at: string; result: string }[], days: number) {
  const from = nowMs() - days * 86400000;
  let minutes = 0;
  for (const r of runs) {
    if (r.result !== "success" || new Date(r.at).getTime() < from) continue;
    minutes += autos.find((a) => a.id === r.automationId)?.minutesPerRun ?? 0;
  }
  return minutes / 60;
}

function Body() {
  const automations = useTrust((s) => s.automations);
  const runs = useTrust((s) => s.automationRuns);
  const upsert = useTrust((s) => s.upsert);
  const [cat, setCat] = React.useState<"all" | AutomationCategory>("all");
  const [builder, setBuilder] = React.useState(false);

  const lifetimeHours = automations.reduce((a, x) => a + (x.runs * x.minutesPerRun) / 60, 0);
  const monthHours = hoursSaved(automations, runs, 30);
  const active = automations.filter((a) => a.enabled).length;
  const monthRuns = runs.filter((r) => nowMs() - new Date(r.at).getTime() < 30 * 86400000);
  const ok = monthRuns.filter((r) => r.result !== "failed").length;
  const shown = automations.filter((a) => cat === "all" || a.category === cat);
  const suggestions = SUGGESTED.filter((s) => !automations.some((a) => a.name === s.name));

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Trust center"
        title="Automations"
        description="Rules that do the routine work: approvals, reminders, publishing, validation and reporting. Each one shows what it did and how much time it saved."
        actions={
          <Button variant="primary" onClick={() => setBuilder(true)}>
            <Plus /> New automation
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Time saved, all time" value={`${Math.round(lifetimeHours)} h`} footer={`About ${Math.round(lifetimeHours / 7.5)} working days of manual work`} icon={<Clock3 />} />
        <StatCard label="Time saved, last 30 days" value={`${monthHours.toFixed(1)} h`} footer={`${monthRuns.length} runs this month`} icon={<Zap />} />
        <StatCard label="Active automations" value={`${active} of ${automations.length}`} footer="Paused ones keep their history" icon={<Play />} />
        <StatCard label="Success rate" value={monthRuns.length ? `${Math.round((ok / monthRuns.length) * 100)}%` : "100%"} footer="Skipped runs count as success" icon={<Sparkles />} />
      </div>

      <div className="scroll-thin -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {(["all", "access", "documents", "monitoring", "questionnaires", "reporting"] as const).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c === "all" ? "All" : CAT_LABEL[c]} <span className="opacity-60">{c === "all" ? automations.length : automations.filter((a) => a.category === c).length}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {shown.map((a) => (
            <motion.div key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <AutomationCard a={a} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {suggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Suggested for Northwind" description="Based on what admins did by hand in the last 90 days" />
          <ul className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-3">
            {suggestions.map((s) => (
              <li key={s.name} className="flex flex-col rounded-[10px] border border-dashed border-line-strong p-4">
                <div className="text-[13.5px] font-semibold text-fg">{s.name}</div>
                <div className="mt-1 text-[12.5px] text-muted">
                  When: {s.trigger.toLowerCase()}. Saves about {s.minutesPerRun} minutes each time.
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-auto self-start"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    upsert("automations", { ...s, id: uid("auto"), runs: 0, enabled: true, createdBy: ADMIN_NAME, template: undefined });
                    toast.success(`Added "${s.name}"`, { description: "It runs from now on. You can pause it any time." });
                  }}
                >
                  <Plus /> Add automation
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RunHistory />
      <Builder open={builder} onOpenChange={setBuilder} />
    </motion.div>
  );
}

function AutomationCard({ a }: { a: Automation }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const recordRun = useTrust((s) => s.recordRun);
  const [running, setRunning] = React.useState(-1);

  const runNow = async () => {
    for (let i = 0; i < a.actions.length; i++) {
      setRunning(i);
      await sleep(550);
    }
    setRunning(-1);
    recordRun(a.id, `Ran manually: ${a.actions.length} ${a.actions.length === 1 ? "step" : "steps"} completed (${a.actions[0]!.toLowerCase()}${a.actions.length > 1 ? ", …" : ""})`);
    toast.success(`${a.name} ran`, { description: `${a.actions.length} steps done. Saved about ${a.minutesPerRun} minutes.` });
  };

  return (
    <Card className={cn("overflow-hidden", !a.enabled && "opacity-70")}>
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-fg">{a.name}</span>
            <Badge tone="neutral">{CAT_LABEL[a.category]}</Badge>
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {a.runs} runs · saves about {a.minutesPerRun < 60 ? `${a.minutesPerRun} min` : `${a.minutesPerRun / 60} h`} each · {a.lastRunAt ? `last ${fmt.ago(a.lastRunAt)}` : "not run yet"}
          </div>
        </div>
        <Switch
          checked={a.enabled}
          aria-label={a.enabled ? `Pause ${a.name}` : `Turn on ${a.name}`}
          onCheckedChange={(v) => {
            upsert("automations", { ...a, enabled: v });
            addAudit({ action: v ? "Turned on automation" : "Paused automation", target: a.name, category: "settings" });
            toast(v ? `${a.name} is on` : `${a.name} is paused`);
          }}
        />
      </div>
      <ol className="relative px-4 py-4 sm:px-5">
        <span className="absolute bottom-6 left-[29px] top-6 w-px bg-line-strong sm:left-[33px]" aria-hidden />
        <Step icon={<Zap className="size-3.5" />} label="When" text={a.trigger} tone="trigger" />
        {a.condition && <Step icon={<Filter className="size-3.5" />} label="If" text={a.condition} tone="condition" />}
        {a.actions.map((x, i) => (
          <Step key={x} icon={<span className="text-[11px] font-semibold">{i + 1}</span>} label="Then" text={x} tone="action" active={running === i} done={running > i} />
        ))}
      </ol>
      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2.5 sm:px-5">
        <Button size="sm" variant="secondary" onClick={runNow} loading={running >= 0} disabled={!a.enabled}>
          <Play /> Run now
        </Button>
      </div>
    </Card>
  );
}

function Step({ icon, label, text, tone, active, done }: { icon: React.ReactNode; label: string; text: string; tone: "trigger" | "condition" | "action"; active?: boolean; done?: boolean }) {
  return (
    <li className="relative flex items-start gap-3 py-1.5">
      <span
        className={cn(
          "relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border text-fg transition-colors",
          tone === "trigger" ? "border-transparent bg-fg text-inverse" : tone === "condition" ? "border-line-strong bg-subtle" : "border-line-strong bg-surface",
          active && "border-brand bg-brand text-brand-fg",
          done && "border-success bg-success-soft text-success-fg",
        )}
      >
        {active ? <span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" /> : icon}
      </span>
      <span className="min-w-0 pt-1 text-[13px] leading-snug">
        <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</span>
        <span className="text-fg">{text}</span>
      </span>
    </li>
  );
}

function RunHistory() {
  const runs = useTrust((s) => s.automationRuns);
  const automations = useTrust((s) => s.automations);
  const [all, setAll] = React.useState(false);
  const shown = all ? runs.slice(0, 40) : runs.slice(0, 8);
  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader title="Run history" description="Every run is also in the audit trail" />
      {runs.length ? (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {shown.map((r) => (
            <li key={r.id} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,220px)_minmax(0,1fr)_90px] sm:items-center sm:gap-4 sm:px-5">
              <span className="text-[12.5px] text-muted">{fmt.day(r.at)}</span>
              <span className="truncate text-[13px] font-medium text-fg">{automations.find((a) => a.id === r.automationId)?.name ?? "Automation"}</span>
              <span className="text-[13px] text-muted">{r.summary}</span>
              <span className="sm:text-right">
                <Badge tone={r.result === "success" ? "success" : r.result === "skipped" ? "neutral" : "danger"}>{r.result === "success" ? "Done" : r.result === "skipped" ? "Skipped" : "Failed"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact title="No runs yet" />
      )}
      {runs.length > 8 && (
        <div className="border-t border-line px-4 py-2.5 sm:px-5">
          <Button size="sm" variant="ghost" onClick={() => setAll((x) => !x)}>
            {all ? "Show fewer" : `Show ${Math.min(40, runs.length) - 8} more`}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Builder({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const [name, setName] = React.useState("");
  const [trigger, setTrigger] = React.useState(TRIGGERS[0]!);
  const [condition, setCondition] = React.useState("None");
  const [actions, setActions] = React.useState<string[]>([]);
  const [minutes, setMinutes] = React.useState("10");
  const [category, setCategory] = React.useState<AutomationCategory>("access");
  const valid = name.trim().length > 2 && actions.length > 0 && Number(minutes) > 0;
  const reset = () => {
    setName("");
    setTrigger(TRIGGERS[0]!);
    setCondition("None");
    setActions([]);
    setMinutes("10");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader title="New automation" description="Pick what starts it, an optional condition, and the steps it takes. You can pause it at any time." />
        <DialogBody className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="Name" htmlFor="au-name">
              <Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Welcome new reviewers" />
            </Field>
            <Field label="Area">
              <Select ariaLabel="Area" value={category} onValueChange={(v) => setCategory(v as AutomationCategory)} options={(Object.keys(CAT_LABEL) as AutomationCategory[]).map((c) => ({ value: c, label: CAT_LABEL[c] }))} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="When">
              <Select ariaLabel="Trigger" value={trigger} onValueChange={setTrigger} options={TRIGGERS.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Only if">
              <Select ariaLabel="Condition" value={condition} onValueChange={setCondition} options={CONDITIONS.map((t) => ({ value: t, label: t }))} />
            </Field>
          </div>
          <div>
            <div className="text-[13px] font-medium text-fg">Then, in this order</div>
            <ul className="scroll-thin mt-2 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-[10px] border border-line p-2">
              {ACTIONS.map((x) => {
                const i = actions.indexOf(x);
                return (
                  <li key={x}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] hover:bg-subtle">
                      <Checkbox checked={i >= 0} onCheckedChange={(v) => setActions(v ? [...actions, x] : actions.filter((y) => y !== x))} />
                      <span className="flex-1 text-fg">{x}</span>
                      {i >= 0 && <span className="grid size-5 place-items-center rounded-full bg-fg text-[11px] font-semibold text-inverse">{i + 1}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <Field label="Minutes of manual work this replaces, per run" htmlFor="au-min" hint="Used for the time-saved figures.">
            <Input id="au-min" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-32" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const a: Automation = {
                id: uid("auto"),
                name: name.trim(),
                category,
                trigger,
                condition: condition === "None" ? undefined : condition,
                actions,
                enabled: true,
                runs: 0,
                minutesPerRun: Number(minutes),
                createdBy: ADMIN_NAME,
              };
              upsert("automations", a);
              addAudit({ action: "Created automation", target: a.name, detail: `${a.trigger} → ${a.actions.length} steps`, category: "settings" });
              toast.success(`"${a.name}" is on`);
              onOpenChange(false);
              setTimeout(reset, 200);
            }}
          >
            Turn on automation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
