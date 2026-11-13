import { format, startOfMonth, subMonths } from "date-fns";
import type {
  AccessRequest,
  ApiKey,
  ClientAdmin,
  DocVersion,
  DomainState,
  LogAction,
  LogEvent,
  Notice,
  Reviewer,
  Rule,
  Snapshot,
  Tenant,
  TrustDocument,
} from "@/lib/types";
import { DAY, HOUR, MIN, fakeHash, mulberry32 } from "@/lib/utils";
import { AGENCIES, DOC_SPECS, GENERIC_NOTES } from "./catalog";

export type TenantProfile = {
  name: string;
  legal: string;
  product: string;
  slug: string;
  website: string;
  hq: string;
  uei: string;
  packageId: string;
  about: string;
  facts: { label: string; value: string }[];
  fedramp: {
    program: string;
    cls: string;
    status: string;
    certifiedOn: string;
    lastAssessment: string;
    nextAssessment: string;
    conmonCadence: string;
    conmonLast: string;
    assessor: string;
  };
  certs: { name: string; detail: string; status: string; date: string }[];
  contacts: { role: string; name: string; email: string; note: string }[];
};

export function seedProfile(now: number): TenantProfile {
  const iso = (d: number) => new Date(now - d * DAY).toISOString();
  return {
    name: "Northwind Cloud",
    legal: "Northwind Cloud, Inc.",
    product: "Northwind Workbench",
    slug: "northwind",
    website: "northwindcloud.com",
    hq: "Arlington, Virginia",
    uei: "NWC4H7KD2M91",
    packageId: "FR20X-C-26-0318",
    about:
      "Northwind Workbench is a case and records management platform for federal program offices. Agencies use it to intake applications, route reviews and keep the record for each case. It runs as software as a service in US-only cloud regions, operated by staff located in the United States.",
    facts: [
      { label: "Service model", value: "Software as a service" },
      { label: "Deployment", value: "Public cloud, US regions only" },
      { label: "Federal customers", value: "14 program offices" },
      { label: "Data handled", value: "CUI and PII, moderate impact" },
    ],
    fedramp: {
      program: "FedRAMP 20x",
      cls: "Class C",
      status: "Certified",
      certifiedOn: iso(240),
      lastAssessment: iso(44),
      nextAssessment: new Date(now + 321 * DAY).toISOString(),
      conmonCadence: "Monthly",
      conmonLast: iso(13),
      assessor: "Keystone Assurance Partners",
    },
    certs: [
      { name: "FedRAMP 20x", detail: "Class C", status: "Certified", date: iso(240) },
      { name: "SOC 2 Type II", detail: "Security, availability, confidentiality", status: "Report issued", date: iso(96) },
      { name: "ISO/IEC 27001:2022", detail: "Certificate valid to Feb 2028", status: "Certified", date: iso(270) },
      { name: "Section 508", detail: "VPAT 2.5, WCAG 2.1 AA", status: "Published", date: iso(130) },
    ],
    contacts: [
      { role: "Security team", name: "Hannah Cole, Head of Security", email: "security@northwindcloud.com", note: "Questions about controls, findings or the package." },
      { role: "Vulnerability disclosure", name: "Northwind PSIRT", email: "psirt@northwindcloud.com", note: "Report a vulnerability. We reply within two business days." },
      { role: "Trust center support", name: "SecureKnots", email: "trust@secureknots.com", note: "Access, sign-in links and API keys." },
    ],
  };
}

function monthLabel(now: number, back: number) {
  return format(subMonths(new Date(now), back), "MMMM yyyy");
}

export function seedDocuments(now: number): TrustDocument[] {
  const prev = monthLabel(now, 1);
  return DOC_SPECS.map((s, idx) => {
    const rand = mulberry32(idx * 97 + 13);
    const versions: DocVersion[] = [];
    for (let i = 0; i < s.versions; i++) {
      const n = s.versions - i;
      const major = Math.ceil(n / 2);
      const minor = (n + 1) % 2;
      const daysAgo = s.updated + i * s.every + Math.floor(rand() * 6);
      const note = s.notes?.[i] ?? (i === s.versions - 1 ? "First published version" : GENERIC_NOTES[Math.floor(rand() * (GENERIC_NOTES.length - 1))]!);
      const words = Math.round(s.words * (1 - i * 0.035) * (0.97 + rand() * 0.06));
      versions.push({
        version: s.id === "poam" ? `${n}.0` : `${major}.${minor}`,
        publishedAt: new Date(now - daysAgo * DAY - Math.floor(rand() * 9) * HOUR).toISOString(),
        author: s.author,
        note,
        words,
        pages: Math.max(1, Math.round(s.pages * (words / s.words))),
        sizeKb: Math.round((s.kind === "xlsx" ? 38 : 22) * (words / 220) + rand() * 120),
      });
    }
    const title = s.title.replace("October 2026", prev);
    const summary = s.summary.replace("October", prev.split(" ")[0]!);
    return {
      id: s.id,
      title,
      category: s.category,
      kind: s.kind,
      visibility: s.visibility,
      summary,
      practices: s.practices,
      versions,
      source: "workspace",
    };
  });
}

export function seedReviewers(now: number): Reviewer[] {
  const at = (d: number) => new Date(now + d * DAY).toISOString();
  const list: Omit<Reviewer, "id">[] = [
    { kind: "person", name: "Dana Whitfield", handle: "dana.whitfield@ofsa.gov", title: "Information System Security Officer", agencyId: "ofsa", grantedAt: at(-50), grantedBy: "Auto-approval: *.gov", expiresAt: at(40), lastAccessAt: new Date(now - 3 * HOUR).toISOString(), status: "active", channel: "web", scope: "all" },
    { kind: "person", name: "Marcus Oyelaran", handle: "marcus.oyelaran@ofsa.gov", title: "Authorizing Official designated representative", agencyId: "ofsa", grantedAt: at(-120), grantedBy: "Hannah Cole", expiresAt: null, lastAccessAt: at(-2), status: "active", channel: "web", scope: "all" },
    { kind: "system", name: "OFSA continuous monitoring service", handle: "ofsa-conmon-01", agencyId: "ofsa", grantedAt: at(-160), grantedBy: "Seema Abdul", expiresAt: null, lastAccessAt: new Date(now - 25 * MIN).toISOString(), status: "active", channel: "api", scope: "all" },
    { kind: "person", name: "Elena Brandt", handle: "elena.brandt@fwds.gov", title: "Security Analyst", agencyId: "fwds", grantedAt: at(-70), grantedBy: "Auto-approval: *.gov", expiresAt: at(20), lastAccessAt: at(-1), status: "active", channel: "web", scope: "all" },
    { kind: "system", name: "FWDS GRC platform", handle: "fwds-grc-sync", agencyId: "fwds", grantedAt: at(-100), grantedBy: "Hannah Cole", expiresAt: at(265), lastAccessAt: new Date(now - 2 * HOUR).toISOString(), status: "active", channel: "api", scope: "package" },
    { kind: "person", name: "Lena Fischer", handle: "lena.fischer@fwds.gov", title: "Privacy Officer", agencyId: "fwds", grantedAt: at(-85), grantedBy: "Auto-approval: *.gov", expiresAt: at(5), lastAccessAt: at(-9), status: "active", channel: "web", scope: "all" },
    { kind: "person", name: "Grace Kim", handle: "grace.kim@fhro.gov", title: "Program Security Officer", agencyId: "fhro", grantedAt: at(-30), grantedBy: "Auto-approval: *.gov", expiresAt: at(60), lastAccessAt: at(-4), status: "active", channel: "web", scope: "all" },
    { kind: "person", name: "Jordan Ellis", handle: "jordan.ellis@dlro.mil", title: "Cybersecurity Lead", agencyId: "dlro", grantedAt: at(-20), grantedBy: "Auto-approval: *.mil", expiresAt: at(70), lastAccessAt: at(-6), status: "active", channel: "web", scope: "all" },
    { kind: "person", name: "Owen Hartley", handle: "owen.hartley@keystoneassurance.com", title: "Lead Assessor", agencyId: "keystone", grantedAt: at(-20), grantedBy: "Auto-approval: keystoneassurance.com", expiresAt: at(10), lastAccessAt: at(-11), status: "active", channel: "web", scope: "package" },
    { kind: "person", name: "Sofia Marquez", handle: "sofia.marquez@ibx.gov", title: "Security Assessor", agencyId: "ibx", grantedAt: at(-175), grantedBy: "Auto-approval: *.gov", expiresAt: at(-85), lastAccessAt: at(-88), status: "expired", channel: "web", scope: "all" },
    { kind: "person", name: "Ravi Menon", handle: "ravi.menon@dcinfra.gov", title: "ISSO", agencyId: "dci", grantedAt: at(-140), grantedBy: "Auto-approval: *.gov", expiresAt: at(-50), lastAccessAt: at(-34), status: "revoked", channel: "web", scope: "all" },
  ];
  return list.map((r, i) => ({ ...r, id: `rv_${i + 1}` }));
}

export function seedRequests(now: number, reviewers: Reviewer[]): AccessRequest[] {
  const at = (d: number) => new Date(now - d).toISOString();
  const pending: AccessRequest[] = [
    {
      id: "rq_p1",
      name: "Priya Natarajan",
      email: "priya.natarajan@larkspurfed.com",
      organization: "Larkspur Federal Consulting",
      agencyId: "larkspur",
      purpose: "Supporting FHRO's agency review of Workbench. We need the customer responsibility matrix and boundary documents.",
      nda: true,
      submittedAt: at(5 * HOUR),
      status: "pending",
    },
    {
      id: "rq_p2",
      name: "Megan Doyle",
      email: "megan.doyle@harborviewadvisory.com",
      organization: "Harborview Advisory",
      purpose: "Reviewing Workbench for a state agency that is evaluating case management platforms.",
      nda: true,
      submittedAt: at(26 * HOUR),
      status: "pending",
    },
    {
      id: "rq_p3",
      name: "Alan Brooks",
      email: "alan.brooks.consulting@gmail.com",
      organization: "Independent consultant",
      purpose: "Research for a client.",
      nda: true,
      submittedAt: at(2 * DAY + 3 * HOUR),
      status: "pending",
    },
  ];
  const fromReviewers: AccessRequest[] = reviewers
    .filter((r) => r.kind === "person")
    .map((r) => ({
      id: `rq_${r.id}`,
      name: r.name,
      email: r.handle,
      organization: AGENCIES.find((a) => a.id === r.agencyId)?.name ?? r.agencyId,
      agencyId: r.agencyId,
      purpose: r.agencyId === "keystone" ? "Annual assessment evidence review." : "Agency review of the certification package before using Workbench.",
      nda: true,
      submittedAt: new Date(new Date(r.grantedAt).getTime() - (r.grantedBy.startsWith("Auto") ? 2 * MIN : 20 * HOUR)).toISOString(),
      status: "approved",
      decidedAt: r.grantedAt,
      decidedBy: r.grantedBy,
      expiresAt: r.expiresAt,
      auto: r.grantedBy.startsWith("Auto"),
    }));
  const denied: AccessRequest[] = [
    {
      id: "rq_d1",
      name: "Chris Varga",
      email: "chris@vargadigital.net",
      organization: "Varga Digital",
      purpose: "Comparing case management vendors.",
      nda: true,
      submittedAt: at(19 * DAY),
      status: "denied",
      decidedAt: at(18 * DAY),
      decidedBy: "Hannah Cole",
      reason: "Restricted documents are shared with agencies, their assessors and integrators working on an agency review.",
    },
    {
      id: "rq_d2",
      name: "J. Patel",
      email: "jp1984@mailbox-temp.net",
      organization: "Not given",
      purpose: "Need docs",
      nda: false,
      submittedAt: at(41 * DAY),
      status: "denied",
      decidedAt: at(41 * DAY - 3 * HOUR),
      decidedBy: "Luis Ortega",
      reason: "Disposable email address. Please request again with your work email.",
    },
  ];
  return [...pending, ...fromReviewers, ...denied].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function seedRules(now: number): Rule[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  return [
    { id: "rl_1", domain: "*.gov", access: "90d", scope: "all", createdAt: at(230), createdBy: "Seema Abdul", enabled: true, note: "Federal civilian agencies" },
    { id: "rl_2", domain: "*.mil", access: "90d", scope: "all", createdAt: at(230), createdBy: "Seema Abdul", enabled: true, note: "Defense components" },
    { id: "rl_3", domain: "keystoneassurance.com", access: "30d", scope: "package", createdAt: at(205), createdBy: "Hannah Cole", enabled: true, note: "Independent assessor" },
    { id: "rl_4", domain: "larkspurfed.com", access: "90d", scope: "all", createdAt: at(90), createdBy: "Hannah Cole", enabled: false, note: "Integrator; paused, approve case by case" },
  ];
}

const IPS: Record<string, string> = {
  ofsa: "198.51.100.",
  fwds: "203.0.113.",
  fhro: "192.0.2.",
  dlro: "198.51.100.2",
  ibx: "203.0.113.1",
  dci: "192.0.2.1",
  keystone: "198.18.0.",
  larkspur: "198.19.4.",
  other: "192.0.2.20",
};

export function ipFor(agencyId: string, salt: number) {
  const base = IPS[agencyId] ?? "192.0.2.";
  const last = (salt % 200) + 20;
  return base.endsWith(".") ? `${base}${last}` : `${base}${last % 10}`;
}

export function seedLogs(now: number, docs: TrustDocument[], reviewers: Reviewer[]): LogEvent[] {
  const rand = mulberry32(20261113);
  const events: LogEvent[] = [];
  const weights = docs.map((d) => DOC_SPECS.find((s) => s.id === d.id)?.popularity ?? 3);
  const total = weights.reduce((a, b) => a + b, 0);
  const pickDoc = (pool: TrustDocument[]) => {
    let r = rand() * total;
    for (let i = 0; i < docs.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return pool.includes(docs[i]!) ? docs[i]! : pool[Math.floor(rand() * pool.length)]!;
    }
    return pool[0]!;
  };
  let seq = 0;
  const push = (e: Omit<LogEvent, "id">) => events.push({ ...e, id: `ev_${++seq}` });

  for (let d = 182; d >= 0; d--) {
    const dayStart = now - d * DAY;
    const dow = new Date(dayStart).getDay();
    const weekend = dow === 0 || dow === 6;
    for (const r of reviewers) {
      const g = new Date(r.grantedAt).getTime();
      const end = r.status === "revoked" ? now - 34 * DAY : r.expiresAt ? Math.min(new Date(r.expiresAt).getTime(), now) : now;
      if (dayStart < g || dayStart > end) continue;
      const pool = r.scope === "package" ? docs.filter((x) => x.category === "package") : docs;
      if (r.kind === "system") {
        // Systems poll the package daily and fetch changed documents.
        const t = dayStart - (d === 0 ? 25 * MIN : Math.floor(rand() * 6) * HOUR + 3 * HOUR);
        if (t > now) continue;
        push({ at: new Date(t).toISOString(), actor: r.name, handle: r.handle, actorKind: "system", agencyId: r.agencyId, target: "Certification Package Overview (JSON)", action: "api_fetch", channel: "api", ip: ipFor(r.agencyId, 7) });
        if (rand() < 0.35) {
          const doc = pickDoc(pool);
          push({ at: new Date(t + 40_000).toISOString(), actor: r.name, handle: r.handle, actorKind: "system", agencyId: r.agencyId, docId: doc.id, target: doc.title, action: "api_fetch", channel: "api", ip: ipFor(r.agencyId, 7) });
        }
        continue;
      }
      const chance = weekend ? 0.05 : 0.17;
      if (rand() > chance) continue;
      const startT = dayStart - Math.floor(rand() * 8 * HOUR) - 2 * HOUR;
      if (startT > now) continue;
      const ip = ipFor(r.agencyId, Math.floor(rand() * 999));
      push({ at: new Date(startT).toISOString(), actor: r.name, handle: r.handle, actorKind: "person", agencyId: r.agencyId, target: "Signed in with email link", action: "sign_in", channel: "web", ip });
      const n = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const doc = pickDoc(pool);
        const t = startT + (k + 1) * (2 + Math.floor(rand() * 9)) * MIN;
        const action: LogAction = rand() < 0.55 ? "view" : rand() < 0.93 ? "download" : "download_all";
        push({
          at: new Date(t).toISOString(),
          actor: r.name,
          handle: r.handle,
          actorKind: "person",
          agencyId: r.agencyId,
          docId: action === "download_all" ? undefined : doc.id,
          target: action === "download_all" ? "All restricted documents (ZIP)" : doc.title,
          action,
          channel: "web",
          ip,
        });
      }
    }
  }
  // Recent session for the default reviewer so "Your access history" is populated.
  const dana = reviewers[0]!;
  const t0 = now - 3 * HOUR;
  push({ at: new Date(t0).toISOString(), actor: dana.name, handle: dana.handle, actorKind: "person", agencyId: "ofsa", target: "Signed in with email link", action: "sign_in", channel: "web", ip: "198.51.100.42" });
  const poam = docs.find((x) => x.id === "poam")!;
  push({ at: new Date(t0 + 4 * MIN).toISOString(), actor: dana.name, handle: dana.handle, actorKind: "person", agencyId: "ofsa", docId: poam.id, target: poam.title, action: "download", channel: "web", ip: "198.51.100.42" });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

export function seedApiKeys(now: number): ApiKey[] {
  const at = (d: number) => new Date(now + d * DAY).toISOString();
  return [
    { id: "key_1", name: "OFSA continuous monitoring", agencyId: "ofsa", prefix: "skt_live_", last4: "3f9a", scopes: ["package:read", "documents:read", "logs:read:own"], createdAt: at(-160), createdBy: "Seema Abdul", lastUsedAt: new Date(now - 25 * MIN).toISOString(), expiresAt: null, status: "active" },
    { id: "key_2", name: "FWDS GRC sync", agencyId: "fwds", prefix: "skt_live_", last4: "b71c", scopes: ["package:read", "documents:read"], createdAt: at(-100), createdBy: "Hannah Cole", lastUsedAt: new Date(now - 2 * HOUR).toISOString(), expiresAt: at(265), status: "active" },
  ];
}

export function seedSnapshots(now: number, docs: TrustDocument[]): Snapshot[] {
  const list: Omit<Snapshot, "id" | "checksum" | "documents">[] = [];
  for (let k = 0; k < 6; k++) {
    const d = startOfMonth(subMonths(new Date(now), k));
    d.setHours(2, 0, 0, 0);
    if (d.getTime() > now) continue;
    list.push({ createdAt: d.toISOString(), label: `Monthly snapshot, ${format(d, "MMMM yyyy")}`, trigger: "scheduled", sizeMb: 0, by: "Scheduled" });
  }
  list.push({ createdAt: new Date(now - 44 * DAY + 2 * HOUR).toISOString(), label: "Published the 2026 Independent Assessment Report", trigger: "publish", sizeMb: 0, by: "Hannah Cole" });
  list.push({ createdAt: new Date(now - 26 * DAY + 3 * HOUR).toISOString(), label: "Published SCN-0142 notification", trigger: "publish", sizeMb: 0, by: "Hannah Cole" });
  return list
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((s, i) => {
      const count = docs.filter((x) => x.versions.some((v) => v.publishedAt <= s.createdAt)).length;
      return { ...s, id: `snap_${i + 1}`, documents: count, sizeMb: Math.round((180 + count * 7.4) * 10) / 10, checksum: fakeHash(s.createdAt) };
    });
}

export function seedTenants(now: number, docs: TrustDocument[], reviewers: Reviewer[]): Tenant[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const latest = docs.flatMap((d) => d.versions.map((v) => v.publishedAt)).sort().at(-1) ?? at(9);
  return [
    { id: "tn_northwind", slug: "northwind", name: "Northwind Cloud", product: "Northwind Workbench", domain: "trust.northwindcloud.com", domainStatus: "verified", plan: "Federal", status: "live", lastPublishAt: latest, documents: docs.length, reviewers: reviewers.filter((r) => r.status === "active").length, frameworks: ["FedRAMP 20x Class C", "SOC 2", "ISO 27001"], accent: "#0e6b5c", owner: "Seema Abdul", createdAt: at(232) },
    { id: "tn_halcyon", slug: "halcyon", name: "Halcyon Analytics", product: "Halcyon Insight", domain: "trust.halcyonanalytics.com", domainStatus: "verified", plan: "Federal", status: "live", lastPublishAt: at(3), documents: 19, reviewers: 6, frameworks: ["FedRAMP 20x Class B", "SOC 2"], accent: "#6b3fa0", owner: "Seema Abdul", createdAt: at(160) },
    { id: "tn_copperline", slug: "copperline", name: "Copperline Data", product: "Copperline Vault", domain: "trust.copperlinedata.com", domainStatus: "verified", plan: "Standard", status: "live", lastPublishAt: at(17), documents: 14, reviewers: 23, frameworks: ["SOC 2", "ISO 27001", "HIPAA"], accent: "#a5482a", owner: "Seema Abdul", createdAt: at(300) },
    { id: "tn_ridgeway", slug: "ridgeway", name: "Ridgeway Health Systems", product: "Ridgeway Care Exchange", domain: "trust.ridgewayhealth.com", domainStatus: "pending", plan: "Standard", status: "setup", lastPublishAt: null, documents: 6, reviewers: 0, frameworks: ["SOC 2", "HIPAA"], accent: "#1d5fa8", owner: "Seema Abdul", createdAt: at(8) },
    { id: "tn_bluefin", slug: "bluefin", name: "Bluefin Records", product: "Bluefin Archive", domain: "bluefin.trust.secureknots.com", domainStatus: "none", plan: "Federal", status: "draft", lastPublishAt: null, documents: 0, reviewers: 0, frameworks: ["FedRAMP 20x Class C (in assessment)"], accent: "#225e7a", owner: "Seema Abdul", createdAt: at(21) },
  ];
}

export function seedAdmins(now: number): ClientAdmin[] {
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  return [
    { id: "ad_1", name: "Seema Abdul", email: "seema@secureknots.com", role: "Owner", org: "SecureKnots", lastActiveAt: ago(0), mfa: true },
    { id: "ad_2", name: "Hannah Cole", email: "hannah.cole@northwindcloud.com", role: "Admin", org: "Northwind Cloud", lastActiveAt: ago(5), mfa: true },
    { id: "ad_3", name: "Luis Ortega", email: "luis.ortega@northwindcloud.com", role: "Admin", org: "Northwind Cloud", lastActiveAt: ago(30), mfa: true },
    { id: "ad_4", name: "Mei Tanaka", email: "mei.tanaka@northwindcloud.com", role: "Viewer", org: "Northwind Cloud", lastActiveAt: ago(170), mfa: true },
  ];
}

export function seedNotices(now: number): Notice[] {
  const ago = (m: number) => new Date(now - m * MIN).toISOString();
  return [
    { id: "nt_1", at: ago(300), kind: "request", title: "New access request", body: "Priya Natarajan, Larkspur Federal Consulting", href: "/admin/access" },
    { id: "nt_2", at: ago(120), kind: "json", title: "Package JSON validated", body: "Revision 41 passed schema validation", href: "/admin/machine-readable" },
    { id: "nt_3", at: ago(1560), kind: "request", title: "New access request", body: "Megan Doyle, Harborview Advisory", href: "/admin/access" },
    { id: "nt_4", at: ago(2200), kind: "expiry", title: "Access expires in 5 days", body: "Lena Fischer, FWDS", href: "/admin/access?tab=inventory" },
    { id: "nt_5", at: ago(9 * 1440), kind: "upload", title: "Document published", body: "KSI Validation Summary v3.0", href: "/admin/documents/ksi-validation-summary" },
  ];
}

export function seedDomain(): DomainState {
  return { host: "trust.northwindcloud.com", status: "verified", verifiedAt: undefined, target: "northwind.edge.secureknots.com", draftHost: "", draftStep: 0 };
}
