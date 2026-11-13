"use client";

import * as React from "react";
import { Check, Download, LockKeyhole } from "lucide-react";
import { useTrust } from "@/lib/store";
import type { TrustDocument } from "@/lib/types";
import { cn, fmt, nowMs } from "@/lib/utils";
import { Section } from "./layout";
import { KsiDashboard } from "../ksi-dashboard";

/* ───────── Compliance ledger + assessment timeline ───────── */
export function Compliance({ onOpenDoc }: { onOpenDoc: (d: TrustDocument) => void }) {
  const profile = useTrust((s) => s.profile);
  const docs = useTrust((s) => s.documents);
  const byId = (id: string) => docs.find((d) => d.id === id);
  const rows = [
    { name: "FedRAMP 20x", scope: "Class C", status: profile.fedramp.status, date: profile.fedramp.certifiedOn, evidence: byId("independent-assessment-report"), body: "Certified package with daily Key Security Indicator validation and monthly continuous monitoring." },
    { name: "SOC 2 Type II", scope: "Security, availability, confidentiality", status: "Report issued", date: profile.certs[1]!.date, evidence: byId("soc3"), body: "Period July 2025 to June 2026, unqualified opinion. The full report is restricted; the SOC 3 summary is public." },
    { name: "ISO/IEC 27001:2022", scope: "Information security management", status: "Certified", date: profile.certs[2]!.date, evidence: byId("iso27001-certificate"), body: "Certificate valid to February 2028, with annual surveillance audits." },
    { name: "Section 508", scope: "VPAT 2.5, WCAG 2.1 AA", status: "Published", date: profile.certs[3]!.date, evidence: byId("vpat"), body: "Accessibility conformance for the Workbench web application." },
  ];

  return (
    <Section
      id="compliance"
      title="Compliance"
      lead="Certifications and reports for Northwind Workbench, with the document behind each one."
    >
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:gap-6">
            <div className="min-w-0">
              <div className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{r.name}</div>
              <div className="text-[13px] text-muted">{r.scope}</div>
            </div>
            <p className="text-[13.5px] leading-relaxed text-muted">{r.body}</p>
            <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-success-fg">
                <span className="size-1.5 rounded-full bg-success" />
                {r.status}, {fmt.short(r.date)} {new Date(r.date).getFullYear()}
              </span>
              {r.evidence && (
                <button
                  onClick={() => onOpenDoc(r.evidence!)}
                  className="inline-flex max-w-full items-start gap-1 text-left text-[12.5px] font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg sm:max-w-[260px] sm:text-right"
                >
                  {r.evidence.visibility === "public" ? <Download className="mt-0.5 size-3.5 shrink-0" /> : <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />}
                  {r.evidence.title.replace("ISO/IEC 27001:2022 ", "")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <AssessmentTimeline />
    </Section>
  );
}

function AssessmentTimeline() {
  const f = useTrust((s) => s.profile.fedramp);
  const certified = new Date(f.certifiedOn).getTime();
  const points = [
    { label: "Initial assessment", at: certified - 46 * 86400000 },
    { label: "Certified", at: certified },
    { label: "Annual assessment", at: new Date(f.lastAssessment).getTime() },
    { label: "Latest monthly report", at: new Date(f.conmonLast).getTime() },
    { label: "Next annual assessment", at: new Date(f.nextAssessment).getTime() },
  ].sort((a, b) => a.at - b.at);
  const now = nowMs();
  const doneCount = points.filter((p) => p.at <= now).length;
  // Evenly spaced steps; "today" sits between the last completed step and the next one.
  const step = 100 / (points.length - 1);
  const todayPos = Math.min(100, (doneCount - 1) * step + step * 0.35);
  return (
    <div className="mt-10">
      <div className="text-[13px] font-medium text-fg">FedRAMP assessment cycle</div>
      <div className="scroll-thin mt-4 overflow-x-auto pb-2">
        <div className="relative mx-auto min-w-[560px] px-12 pb-2 pt-7">
          <div className="relative h-4">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
            <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-tenant" style={{ width: `${todayPos}%` }} />
            <div className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-fg" style={{ left: `${todayPos}%` }}>
              Today
            </div>
            <span className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-fg" style={{ left: `${todayPos}%` }} />
            {points.map((p, i) => {
              const done = p.at <= now;
              return (
                <span
                  key={p.label}
                  className={cn("absolute top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2", done ? "border-tenant bg-tenant" : "border-line-strong bg-canvas")}
                  style={{ left: `${i * step}%` }}
                >
                  {done && <Check className="size-2.5 text-tenant-fg" strokeWidth={3.5} />}
                </span>
              );
            })}
          </div>
          <div className="relative mt-3 h-10">
            {points.map((p, i) => (
              <div key={p.label} className="absolute w-28 -translate-x-1/2 text-center text-[11.5px] leading-snug" style={{ left: `${i * step}%` }}>
                <div className={cn("font-medium", p.at <= now ? "text-fg" : "text-muted")}>{p.label}</div>
                <div className="text-faint">{fmt.short(new Date(p.at).toISOString())} {new Date(p.at).getFullYear()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Key Security Indicators ───────── */
export function Controls({ onOpenDoc }: { onOpenDoc: (d: TrustDocument) => void }) {
  const ksi = useTrust((s) => s.ksi);
  const total = ksi.reduce((a, k) => a + k.checks, 0);
  const last = ksi.map((k) => k.lastValidated).sort().at(-1);
  return (
    <Section
      id="controls"
      title="Key Security Indicators"
      lead={
        <>
          FedRAMP 20x measures security through Key Security Indicators. Northwind validates <span className="font-medium text-fg">{total} checks</span> across all 10
          themes, most of them automatically every day.
        </>
      }
      aside={
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <span className="relative inline-flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50" />
            <span className="relative size-2 rounded-full bg-success" />
          </span>
          {last ? `Last run ${fmt.day(last)}` : "Validation scheduled"}
        </div>
      }
    >
      <KsiDashboard onOpenDoc={onOpenDoc} />
    </Section>
  );
}
