/* What changed since the last snapshot, written as a subscriber notice. Built from data the
   trust center already has (document versions, package JSON, subprocessors, KSIs, incidents),
   so nobody has to write release notes by hand. */

import type { Incident, KsiMetric, PackageState, Snapshot, Subprocessor, TrustDocument } from "./types";
import { diffLines, fmt } from "./utils";

export type Change = { kind: "added" | "version" | "package" | "subprocessor" | "ksi" | "incident"; text: string };

export function changesSince(s: {
  snapshots: Snapshot[];
  docs: TrustDocument[];
  pkg: PackageState;
  subprocessors: Subprocessor[];
  ksi: KsiMetric[];
  incidents: Incident[];
}): { since: Snapshot | undefined; changes: Change[] } {
  const since = s.snapshots[0];
  const at = since ? new Date(since.createdAt).getTime() : 0;
  const after = (iso?: string) => !!iso && new Date(iso).getTime() > at;
  const changes: Change[] = [];

  for (const d of s.docs) {
    const fresh = d.versions.filter((v) => after(v.publishedAt));
    if (!fresh.length) continue;
    if (fresh.length === d.versions.length) changes.push({ kind: "added", text: `Added ${d.title} (version ${d.versions[0]!.version}).` });
    else {
      const v = d.versions[0]!;
      changes.push({ kind: "version", text: `${d.title}: version ${v.version}${v.note ? `, ${v.note.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}` : ""}.` });
    }
  }

  if (s.pkg.baseline && s.pkg.baseline !== s.pkg.published) {
    const n = diffLines(s.pkg.baseline, s.pkg.published).filter((l) => l.kind !== "same").length;
    changes.push({ kind: "package", text: `Package JSON revision ${s.pkg.revision}: ${n} ${n === 1 ? "line" : "lines"} changed, validated against the schema.` });
  } else if (after(s.pkg.generatedAt)) {
    changes.push({ kind: "package", text: `Package JSON regenerated as revision ${s.pkg.revision}, no content changes.` });
  }

  for (const p of s.subprocessors) {
    if (after(p.since)) changes.push({ kind: "subprocessor", text: `${p.status === "planned" ? "Planned" : "New"} subprocessor: ${p.name}, ${p.purpose.toLowerCase()}.` });
  }

  const revalidated = s.ksi.filter((k) => after(k.lastValidated));
  if (revalidated.length) {
    const checks = s.ksi.reduce((a, k) => a + k.checks, 0);
    const passing = s.ksi.reduce((a, k) => a + k.passing, 0);
    changes.push({ kind: "ksi", text: `Key Security Indicators revalidated: ${passing} of ${checks} checks passing.` });
  }

  for (const i of s.incidents) {
    if (after(i.resolvedAt) && i.impact !== "maintenance") changes.push({ kind: "incident", text: `Resolved: ${i.title} (${fmt.date(i.resolvedAt!)}).` });
  }

  return { since, changes };
}

export function noticeBody(opts: { changes: Change[]; since: Snapshot | undefined; docs: number; restricted: number; revision: number }) {
  const head = `Northwind sealed ${opts.docs} published documents (${opts.restricted} restricted) and package JSON revision ${opts.revision}.`;
  const list = opts.changes.length
    ? `\n\nChanges since ${opts.since ? `${opts.since.label} (${fmt.date(opts.since.createdAt)})` : "the first snapshot"}:\n${opts.changes.map((c) => `- ${c.text}`).join("\n")}`
    : `\n\nNo content changed since ${opts.since ? opts.since.label : "the last snapshot"}.`;
  return `${head}${list}\n\nEach file's checksum is recorded, so you can confirm that what you downloaded matches this snapshot.`;
}
