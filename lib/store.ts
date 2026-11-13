"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { format, subMonths } from "date-fns";
import type {
  AccessLength,
  AccessRequest,
  ApiKey,
  AuditEntry,
  ClientAdmin,
  DocCategory,
  DomainState,
  Faq,
  FileKind,
  Incident,
  Integration,
  KsiMetric,
  NdaRecord,
  StandardQuestionnaire,
  LogEvent,
  Notice,
  PackageState,
  PublicQuestion,
  Questionnaire,
  Reviewer,
  Rule,
  Snapshot,
  StatusComponent,
  Subprocessor,
  Subscriber,
  Tenant,
  Topic,
  TrustDocument,
  Update,
  Visibility,
  Webhook,
} from "@/lib/types";
import { AGENCIES } from "@/lib/mock/catalog";
import { buildPackageJson, docsAsOf } from "@/lib/mock/package";
import {
  ipFor,
  seedAdmins,
  seedApiKeys,
  seedDocuments,
  seedDomain,
  seedLogs,
  seedNotices,
  seedProfile,
  seedRequests,
  seedReviewers,
  seedRules,
  seedSnapshots,
  seedTenants,
  type TenantProfile,
} from "@/lib/mock/seed";
import {
  seedAudit,
  seedFaqs,
  seedIntegrations,
  seedPublicQuestions,
  seedQuestionnaires,
  seedStatus,
  seedSubprocessors,
  seedSubscribers,
  seedUpdates,
  seedWebhooks,
} from "@/lib/mock/seed-extra";
import { NDA_VERSION, seedKsi, seedNdaRecords, seedStandardQuestionnaires } from "@/lib/mock/seed-v3";
import { DAY, HOUR, MIN, domainMatches, emailDomain, fakeHash, uid } from "@/lib/utils";

export type Branding = { accent: string; logo: string | null; displayName: string };
export type Security = { mfaRequired: boolean; sessionTimeout: number; linkExpiry: number; ndaRequired: boolean; watermark: boolean; ndaVersion: string };
export type Session = { reviewerEmail: string; adminSignedIn: boolean; watchlist: string[] };

type Data = {
  seededAt: string;
  profile: TenantProfile;
  documents: TrustDocument[];
  requests: AccessRequest[];
  reviewers: Reviewer[];
  rules: Rule[];
  logs: LogEvent[];
  apiKeys: ApiKey[];
  snapshots: Snapshot[];
  pkg: PackageState;
  domain: DomainState;
  branding: Branding;
  security: Security;
  admins: ClientAdmin[];
  tenants: Tenant[];
  notices: Notice[];
  noticesReadAt: string;
  session: Session;
  /* v2 */
  faqs: Faq[];
  publicQuestions: PublicQuestion[];
  questionnaires: Questionnaire[];
  updates: Update[];
  subscribers: Subscriber[];
  subprocessors: Subprocessor[];
  components: StatusComponent[];
  incidents: Incident[];
  integrations: Integration[];
  webhooks: Webhook[];
  audit: AuditEntry[];
  /* v3 */
  ndaRecords: NdaRecord[];
  ksi: KsiMetric[];
  standardQuestionnaires: StandardQuestionnaire[];
};

/** Keys of list slices whose items have an id; usable with upsert/remove. */
export type ListKey = {
  [K in keyof Data]: Data[K] extends { id: string }[] ? K : never;
}[keyof Data];
type ItemOf<K extends ListKey> = Data[K] extends (infer T)[] ? T : never;

export type UploadInput = {
  title: string;
  summary: string;
  category: DocCategory;
  kind: FileKind;
  version: string;
  date: string;
  visibility: Visibility;
  practices: string[];
  words: number;
  sizeKb: number;
};

type Actions = {
  reset: () => void;
  patch: (p: Partial<Data>) => void;
  /** Insert or replace an item by id in any list slice. New items go first unless `append`. */
  upsert: <K extends ListKey>(key: K, item: ItemOf<K>, opts?: { append?: boolean }) => void;
  remove: <K extends ListKey>(key: K, id: string) => void;
  addAudit: (e: Omit<AuditEntry, "id" | "at" | "ip" | "actor"> & { actor?: string }) => void;
  submitRequest: (input: { name: string; email: string; organization: string; purpose: string; nda: boolean; docIds?: string[]; signature?: string }) => AccessRequest;
  approveRequest: (id: string, length: AccessLength) => void;
  denyRequest: (id: string, reason: string) => void;
  addRule: (r: Omit<Rule, "id" | "createdAt" | "createdBy">) => void;
  updateRule: (id: string, p: Partial<Rule>) => void;
  removeRule: (id: string) => void;
  revokeReviewer: (id: string) => void;
  extendReviewer: (id: string, length: AccessLength) => void;
  logEvent: (e: Omit<LogEvent, "id" | "at" | "ip"> & { at?: string }) => void;
  uploadDocument: (input: UploadInput) => TrustDocument;
  addVersion: (docId: string, v: { version: string; note: string; date: string; words: number; sizeKb: number }) => void;
  setVisibility: (ids: string[], v: Visibility) => void;
  regeneratePackage: () => void;
  createApiKey: (k: { name: string; agencyId: string; scopes: string[]; expiry: AccessLength }) => string;
  revokeApiKey: (id: string) => void;
  takeSnapshot: (label?: string) => void;
  restoreSnapshot: (id: string) => void;
  setBranding: (b: Partial<Branding>) => void;
  setDomainDraft: (p: Partial<Pick<DomainState, "draftHost" | "draftStep">>) => void;
  verifyDomain: () => void;
  setSecurity: (s: Partial<Security>) => void;
  inviteAdmin: (a: { name: string; email: string; role: ClientAdmin["role"] }) => void;
  removeAdmin: (id: string) => void;
  createTenant: (t: Omit<Tenant, "id" | "createdAt" | "documents" | "reviewers" | "lastPublishAt" | "owner">) => void;
  markNoticesRead: () => void;
  setReviewer: (email: string) => void;
  setAdminSignedIn: (v: boolean) => void;
  /* v2 */
  subscribe: (s: { email: string; organization: string; topics: Topic[]; source: Subscriber["source"]; name?: string }) => Subscriber;
  askQuestion: (q: { question: string; name: string; email: string; organization: string }) => PublicQuestion;
  publishUpdate: (u: Omit<Update, "id" | "recipients" | "opens" | "author"> & { id?: string }) => Update;
  toggleWatch: (docId: string) => void;
  /* v3 */
  revalidateKsi: () => void;
};

export type TrustStore = Data & Actions;

export const ADMIN_NAME = "Seema Abdul";

export function lengthToExpiry(length: AccessLength, from = Date.now()): string | null {
  if (length === "continuing") return null;
  const days = length === "30d" ? 30 : length === "90d" ? 90 : 365;
  return new Date(from + days * DAY).toISOString();
}

export const LENGTH_LABEL: Record<AccessLength, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
  continuing: "Continuing access",
};

export const TOPIC_LABEL: Record<Topic, string> = {
  documents: "Document updates",
  changes: "Significant changes",
  incidents: "Incidents and maintenance",
  subprocessors: "Subprocessor changes",
};

function seed(): Data {
  const now = Date.now();
  const profile = seedProfile(now);
  const documents = seedDocuments(now);
  const reviewers = seedReviewers(now);
  const requests = seedRequests(now, reviewers);
  const snapshots = seedSnapshots(now, documents);
  const domain = seedDomain();
  domain.verifiedAt = new Date(now - 228 * DAY).toISOString();
  const generatedAt = new Date(now - 2 * HOUR).toISOString();
  const lastSnap = snapshots[0]!;
  const published = buildPackageJson({ profile, docs: documents, host: domain.host, generatedAt, revision: 41 });
  const baseline = buildPackageJson({
    profile,
    docs: docsAsOf(documents, lastSnap.createdAt),
    host: domain.host,
    generatedAt: lastSnap.createdAt,
    revision: 38,
  });
  const status = seedStatus(now);
  return {
    seededAt: new Date(now).toISOString(),
    profile,
    documents,
    requests,
    reviewers,
    rules: seedRules(now),
    logs: seedLogs(now, documents, reviewers),
    apiKeys: seedApiKeys(now),
    snapshots,
    pkg: { generatedAt, revision: 41, status: "valid", published, baseline, baselineLabel: lastSnap.label },
    domain,
    branding: { accent: "#0e6b5c", logo: null, displayName: "Northwind Cloud" },
    security: { mfaRequired: true, sessionTimeout: 30, linkExpiry: 15, ndaRequired: true, watermark: true, ndaVersion: NDA_VERSION },
    admins: seedAdmins(now),
    tenants: seedTenants(now, documents, reviewers),
    notices: seedNotices(now),
    noticesReadAt: new Date(now - 6 * HOUR).toISOString(),
    session: { reviewerEmail: "dana.whitfield@ofsa.gov", adminSignedIn: true, watchlist: ["poam", "conmon-report"] },
    faqs: seedFaqs(now),
    publicQuestions: seedPublicQuestions(now),
    questionnaires: seedQuestionnaires(now),
    updates: seedUpdates(now, format(subMonths(new Date(now), 1), "MMMM yyyy")),
    subscribers: seedSubscribers(now),
    subprocessors: seedSubprocessors(now),
    components: status.components,
    incidents: status.incidents,
    integrations: seedIntegrations(now),
    webhooks: seedWebhooks(now),
    audit: seedAudit(now),
    ndaRecords: seedNdaRecords(now, requests),
    ksi: seedKsi(now),
    standardQuestionnaires: seedStandardQuestionnaires(now),
  };
}

export function agencyFor(email: string) {
  const d = emailDomain(email);
  return AGENCIES.find((a) => a.domain && (d === a.domain || d.endsWith(`.${a.domain}`)));
}

export function matchRule(rules: Rule[], email: string) {
  const d = emailDomain(email);
  if (!d) return undefined;
  return rules.find((r) => r.enabled && domainMatches(r.domain, d));
}

export function effectiveStatus(r: Reviewer): Reviewer["status"] {
  if (r.status === "active" && r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()) return "expired";
  return r.status;
}

const notice = (n: Omit<Notice, "id" | "at">): Notice => ({ ...n, id: uid("nt"), at: new Date().toISOString() });

const auditEntry = (e: Omit<AuditEntry, "id" | "at" | "ip" | "actor"> & { actor?: string }): AuditEntry => ({
  actor: ADMIN_NAME,
  ...e,
  id: uid("au"),
  at: new Date().toISOString(),
  ip: e.actor === "System" ? "internal" : "198.51.100.24",
});

export const useTrust = create<TrustStore>()(
  persist(
    (set, get) => {
      /** Adds an audit trail entry to the same state update. */
      const withAudit = (e: Parameters<typeof auditEntry>[0]) => ({ audit: [auditEntry(e), ...get().audit] });

      return {
        ...seed(),

        reset: () => set({ ...seed() }),
        patch: (p) => set(p),

        upsert: (key, item, opts) =>
          set((s) => {
            const list = s[key] as unknown as { id: string }[];
            const it = item as unknown as { id: string };
            const exists = list.some((x) => x.id === it.id);
            const next = exists ? list.map((x) => (x.id === it.id ? it : x)) : opts?.append ? [...list, it] : [it, ...list];
            return { [key]: next } as Partial<Data>;
          }),
        remove: (key, id) =>
          set((s) => ({ [key]: (s[key] as unknown as { id: string }[]).filter((x) => x.id !== id) }) as Partial<Data>),
        addAudit: (e) => set(() => withAudit(e)),

        submitRequest: (input) => {
          const s = get();
          const now = Date.now();
          const rule = matchRule(s.rules, input.email);
          const agency = agencyFor(input.email);
          const req: AccessRequest = {
            id: uid("rq"),
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            organization: input.organization.trim(),
            agencyId: agency?.id,
            purpose: input.purpose.trim(),
            nda: input.nda,
            docIds: input.docIds?.length ? input.docIds : undefined,
            submittedAt: new Date(now).toISOString(),
            status: rule ? "approved" : "pending",
            ...(rule
              ? { auto: true, decidedAt: new Date(now).toISOString(), decidedBy: `Auto-approval: ${rule.domain}`, expiresAt: lengthToExpiry(rule.access, now) }
              : {}),
          };
          const reviewers = rule ? upsertReviewer(s.reviewers, req, rule.access, `Auto-approval: ${rule.domain}`, rule.scope) : s.reviewers;
          const nda: NdaRecord | null = input.nda
            ? {
                id: uid("nda"),
                name: req.name,
                email: req.email,
                organization: req.organization,
                signature: (input.signature ?? req.name).trim(),
                signedAt: req.submittedAt,
                version: s.security.ndaVersion,
                ip: "198.51.100.77",
                requestId: req.id,
                status: "active",
              }
            : null;
          set({
            requests: [req, ...s.requests],
            reviewers,
            ndaRecords: nda ? [nda, ...s.ndaRecords.map((n) => (n.email === nda.email ? { ...n, status: "superseded" as const } : n))] : s.ndaRecords,
            notices: [
              notice(
                rule
                  ? { kind: "approval", title: "Access approved automatically", body: `${req.name}, ${req.organization} (rule ${rule.domain})`, href: "/admin/access?status=approved" }
                  : { kind: "request", title: "New access request", body: `${req.name}, ${req.organization}`, href: "/admin/access" },
              ),
              ...s.notices,
            ],
            ...(rule ? withAudit({ actor: "System", action: "Approved request automatically", target: `${req.name} (${req.organization})`, detail: `Rule ${rule.domain}`, category: "access" }) : {}),
          });
          return req;
        },

        approveRequest: (id, length) => {
          const s = get();
          const req = s.requests.find((r) => r.id === id);
          if (!req) return;
          const now = Date.now();
          const updated: AccessRequest = { ...req, status: "approved", decidedAt: new Date(now).toISOString(), decidedBy: ADMIN_NAME, expiresAt: lengthToExpiry(length, now), reason: undefined };
          set({
            requests: s.requests.map((r) => (r.id === id ? updated : r)),
            reviewers: upsertReviewer(s.reviewers, updated, length, ADMIN_NAME, "all"),
            ...withAudit({ action: "Approved request", target: `${req.name} (${req.organization})`, detail: LENGTH_LABEL[length], category: "access" }),
          });
        },

        denyRequest: (id, reason) => {
          const s = get();
          const req = s.requests.find((r) => r.id === id);
          set({
            requests: s.requests.map((r) =>
              r.id === id ? { ...r, status: "denied", decidedAt: new Date().toISOString(), decidedBy: ADMIN_NAME, reason, expiresAt: undefined } : r,
            ),
            ...withAudit({ action: "Denied request", target: req ? `${req.name} (${req.organization})` : id, detail: reason, category: "access" }),
          });
        },

        addRule: (r) =>
          set((s) => ({
            rules: [{ ...r, id: uid("rl"), createdAt: new Date().toISOString(), createdBy: ADMIN_NAME }, ...s.rules],
            ...withAudit({ action: "Added rule", target: r.domain, detail: LENGTH_LABEL[r.access], category: "access" }),
          })),
        updateRule: (id, p) =>
          set((s) => {
            const rule = s.rules.find((r) => r.id === id);
            return {
              rules: s.rules.map((r) => (r.id === id ? { ...r, ...p } : r)),
              ...withAudit({ action: "Updated rule", target: rule?.domain ?? id, detail: p.enabled === undefined ? "Edited" : p.enabled ? "Enabled automatic approval" : "Paused automatic approval", category: "access" }),
            };
          }),
        removeRule: (id) =>
          set((s) => ({
            rules: s.rules.filter((r) => r.id !== id),
            ...withAudit({ action: "Removed rule", target: s.rules.find((r) => r.id === id)?.domain ?? id, category: "access" }),
          })),

        revokeReviewer: (id) =>
          set((s) => {
            const r = s.reviewers.find((x) => x.id === id);
            return {
              reviewers: s.reviewers.map((x) => (x.id === id ? { ...x, status: "revoked" } : x)),
              ...withAudit({ action: "Revoked reviewer", target: r ? r.name : id, category: "access" }),
            };
          }),
        extendReviewer: (id, length) =>
          set((s) => {
            const r = s.reviewers.find((x) => x.id === id);
            return {
              reviewers: s.reviewers.map((x) => (x.id === id ? { ...x, status: "active", expiresAt: lengthToExpiry(length) } : x)),
              ...withAudit({ action: "Extended access", target: r ? r.name : id, detail: LENGTH_LABEL[length], category: "access" }),
            };
          }),

        logEvent: (e) =>
          set((s) => {
            const ev: LogEvent = { ...e, id: uid("ev"), at: e.at ?? new Date().toISOString(), ip: ipFor(e.agencyId, 42) };
            return {
              logs: [ev, ...s.logs],
              reviewers: s.reviewers.map((r) => (r.handle === e.handle ? { ...r, lastAccessAt: ev.at } : r)),
            };
          }),

        uploadDocument: (input) => {
          const s = get();
          let id = input.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            .slice(0, 48);
          if (!id || s.documents.some((d) => d.id === id)) id = `${id || "document"}-${Math.random().toString(36).slice(2, 6)}`;
          const doc: TrustDocument = {
            id,
            title: input.title.trim(),
            category: input.category,
            kind: input.kind,
            visibility: input.visibility,
            summary: input.summary.trim(),
            practices: input.practices,
            source: "upload",
            versions: [
              {
                version: input.version,
                publishedAt: input.date,
                author: ADMIN_NAME,
                note: "First published version",
                words: input.words,
                pages: Math.max(1, Math.round(input.words / 330)),
                sizeKb: input.sizeKb,
              },
            ],
          };
          set({
            documents: [doc, ...s.documents],
            pkg: { ...s.pkg, status: "stale" },
            tenants: s.tenants.map((t) => (t.slug === "northwind" ? { ...t, documents: s.documents.length + 1, lastPublishAt: new Date().toISOString() } : t)),
            notices: [notice({ kind: "upload", title: "Document published", body: `${doc.title} v${input.version}`, href: `/admin/documents/${doc.id}` }), ...s.notices],
            ...withAudit({ action: "Published document", target: `${doc.title} v${input.version}`, detail: input.visibility === "public" ? "Public" : "Restricted", category: "documents" }),
          });
          return doc;
        },

        addVersion: (docId, v) =>
          set((s) => ({
            documents: s.documents.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    versions: [
                      { version: v.version, publishedAt: v.date, author: ADMIN_NAME, note: v.note, words: v.words, pages: Math.max(1, Math.round(v.words / 330)), sizeKb: v.sizeKb },
                      ...d.versions,
                    ],
                  }
                : d,
            ),
            pkg: { ...s.pkg, status: "stale" },
            ...withAudit({ action: "Published version", target: `${s.documents.find((d) => d.id === docId)?.title ?? docId} v${v.version}`, detail: v.note, category: "documents" }),
          })),

        setVisibility: (ids, v) =>
          set((s) => ({
            documents: s.documents.map((d) => (ids.includes(d.id) ? { ...d, visibility: v } : d)),
            pkg: { ...s.pkg, status: "stale" },
            ...withAudit({ action: v === "public" ? "Made public" : "Made restricted", target: ids.length === 1 ? (s.documents.find((d) => d.id === ids[0])?.title ?? ids[0]!) : `${ids.length} documents`, category: "documents" }),
          })),

        regeneratePackage: () => {
          const s = get();
          const generatedAt = new Date().toISOString();
          const revision = s.pkg.revision + 1;
          set({
            pkg: {
              ...s.pkg,
              generatedAt,
              revision,
              status: "valid",
              published: buildPackageJson({ profile: s.profile, docs: s.documents, host: s.domain.host, generatedAt, revision }),
            },
            notices: [notice({ kind: "json", title: "Package JSON validated", body: `Revision ${revision} passed schema validation`, href: "/admin/machine-readable" }), ...s.notices],
            ...withAudit({ action: "Regenerated package JSON", target: `Revision ${revision}`, detail: "Validation passed (9 checks)", category: "package" }),
          });
        },

        createApiKey: (k) => {
          const secret = `skt_live_${fakeHash(`${k.name}${Date.now()}`, 32)}`;
          set((s) => ({
            apiKeys: [
              {
                id: uid("key"),
                name: k.name.trim(),
                agencyId: k.agencyId,
                prefix: "skt_live_",
                last4: secret.slice(-4),
                scopes: k.scopes,
                createdAt: new Date().toISOString(),
                createdBy: ADMIN_NAME,
                expiresAt: lengthToExpiry(k.expiry),
                status: "active",
              },
              ...s.apiKeys,
            ],
            ...withAudit({ action: "Created API key", target: k.name.trim(), detail: k.scopes.join(", "), category: "keys" }),
          }));
          return secret;
        },
        revokeApiKey: (id) =>
          set((s) => ({
            apiKeys: s.apiKeys.map((k) => (k.id === id ? { ...k, status: "revoked" } : k)),
            ...withAudit({ action: "Revoked API key", target: s.apiKeys.find((k) => k.id === id)?.name ?? id, category: "keys" }),
          })),

        takeSnapshot: (label) => {
          const s = get();
          const createdAt = new Date().toISOString();
          const snap: Snapshot = {
            id: uid("snap"),
            createdAt,
            label: label ?? "Manual snapshot",
            trigger: label?.startsWith("Before restore") ? "restore" : "manual",
            documents: s.documents.length,
            sizeMb: Math.round((180 + s.documents.length * 7.4) * 10) / 10,
            checksum: fakeHash(createdAt),
            by: ADMIN_NAME,
          };
          set({
            snapshots: [snap, ...s.snapshots],
            pkg: { ...s.pkg, baseline: s.pkg.published, baselineLabel: snap.label },
            ...withAudit({ action: "Took snapshot", target: snap.label, category: "package" }),
          });
        },

        restoreSnapshot: (id) => {
          const s = get();
          const target = s.snapshots.find((x) => x.id === id);
          if (!target) return;
          get().takeSnapshot(`Before restore to ${target.label}`);
          set(() => withAudit({ action: "Queued restore", target: target.label, category: "package" }));
        },

        setBranding: (b) =>
          set((s) => ({
            branding: { ...s.branding, ...b },
            ...withAudit({ action: "Updated branding", target: "Trust page", detail: Object.keys(b).join(", "), category: "settings" }),
          })),

        setDomainDraft: (p) => set((s) => ({ domain: { ...s.domain, ...p } })),
        verifyDomain: () =>
          set((s) => {
            const host = s.domain.draftHost || s.domain.host;
            const at = new Date().toISOString();
            return {
              domain: { ...s.domain, host, status: "verified", verifiedAt: at, draftStep: 3 },
              tenants: s.tenants.map((t) => (t.slug === "northwind" ? { ...t, domain: host, domainStatus: "verified" } : t)),
              pkg: { ...s.pkg, status: "stale" },
              notices: [notice({ kind: "domain", title: "Domain verified", body: `${host} now serves the trust center with TLS`, href: "/admin/settings#domain" }), ...s.notices],
              ...withAudit({ action: "Verified domain", target: host, detail: "TLS certificate issued", category: "settings" }),
            };
          }),

        setSecurity: (p) =>
          set((s) => ({
            security: { ...s.security, ...p },
            ...withAudit({ action: "Changed security setting", target: Object.keys(p).join(", "), detail: Object.values(p).map(String).join(", "), category: "settings" }),
          })),
        inviteAdmin: (a) =>
          set((s) => ({
            admins: [...s.admins, { ...a, id: uid("ad"), org: a.email.endsWith("@secureknots.com") ? "SecureKnots" : "Northwind Cloud", mfa: false, invited: true }],
            ...withAudit({ action: "Invited admin", target: a.email, detail: a.role, category: "settings" }),
          })),
        removeAdmin: (id) =>
          set((s) => ({
            admins: s.admins.filter((a) => a.id !== id),
            ...withAudit({ action: "Removed admin", target: s.admins.find((a) => a.id === id)?.email ?? id, category: "settings" }),
          })),

        createTenant: (t) =>
          set((s) => ({
            tenants: [...s.tenants, { ...t, id: uid("tn"), createdAt: new Date().toISOString(), documents: 0, reviewers: 0, lastPublishAt: null, owner: ADMIN_NAME }],
            ...withAudit({ action: "Created trust center", target: t.name, detail: t.plan, category: "settings" }),
          })),

        markNoticesRead: () => set({ noticesReadAt: new Date().toISOString() }),
        setReviewer: (email) => set((s) => ({ session: { ...s.session, reviewerEmail: email.toLowerCase() } })),
        setAdminSignedIn: (v) =>
          set((s) => ({
            session: { ...s.session, adminSignedIn: v },
            ...withAudit({ action: v ? "Signed in" : "Signed out", target: "Admin console", detail: v ? "MFA verified" : undefined, category: "sign-in" }),
          })),

        subscribe: (input) => {
          const s = get();
          const existing = s.subscribers.find((x) => x.email.toLowerCase() === input.email.toLowerCase());
          const sub: Subscriber = {
            id: existing?.id ?? uid("sub"),
            email: input.email.trim().toLowerCase(),
            name: input.name,
            organization: input.organization.trim() || "Not given",
            topics: input.topics,
            at: new Date().toISOString(),
            status: input.source === "reviewer portal" || existing?.status === "confirmed" ? "confirmed" : "pending",
            source: input.source,
          };
          set({ subscribers: existing ? s.subscribers.map((x) => (x.id === sub.id ? sub : x)) : [sub, ...s.subscribers] });
          return sub;
        },

        askQuestion: (q) => {
          const pq: PublicQuestion = { ...q, id: uid("pq"), askedAt: new Date().toISOString(), status: "open" };
          set((s) => ({
            publicQuestions: [pq, ...s.publicQuestions],
            notices: [notice({ kind: "request", title: "New question from the trust page", body: `${q.name}, ${q.organization}`, href: "/admin/questionnaires?tab=inbox" }), ...s.notices],
          }));
          return pq;
        },

        publishUpdate: (u) => {
          const s = get();
          const topic: Topic = u.kind === "incident" || u.kind === "maintenance" ? "incidents" : u.kind === "scn" ? "changes" : u.kind === "subprocessor" ? "subprocessors" : "documents";
          const recipients =
            u.status === "published"
              ? s.subscribers.filter((x) => x.status === "confirmed" && x.topics.includes(topic) && (u.audience === "public" || s.reviewers.some((r) => r.handle === x.email))).length
              : 0;
          const update: Update = { ...u, id: u.id ?? uid("up"), recipients, opens: 0, author: ADMIN_NAME };
          const exists = s.updates.some((x) => x.id === update.id);
          set({
            updates: exists ? s.updates.map((x) => (x.id === update.id ? update : x)) : [update, ...s.updates],
            ...withAudit({
              action: u.status === "published" ? "Published notice" : u.status === "scheduled" ? "Scheduled notice" : "Saved draft notice",
              target: u.title,
              detail: u.status === "published" ? `${recipients} recipients` : undefined,
              category: "updates",
            }),
          });
          return update;
        },

        revalidateKsi: () =>
          set((s) => ({
            ksi: s.ksi.map((k) => ({ ...k, passing: k.checks, lastValidated: new Date().toISOString(), trend: [...k.trend.slice(1), 100] })),
            ...withAudit({ actor: "System", action: "Ran KSI validation", target: `${s.ksi.reduce((a, k) => a + k.checks, 0)} checks`, detail: "All passing", category: "package" }),
          })),

        toggleWatch: (docId) =>
          set((s) => ({
            session: {
              ...s.session,
              watchlist: s.session.watchlist.includes(docId) ? s.session.watchlist.filter((d) => d !== docId) : [...s.session.watchlist, docId],
            },
          })),
      };
    },
    {
      name: "secureknots-trust-demo",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Older saved demo data has a different shape: start again from the seed.
      migrate: () => seed() as unknown as TrustStore,
      partialize: (s) => {
        const data: Partial<TrustStore> = { ...s };
        for (const k of Object.keys(data) as (keyof TrustStore)[]) {
          if (typeof data[k] === "function") delete data[k];
        }
        return data as Data;
      },
    },
  ),
);

function upsertReviewer(list: Reviewer[], req: AccessRequest, length: AccessLength, by: string, scope: Reviewer["scope"]): Reviewer[] {
  const now = Date.now();
  const existing = list.find((r) => r.handle === req.email);
  const base: Reviewer = {
    id: existing?.id ?? uid("rv"),
    kind: "person",
    name: req.name,
    handle: req.email,
    title: existing?.title,
    agencyId: req.agencyId ?? "other",
    org: req.organization,
    grantedAt: new Date(now).toISOString(),
    grantedBy: by,
    expiresAt: lengthToExpiry(length, now),
    lastAccessAt: existing?.lastAccessAt,
    status: "active",
    channel: "web",
    scope,
  };
  return existing ? list.map((r) => (r.id === existing.id ? base : r)) : [base, ...list];
}

/* ───────── Hydration ───────── */

const subscribeHydration = (cb: () => void) => {
  const a = useTrust.persist.onHydrate(cb);
  const b = useTrust.persist.onFinishHydration(cb);
  return () => {
    a();
    b();
  };
};

/** True once the persisted demo data has loaded in the browser. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => useTrust.persist.hasHydrated(),
    () => false,
  );
}

export const TIME = { DAY, HOUR, MIN };
