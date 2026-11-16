/* Sensitive-data detection for uploads. In the demo the "document text" is a deterministic
   excerpt; the detectors are real regular expressions and run on it the same way they would
   on extracted text. */

export type RedactionKind = "ip" | "host" | "email" | "account";

export const KIND_LABEL: Record<RedactionKind, string> = {
  ip: "IP address",
  host: "Internal hostname",
  email: "Personal email",
  account: "Cloud account ID",
};

export type Excerpt = { page: number; text: string };
export type RedactionFinding = { id: string; kind: RedactionKind; value: string; page: number; line: number; start: number; end: number };

const DETECTORS: [RedactionKind, RegExp][] = [
  ["ip", /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g],
  ["host", /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:internal|local|corp|lan)\b/g],
  ["email", /\b[\w.+-]+@(?:gmail|outlook|hotmail|yahoo|icloud|proton)\.(?:com|me)\b/g],
  ["account", /\b\d{4}-\d{4}-\d{4}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g],
];

const LINES = [
  "Production traffic enters through the regional load balancer at 10.24.8.17 and is routed to app-prod-03.workbench.internal.",
  "Escalations after hours go to the on-call lead at j.ramirez.home@gmail.com until the pager rotation is updated.",
  "Backups are written to the recovery account 4471-2290-1183 in a second US region and tested each quarter.",
  "Administrative access uses phishing-resistant MFA and is limited to the bastion host jump-01.ops.corp.",
  "Log storage for the Azure tenant runs in subscription 3f2b9c1e-7a44-4d0b-9e21-6c5d8a0f4b12 with 12-month retention.",
  "Customer data is encrypted at rest with AES-256 using keys held in a FIPS 140-3 validated module.",
  "The database subnet 10.24.32.0/20 accepts connections only from the application tier.",
  "Vendor security contacts are kept in the supplier register; the backup contact is ops.lead@outlook.com.",
];

/** A deterministic excerpt for an uploaded file: three or four lines, at least one with nothing to redact. */
export function excerptFor(seed: number, pages: number): Excerpt[] {
  const risky = [0, 1, 2, 3, 4, 6, 7];
  const pick = [risky[seed % 7]!, risky[(seed >> 3) % 7]!, risky[(seed >> 6) % 7]!].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2 + (seed % 2));
  pick.splice(1, 0, 5);
  const gap = Math.max(1, Math.floor(pages / (pick.length + 1)));
  return pick.map((i, k) => ({ page: Math.min(pages, 1 + (seed % 2) + k * gap), text: LINES[i]! }));
}

export function detect(excerpt: Excerpt[]): RedactionFinding[] {
  const out: RedactionFinding[] = [];
  excerpt.forEach((ex, line) => {
    const taken: [number, number][] = [];
    for (const [kind, re] of DETECTORS) {
      for (const m of ex.text.matchAll(re)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (taken.some(([a, b]) => start < b && end > a)) continue;
        taken.push([start, end]);
        out.push({ id: `${line}-${start}`, kind, value: m[0], page: ex.page, line, start, end });
      }
    }
  });
  return out.sort((a, b) => a.line - b.line || a.start - b.start);
}
