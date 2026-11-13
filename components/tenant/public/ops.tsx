"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, ChevronDown, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/menu";
import { CopyButton } from "@/components/kit/bits";
import { CodeViewer } from "@/components/kit/code";
import { JSON_PATH } from "@/lib/mock/package";
import { useTrust } from "@/lib/store";
import type { ComponentStatus, Incident, StatusComponent } from "@/lib/types";
import { cn, downloadText, fakeHash, fmt, nowMs } from "@/lib/utils";
import { ApiReference, ENDPOINTS, MethodBadge } from "../api-reference";
import { Section } from "./layout";

/* ───────── Service status ───────── */
const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded performance",
  outage: "Outage",
  maintenance: "Under maintenance",
};

export function overallStatus(components: StatusComponent[]) {
  if (components.some((c) => c.status === "outage")) return { label: "Partial outage", tone: "danger" as const };
  if (components.some((c) => c.status === "degraded")) return { label: "Degraded performance", tone: "warning" as const };
  if (components.some((c) => c.status === "maintenance")) return { label: "Maintenance in progress", tone: "warning" as const };
  return { label: "All systems operational", tone: "success" as const };
}

export function uptimeOf(components: StatusComponent[]) {
  const all = components.flatMap((c) => c.uptime);
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 100;
}

function dayLabel(daysAgo: number) {
  return fmt.date(new Date(nowMs() - daysAgo * 86400000).toISOString());
}

function UptimeBars({ values }: { values: number[] }) {
  return (
    <div className="flex h-8 items-stretch gap-[2px]" role="img" aria-label={`Uptime for the last ${values.length} days`}>
      {values.map((v, i) => {
        const tone = v >= 99.95 ? "bg-success/75" : v >= 99 ? "bg-warning" : "bg-danger";
        return (
          <Tooltip key={i} content={`${dayLabel(values.length - 1 - i)}: ${v === 100 ? "no downtime" : `${v.toFixed(2)}% uptime`}`}>
            <span className={cn("min-w-[2px] flex-1 rounded-[2px] transition-opacity hover:opacity-70", tone)} />
          </Tooltip>
        );
      })}
    </div>
  );
}

export function ServiceStatus({ onSubscribe }: { onSubscribe: () => void }) {
  const components = useTrust((s) => s.components);
  const incidents = useTrust((s) => s.incidents);
  const overall = overallStatus(components);
  const uptime = uptimeOf(components);
  const past = incidents.filter((i) => i.resolvedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <Section
      id="status"
      title="Service status"
      lead="Live status of Workbench and its last 90 days. Incidents that affect agencies are posted here and emailed to subscribers."
      aside={
        <Button size="sm" variant="secondary" onClick={onSubscribe}>
          Get incident emails
        </Button>
      }
    >
      <div className={cn("flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3.5", overall.tone === "success" ? "border-success/25 bg-success-soft" : "border-warning/30 bg-warning-soft")}>
        <span className="relative inline-flex size-2.5">
          <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", overall.tone === "success" ? "bg-success" : "bg-warning")} />
          <span className={cn("relative size-2.5 rounded-full", overall.tone === "success" ? "bg-success" : "bg-warning")} />
        </span>
        <span className="text-[14.5px] font-medium text-fg">{overall.label}</span>
        <span className="ml-auto text-[12.5px] text-muted">{uptime.toFixed(2)}% uptime, last 90 days</span>
      </div>
      <ul className="mt-5 divide-y divide-line">
        {components.map((c) => {
          const avg = c.uptime.reduce((a, b) => a + b, 0) / c.uptime.length;
          return (
            <li key={c.id} className="py-4">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <span className="text-[14px] font-medium text-fg">{c.name}</span>
                  <span className="ml-2 hidden text-[12.5px] text-faint sm:inline">{c.description}</span>
                </div>
                <span className={cn("text-[12.5px] font-medium", c.status === "operational" ? "text-success-fg" : "text-warning-fg")}>{STATUS_LABEL[c.status]}</span>
              </div>
              <UptimeBars values={c.uptime} />
              <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
                <span>90 days ago</span>
                <span>{avg.toFixed(2)}%</span>
                <span>Today</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-8">
        <div className="text-[13px] font-medium text-fg">Past incidents</div>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {past.map((i) => (
            <IncidentRow key={i.id} incident={i} />
          ))}
        </ul>
      </div>
    </Section>
  );
}

function IncidentRow({ incident: i }: { incident: Incident }) {
  const [open, setOpen] = React.useState(false);
  const minutes = i.resolvedAt ? Math.round((new Date(i.resolvedAt).getTime() - new Date(i.startedAt).getTime()) / 60000) : null;
  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 py-3.5 text-left">
        <Badge tone={i.impact === "maintenance" ? "neutral" : i.impact === "major" ? "danger" : "warning"}>{i.impact === "maintenance" ? "Maintenance" : i.impact === "major" ? "Major" : "Minor"}</Badge>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">{i.title}</span>
        <span className="hidden shrink-0 text-[12.5px] text-muted sm:inline">
          {fmt.date(i.startedAt)}
          {minutes !== null && ` · ${minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}`}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-4 pl-1">
            {i.updates.map((u, k) => (
              <li key={k} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-1.5 text-[13px]">
                <span className="font-medium capitalize text-fg">{u.status}</span>
                <span className="text-muted">
                  {u.text} <span className="text-faint">· {fmt.dateTime(u.at)}</span>
                </span>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ───────── Machine-readable + API ───────── */
export function MachineReadable({ onVerify }: { onVerify: () => void }) {
  const pkg = useTrust((s) => s.pkg);
  const host = useTrust((s) => s.domain.host);
  const [apiOpen, setApiOpen] = React.useState(false);
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const url = `https://${host}${JSON_PATH}`;
  const preview = pkg.published.split("\n").slice(0, 16).join("\n");
  return (
    <Section
      id="machine-readable"
      title="Machine-readable package"
      lead="For agency systems: the Certification Package Overview as JSON, generated from the same records as this page, plus a REST API for approved agencies."
    >
      <div className="overflow-hidden rounded-[14px] border border-line-strong">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" title={url}>
            {url}
          </span>
          <Badge tone="success">
            <BadgeCheck /> Valid against FedRAMP schema
          </Badge>
          <CopyButton value={url} label="Copy URL" toastText="JSON URL copied" />
        </div>
        <div className="relative bg-[#0b0b0b] dark:bg-[#0d0d0d]">
          <pre className="max-h-[260px] overflow-hidden px-5 py-4 font-mono text-[12px] leading-[1.7] text-[#d4d4d4]">{preview}</pre>
          <div className="pointer-events-none absolute inset-x-0 bottom-[52px] h-20 bg-gradient-to-t from-[#0b0b0b] to-transparent dark:from-[#0d0d0d]" />
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-5 py-3">
            <button onClick={() => setJsonOpen(true)} className="rounded-[7px] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#0a0a0a] hover:bg-white/90">
              View full file
            </button>
            <button onClick={() => downloadText("certification-package-overview.json", pkg.published, "application/json")} className="inline-flex items-center gap-1 rounded-[7px] border border-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white/85 hover:bg-white/10">
              <Download className="size-3.5" /> Download
            </button>
            <span className="ml-auto hidden font-mono text-[11.5px] text-white/45 sm:inline">application/json · UTF-8</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {[
            { k: "Revision", v: String(pkg.revision) },
            { k: "Generated", v: fmt.ago(pkg.generatedAt) },
            { k: "Size", v: `${(pkg.published.length / 1024).toFixed(1)} KB` },
            { k: "SHA-256", v: <button onClick={onVerify} className="font-mono underline decoration-line-strong underline-offset-4 hover:decoration-fg">{fakeHash(pkg.published).slice(0, 12)}…</button> },
          ].map((r) => (
            <div key={r.k} className="bg-surface px-4 py-3">
              <dt className="text-[11.5px] text-muted">{r.k}</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-fg">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <div className="text-[13px] font-medium text-fg">REST API for approved agencies</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Each agency gets its own key. Every call is logged, and agencies can read their own access records.</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {ENDPOINTS.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <MethodBadge method={e.method} />
                <span className="font-mono text-[12.5px] text-fg">/api/v1{e.path}</span>
                <span className="ml-auto hidden truncate text-[12.5px] text-muted sm:inline">{e.title}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="secondary" onClick={() => setApiOpen(true)} className="md:mt-7">
          API reference <ArrowUpRight />
        </Button>
      </div>

      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent size="xl">
          <DialogHeader title="Certification Package Overview" description={`Revision ${pkg.revision}, generated ${fmt.dateTime(pkg.generatedAt)}.`} />
          <DialogBody>
            <CodeViewer code={pkg.published} title={JSON_PATH} maxHeight={520} />
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog open={apiOpen} onOpenChange={setApiOpen}>
        <DialogContent size="xl">
          <DialogHeader title="API reference" description={`Base URL https://${host}/api/v1 · Bearer key issued per agency.`} />
          <DialogBody>
            <ApiReference host={host} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function VerifyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pkg = useTrust((s) => s.pkg);
  const host = useTrust((s) => s.domain.host);
  const hash = fakeHash(pkg.published);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader
          title="Verify the package fingerprint"
          description="The fingerprint is the SHA-256 hash of the published JSON. If yours matches, the file you have is exactly the one this page publishes."
        />
        <DialogBody className="grid grid-cols-1 gap-4">
          <div className="rounded-[10px] border border-line bg-raised px-4 py-3">
            <div className="text-[11.5px] text-muted">Published fingerprint, revision {pkg.revision}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-fg">{hash}</span>
              <CopyButton value={hash} iconOnly label="Copy fingerprint" toastText="Fingerprint copied" />
            </div>
          </div>
          <CodeViewer
            language="shell"
            title="Check it yourself"
            code={`curl -sO https://${host}${JSON_PATH}\nshasum -a 256 certification-package-overview.json\n# PowerShell: Get-FileHash certification-package-overview.json -Algorithm SHA256`}
          />
          <p className="text-[12.5px] text-muted">Agency systems can also compare the fingerprint over the API before they import a new revision.</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Access steps + contacts ───────── */
export function AccessAndContacts({ onRequest }: { onRequest: () => void }) {
  const contacts = useTrust((s) => s.profile.contacts);
  const steps = [
    { t: "Request access", b: "Use your work email, say what you are reviewing, and accept the NDA. You can pick specific documents." },
    { t: "Northwind approves", b: "Agency .gov and .mil addresses are approved at once. Other requests are reviewed within one business day." },
    { t: "Sign in and download", b: "Open the emailed sign-in link. Files are watermarked with your name; agency systems can use an API key." },
  ];
  return (
    <Section id="contact" title="Access and contacts" lead="How reviewers get restricted documents, and who to talk to.">
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="bg-surface p-5">
            <span className="font-mono text-[12px] text-faint">0{i + 1}</span>
            <div className="mt-3 text-[14.5px] font-semibold text-fg">{s.t}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.b}</p>
          </li>
        ))}
      </ol>
      <Button variant="tenant" className="mt-4" onClick={onRequest}>
        Request access
      </Button>
      <ul className="mt-10 divide-y divide-line border-y border-line">
        {contacts.map((c) => (
          <li key={c.role} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
            <span className="text-[12.5px] text-muted">{c.role}</span>
            <span>
              <span className="block text-[14px] font-medium text-fg">{c.name}</span>
              <span className="block text-[12.5px] text-muted">{c.note}</span>
            </span>
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              <Mail className="size-3.5" />
              {c.email}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
