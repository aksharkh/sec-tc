/* Package completeness: is everything an agency expects actually published, and current?
   Pure functions over store data, so the overview, the machine-readable page and the
   snapshot dialog all show the same answer. */

import type { AccessRequest, NdaRecord, PackageState, Reviewer, StandardQuestionnaire, KsiMetric, TrustDocument } from "./types";
import { DAY, nowMs } from "./utils";
import { effectiveStatus } from "./store";
import { DOC_SPECS } from "./mock/catalog";

export type CheckStatus = "ok" | "stale" | "missing";
export type PackageCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** What fixes it from the UI. */
  fix?: "regenerate" | "upload" | "new-version";
  docId?: string;
};

/** Documents an agency expects in the package, and how often each must be refreshed. */
export const REQUIRED_DOCS: { id: string; label: string; maxDays: number }[] = [
  { id: "ksi-validation-summary", label: "KSI Validation Summary", maxDays: 31 },
  { id: "independent-assessment-report", label: "Independent Assessment Report", maxDays: 365 },
  { id: "system-boundary", label: "System Boundary and Data Flows", maxDays: 365 },
  { id: "poam", label: "Plan of Action and Milestones", maxDays: 31 },
  { id: "conmon-report", label: "Continuous Monitoring Report", maxDays: 31 },
  { id: "customer-responsibility-matrix", label: "Customer Responsibility Matrix", maxDays: 365 },
  { id: "significant-change-log", label: "Significant Change Notifications", maxDays: 90 },
  { id: "vulnerability-scan-summary", label: "Vulnerability Scan Summary", maxDays: 31 },
  { id: "sdr", label: "SDR", maxDays: 365 },
];

const days = (iso: string) => Math.floor((nowMs() - new Date(iso).getTime()) / DAY);

export function checkPackage(docs: TrustDocument[], pkg: PackageState): PackageCheck[] {
  const latestPublish = docs.reduce((m, d) => Math.max(m, new Date(d.versions[0]?.publishedAt ?? 0).getTime()), 0);
  const out: PackageCheck[] = [
    {
      id: "json",
      label: "Certification Package Overview (JSON)",
      status: !pkg.published ? "missing" : pkg.status === "valid" ? "ok" : "stale",
      detail: !pkg.published ? "Not generated yet" : pkg.status === "valid" ? `Revision ${pkg.revision}, validated against the schema` : "Needs to be regenerated and validated",
      fix: pkg.status === "valid" && pkg.published ? undefined : "regenerate",
    },
    {
      id: "json-current",
      label: "JSON lists the latest documents",
      status: new Date(pkg.generatedAt).getTime() >= latestPublish ? "ok" : "stale",
      detail:
        new Date(pkg.generatedAt).getTime() >= latestPublish
          ? `Generated ${days(pkg.generatedAt) === 0 ? "today" : `${days(pkg.generatedAt)} days ago`}, after the last document change`
          : "A document changed after the JSON was generated",
      fix: new Date(pkg.generatedAt).getTime() >= latestPublish ? undefined : "regenerate",
    },
  ];
  for (const r of REQUIRED_DOCS) {
    const d = docs.find((x) => x.id === r.id);
    if (!d || !d.versions[0]) {
      out.push({ id: r.id, label: r.label, status: "missing", detail: "Not uploaded", fix: "upload" });
      continue;
    }
    const age = days(d.versions[0].publishedAt);
    out.push({
      id: r.id,
      label: d.title,
      docId: d.id,
      status: age > r.maxDays ? "stale" : "ok",
      detail: age > r.maxDays ? `Last version ${age} days old; refresh every ${r.maxDays} days` : `Version ${d.versions[0].version}, ${age === 0 ? "today" : `${age} days old`}`,
      fix: age > r.maxDays ? "new-version" : undefined,
    });
  }
  return out;
}

export const completenessPct = (checks: PackageCheck[]) => Math.round((checks.filter((c) => c.status === "ok").length / Math.max(1, checks.length)) * 100);

/* ───────── Trust center health: the rows behind the overview chart ───────── */

export type HealthRow = { id: string; href: string; label: string; short: string; sub: string; pct: number; hue: number };

export function healthRows(s: {
  docs: TrustDocument[];
  pkg: PackageState;
  ksi: KsiMetric[];
  standards: StandardQuestionnaire[];
  requests: AccessRequest[];
  reviewers: Reviewer[];
  ndaRecords: NdaRecord[];
  ndaVersion: string;
}): HealthRow[] {
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 100);

  const checks = checkPackage(s.docs, s.pkg);
  const okChecks = checks.filter((c) => c.status === "ok").length;

  // On schedule: the newest version is younger than the document's own refresh cadence (plus a week's grace).
  const cadence = (d: TrustDocument) => DOC_SPECS.find((x) => x.id === d.id)?.every ?? 365;
  const current = s.docs.filter((d) => d.versions[0] && days(d.versions[0].publishedAt) <= cadence(d) + 7).length;

  const ksiChecks = s.ksi.reduce((a, k) => a + k.checks, 0);
  const ksiPassing = s.ksi.reduce((a, k) => a + k.passing, 0);
  const ksiAuto = s.ksi.reduce((a, k) => a + (k.checks * k.automation) / 100, 0);

  const items = s.standards.flatMap((q) => q.items);
  const evidenced = items.filter((i) => i.docIds.length > 0).length;

  const decided = s.requests.filter((r) => r.status !== "pending" && r.decidedAt);
  const fast = decided.filter((r) => new Date(r.decidedAt!).getTime() - new Date(r.submittedAt).getTime() <= DAY).length;

  const active = s.reviewers.filter((r) => r.kind === "person" && effectiveStatus(r) === "active");
  const signed = active.filter((r) => s.ndaRecords.some((n) => n.email.toLowerCase() === r.handle.toLowerCase() && n.version === s.ndaVersion)).length;

  return [
    { id: "package", href: "/admin/machine-readable#completeness", label: "Package complete", short: "Package", sub: `${okChecks} of ${checks.length} checks`, pct: pct(okChecks, checks.length), hue: 222 },
    { id: "ksi", href: "/admin/machine-readable", label: "KSIs passing", short: "Passing", sub: `${ksiPassing} of ${ksiChecks} checks`, pct: pct(ksiPassing, ksiChecks), hue: 160 },
    { id: "auto", href: "/admin/automations", label: "KSIs automated", short: "Automated", sub: "validated continuously", pct: pct(ksiAuto, ksiChecks), hue: 190 },
    { id: "docs", href: "/admin/documents", label: "Documents on schedule", short: "Docs", sub: `${current} of ${s.docs.length} refreshed on time`, pct: pct(current, s.docs.length), hue: 262 },
    { id: "evidence", href: "/admin/questionnaires", label: "Answers with evidence", short: "Evidence", sub: `${evidenced} of ${items.length} CAIQ and SIG Lite`, pct: pct(evidenced, items.length), hue: 300 },
    { id: "sla", href: "/admin/access", label: "Requests within a day", short: "Speed", sub: `${fast} of ${decided.length} decided`, pct: pct(fast, decided.length), hue: 28 },
    { id: "nda", href: "/admin/access?tab=nda", label: "Reviewers on current NDA", short: "NDA", sub: `${signed} of ${active.length} active`, pct: pct(signed, active.length), hue: 340 },
  ];
}
