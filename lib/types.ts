export type Visibility = "public" | "restricted";
export type DocCategory = "policies" | "reports" | "package";
export type FileKind = "pdf" | "docx" | "xlsx" | "json" | "zip";

export type DocVersion = {
  version: string;
  publishedAt: string;
  author: string;
  note: string;
  words: number;
  pages: number;
  sizeKb: number;
};

export type TrustDocument = {
  id: string;
  title: string;
  category: DocCategory;
  kind: FileKind;
  visibility: Visibility;
  summary: string;
  practices: string[];
  /** Newest first. */
  versions: DocVersion[];
  source: "workspace" | "upload";
};

export type AgencyKind = "agency" | "assessor" | "partner";
export type Agency = { id: string; name: string; short: string; domain: string; kind: AgencyKind };

export type RequestStatus = "pending" | "approved" | "denied";
export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  organization: string;
  agencyId?: string;
  purpose: string;
  nda: boolean;
  submittedAt: string;
  status: RequestStatus;
  decidedAt?: string;
  decidedBy?: string;
  /** null = continuing access */
  expiresAt?: string | null;
  reason?: string;
  auto?: boolean;
  /** Specific restricted documents the requester asked for, if any. */
  docIds?: string[];
};

export type ReviewerStatus = "active" | "revoked" | "expired";
export type Reviewer = {
  id: string;
  kind: "person" | "system";
  name: string;
  /** Email for people, client ID for systems. */
  handle: string;
  title?: string;
  agencyId: string;
  /** Organization name typed in the request, for reviewers outside the agency list. */
  org?: string;
  grantedAt: string;
  grantedBy: string;
  expiresAt: string | null;
  lastAccessAt?: string;
  status: ReviewerStatus;
  channel: "web" | "api";
  scope: "all" | "package";
};

export type AccessLength = "30d" | "90d" | "1y" | "continuing";
export type Rule = {
  id: string;
  domain: string;
  access: AccessLength;
  scope: "all" | "package";
  createdAt: string;
  createdBy: string;
  enabled: boolean;
  note?: string;
};

export type LogAction = "sign_in" | "view" | "download" | "download_all" | "api_fetch";
export type LogEvent = {
  id: string;
  at: string;
  actor: string;
  handle: string;
  actorKind: "person" | "system";
  agencyId: string;
  docId?: string;
  target: string;
  action: LogAction;
  channel: "web" | "api";
  ip: string;
};

export type ApiKey = {
  id: string;
  name: string;
  agencyId: string;
  prefix: string;
  last4: string;
  scopes: string[];
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  expiresAt: string | null;
  status: "active" | "revoked";
};

export type Snapshot = {
  id: string;
  createdAt: string;
  label: string;
  trigger: "scheduled" | "publish" | "manual" | "restore";
  documents: number;
  sizeMb: number;
  checksum: string;
  by: string;
};

export type TenantStatus = "live" | "setup" | "draft" | "paused";
export type Tenant = {
  id: string;
  slug: string;
  name: string;
  product: string;
  domain: string;
  domainStatus: "verified" | "pending" | "none";
  plan: "Federal" | "Standard";
  status: TenantStatus;
  lastPublishAt: string | null;
  documents: number;
  reviewers: number;
  frameworks: string[];
  accent: string;
  owner: string;
  createdAt: string;
};

export type ClientAdmin = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Editor" | "Viewer";
  org: "Northwind Cloud" | "SecureKnots";
  lastActiveAt?: string;
  mfa: boolean;
  invited?: boolean;
};

export type Notice = {
  id: string;
  at: string;
  kind: "request" | "expiry" | "json" | "domain" | "upload" | "approval";
  title: string;
  body: string;
  href: string;
};

export type DomainState = {
  host: string;
  status: "verified" | "pending" | "none";
  verifiedAt?: string;
  target: string;
  /** Wizard draft, persisted so a reload keeps the step. */
  draftHost: string;
  draftStep: 0 | 1 | 2 | 3;
};

export type PackageState = {
  generatedAt: string;
  revision: number;
  status: "valid" | "stale";
  /** The published JSON text. */
  published: string;
  /** JSON text at the last snapshot, for the diff. */
  baseline: string;
  baselineLabel: string;
};

/* ───────── Engagement, integrations and governance (v2) ───────── */

export type FaqCategory = "Data protection" | "Access control" | "Infrastructure" | "Incident response" | "Compliance" | "Privacy";
export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  docIds: string[];
  updatedAt: string;
  owner: string;
  public: boolean;
  /** How often the answer was viewed or reused in questionnaires. */
  uses: number;
};

export type PublicQuestion = {
  id: string;
  question: string;
  name: string;
  email: string;
  organization: string;
  askedAt: string;
  status: "open" | "answered";
  answer?: string;
  answeredAt?: string;
};

export type QuestionState = "matched" | "edited" | "needs_answer" | "approved";
export type QuestionnaireItem = { id: string; text: string; faqId?: string; answer?: string; state: QuestionState };
export type Questionnaire = {
  id: string;
  title: string;
  agencyId: string;
  requester: string;
  receivedAt: string;
  dueAt: string;
  status: "new" | "in_progress" | "in_review" | "sent";
  format: "xlsx" | "docx" | "portal";
  items: QuestionnaireItem[];
  sentAt?: string;
};

export type UpdateKind = "scn" | "incident" | "maintenance" | "document" | "subprocessor" | "general";
export type Update = {
  id: string;
  kind: UpdateKind;
  title: string;
  body: string;
  at: string;
  status: "published" | "scheduled" | "draft";
  audience: "public" | "reviewers";
  recipients: number;
  opens: number;
  docId?: string;
  author: string;
};

export type Topic = "documents" | "changes" | "incidents" | "subprocessors";
export type Subscriber = {
  id: string;
  email: string;
  name?: string;
  organization: string;
  topics: Topic[];
  at: string;
  status: "confirmed" | "pending" | "unsubscribed";
  source: "trust page" | "reviewer portal" | "admin";
};

export type Subprocessor = {
  id: string;
  name: string;
  purpose: string;
  data: string;
  location: string;
  since: string;
  status: "active" | "planned" | "removed";
  certifications: string[];
};

export type ComponentStatus = "operational" | "degraded" | "outage" | "maintenance";
export type StatusComponent = { id: string; name: string; description: string; status: ComponentStatus; uptime: number[] };
export type Incident = {
  id: string;
  title: string;
  impact: "minor" | "major" | "maintenance";
  startedAt: string;
  resolvedAt?: string;
  components: string[];
  updates: { at: string; status: "investigating" | "identified" | "monitoring" | "resolved" | "scheduled" | "completed"; text: string }[];
};

export type IntegrationCategory = "SecureKnots" | "Identity" | "Notifications" | "Security" | "Storage" | "GRC";
export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: "connected" | "available" | "error";
  detail?: string;
  lastSyncAt?: string;
};

export type WebhookDelivery = { id: string; at: string; event: string; code: number; ms: number };
export type Webhook = {
  id: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "failing";
  createdAt: string;
  secretLast4: string;
  deliveries: WebhookDelivery[];
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  category: "access" | "documents" | "package" | "settings" | "keys" | "sign-in" | "updates" | "integrations";
  ip: string;
};

/* ───────── v3: NDA, KSI metrics, standard questionnaires ───────── */

export type NdaRecord = {
  id: string;
  name: string;
  email: string;
  organization: string;
  /** Full name as typed by the signer. */
  signature: string;
  signedAt: string;
  version: string;
  ip: string;
  requestId?: string;
  status: "active" | "superseded";
};

export type KsiMetric = {
  id: string;
  checks: number;
  passing: number;
  /** Share of checks validated automatically and continuously (persistent validation). */
  automation: number;
  lastValidated: string;
  /** Last manual evidence review, for checks that are not automated. */
  lastManualReview?: string;
  /** Daily pass rate for the last 30 days, oldest first. */
  trend: number[];
  note?: string;
};

export type StandardAnswer = "Yes" | "No" | "Partial" | "N/A";
export type StandardItem = { id: string; domain: string; question: string; answer: StandardAnswer; detail: string; docIds: string[] };
export type StandardQuestionnaire = {
  id: "caiq" | "sig-lite";
  name: string;
  version: string;
  updatedAt: string;
  owner: string;
  items: StandardItem[];
};

/* ───────── v4: automations ───────── */
export type AutomationCategory = "access" | "documents" | "monitoring" | "questionnaires" | "reporting";
export type Automation = {
  id: string;
  name: string;
  category: AutomationCategory;
  trigger: string;
  condition?: string;
  actions: string[];
  enabled: boolean;
  runs: number;
  /** Minutes of manual work each run replaces. */
  minutesPerRun: number;
  lastRunAt?: string;
  createdBy: string;
  template?: boolean;
};
export type AutomationRun = {
  id: string;
  automationId: string;
  at: string;
  summary: string;
  result: "success" | "skipped" | "failed";
  ms: number;
};
