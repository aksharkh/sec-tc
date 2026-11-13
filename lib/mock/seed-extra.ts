import type {
  AuditEntry,
  Faq,
  Incident,
  Integration,
  PublicQuestion,
  Questionnaire,
  QuestionnaireItem,
  StatusComponent,
  Subprocessor,
  Subscriber,
  Update,
  Webhook,
} from "@/lib/types";
import { DAY, HOUR, MIN, mulberry32 } from "@/lib/utils";

/* All companies, agencies and people are fictional. */

export function seedFaqs(now: number): Faq[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const list: Omit<Faq, "id">[] = [
    { category: "Data protection", question: "Is customer data encrypted at rest and in transit?", answer: "Yes. Data at rest is encrypted with AES-256 through FIPS 140-validated modules, and keys are held in a managed HSM and rotated every 12 months. All traffic uses TLS 1.2 or higher, and service-to-service traffic inside the boundary is mutually authenticated.", docIds: ["encryption-standard", "system-boundary"], updatedAt: at(40), owner: "Hannah Cole", public: true, uses: 61 },
    { category: "Data protection", question: "Where is federal data stored and processed?", answer: "Only in US regions (US East and US West), including backups. Staff with production access are US persons located in the United States.", docIds: ["system-boundary"], updatedAt: at(72), owner: "Hannah Cole", public: true, uses: 48 },
    { category: "Data protection", question: "What happens to our data when the contract ends?", answer: "Agency data is deleted within 30 days of contract end and we confirm deletion in writing. Backups that contain it expire within 35 days. You can export everything before the end date.", docIds: ["data-retention-policy"], updatedAt: at(160), owner: "Luis Ortega", public: true, uses: 22 },
    { category: "Access control", question: "Do you support single sign-on for agency users?", answer: "Yes. Workbench supports SAML 2.0 and OIDC, including PIV and CAC through your agency's identity provider. MFA is enforced for every user, and sessions time out after 15 minutes of inactivity.", docIds: ["access-control-policy", "customer-responsibility-matrix"], updatedAt: at(55), owner: "Hannah Cole", public: true, uses: 37 },
    { category: "Access control", question: "How is privileged access to production controlled?", answer: "Production access is just-in-time: each session is requested, approved by a second engineer, limited to 4 hours and recorded. Administrators use phishing-resistant MFA, and access is reviewed every quarter.", docIds: ["access-control-policy"], updatedAt: at(55), owner: "Hannah Cole", public: true, uses: 29 },
    { category: "Infrastructure", question: "How often do you scan for vulnerabilities?", answer: "Infrastructure and container images are scanned continuously, the web application weekly, and authenticated scans run monthly. Critical findings are fixed within 15 days and high findings within 30.", docIds: ["vulnerability-scan-summary", "poam"], updatedAt: at(14), owner: "Hannah Cole", public: true, uses: 44 },
    { category: "Infrastructure", question: "Do you run independent penetration tests?", answer: "Yes, once a year by an independent firm and after any significant change. All high findings from the 2026 test were fixed and retested. The summary is in the restricted documents.", docIds: ["pentest-summary"], updatedAt: at(61), owner: "Hannah Cole", public: true, uses: 31 },
    { category: "Infrastructure", question: "How do you control changes to production?", answer: "Every change is peer reviewed, tested automatically and deployed from signed builds. Changes that affect the security boundary are notified to FedRAMP and agencies as significant change notifications.", docIds: ["change-management-policy", "significant-change-log"], updatedAt: at(26), owner: "Luis Ortega", public: true, uses: 18 },
    { category: "Incident response", question: "How quickly will you tell us about a security incident?", answer: "Within 1 hour of confirming an incident that affects federal data, we notify CISA and the affected agencies, then send updates at least every 24 hours until it is resolved. A written post-incident review follows within 10 business days.", docIds: ["incident-response-plan"], updatedAt: at(88), owner: "Hannah Cole", public: true, uses: 40 },
    { category: "Incident response", question: "What are your recovery time and recovery point objectives?", answer: "Recovery time objective is 4 hours and recovery point objective is 15 minutes. We test region failover twice a year; the last test recovered in 38 minutes.", docIds: ["bcdr-plan", "dr-test-results"], updatedAt: at(150), owner: "Hannah Cole", public: true, uses: 27 },
    { category: "Compliance", question: "What is Workbench's FedRAMP status?", answer: "Northwind Workbench is FedRAMP 20x Class C certified under package FR20X-C-26-0318. FedRAMP sets the status; this trust center shares the package, monthly monitoring reports and change notifications with agencies.", docIds: ["independent-assessment-report", "ksi-validation-summary"], updatedAt: at(44), owner: "Hannah Cole", public: true, uses: 55 },
    { category: "Compliance", question: "Do you have a SOC 2 report?", answer: "Yes. The SOC 2 Type II report covers July 1, 2025 to June 30, 2026 for security, availability and confidentiality, with an unqualified opinion. The SOC 3 summary is public.", docIds: ["soc2-type2", "soc3"], updatedAt: at(96), owner: "Luis Ortega", public: true, uses: 33 },
    { category: "Compliance", question: "How do you monitor controls between assessments?", answer: "Key Security Indicators are validated automatically every day. A monthly continuous monitoring report covers scanning, inventory changes, incidents and POA&M progress.", docIds: ["conmon-report", "ksi-validation-summary", "poam"], updatedAt: at(13), owner: "Hannah Cole", public: true, uses: 21 },
    { category: "Privacy", question: "Is customer data used to train AI models?", answer: "No. Customer data is never used to train models, and Workbench does not send customer data to third-party AI services.", docIds: ["data-retention-policy"], updatedAt: at(20), owner: "Luis Ortega", public: true, uses: 26 },
    { category: "Privacy", question: "Which third parties process our data?", answer: "The subprocessor list on this page names each one, what it does, which data it handles and where. We give 30 days' notice before adding a subprocessor that handles customer data.", docIds: ["vendor-risk-policy"], updatedAt: at(40), owner: "Luis Ortega", public: true, uses: 19 },
    { category: "Privacy", question: "Is Workbench accessible under Section 508?", answer: "Yes. The VPAT 2.5 report documents conformance with WCAG 2.1 AA for the Workbench web application.", docIds: ["vpat"], updatedAt: at(130), owner: "Luis Ortega", public: true, uses: 9 },
    { category: "Access control", question: "Can we restrict access to our tenant by IP address?", answer: "Yes. Agency administrators can set an IP allowlist for their tenant, including separate lists for the API.", docIds: ["customer-responsibility-matrix"], updatedAt: at(120), owner: "Luis Ortega", public: false, uses: 7 },
  ];
  return list.map((f, i) => ({ ...f, id: `faq_${i + 1}` }));
}

const Q_BANK: { text: string; faq?: number }[] = [
  { text: "Describe how data is encrypted at rest.", faq: 1 },
  { text: "Is data in transit encrypted? Which protocols?", faq: 1 },
  { text: "In which countries is customer data stored or processed?", faq: 2 },
  { text: "Describe data deletion at the end of the contract.", faq: 3 },
  { text: "Do you support SAML-based SSO with PIV/CAC?", faq: 4 },
  { text: "How is administrative access to production approved and logged?", faq: 5 },
  { text: "What is your vulnerability remediation timeline for critical findings?", faq: 6 },
  { text: "When was your last third-party penetration test?", faq: 7 },
  { text: "Describe your change management process.", faq: 8 },
  { text: "What are your incident notification timelines to customers?", faq: 9 },
  { text: "State your RTO and RPO and when DR was last tested.", faq: 10 },
  { text: "Provide your current FedRAMP status and package ID.", faq: 11 },
  { text: "Do you hold a current SOC 2 Type II report?", faq: 12 },
  { text: "Do you use customer data for machine learning or AI training?", faq: 14 },
  { text: "List subprocessors with access to customer data.", faq: 15 },
  { text: "Can tenant access be restricted by source IP address?", faq: 17 },
  { text: "Describe background screening for staff with production access." },
  { text: "Do you carry cyber liability insurance? State the coverage amount." },
  { text: "Describe how you segregate one customer's data from another's." },
  { text: "How do you secure developer workstations?" },
  { text: "How long are audit logs retained?" },
  { text: "Is there a bug bounty or vulnerability disclosure program?" },
];

function items(seed: number, count: number, answered: number): QuestionnaireItem[] {
  const r = mulberry32(seed);
  const pool = [...Q_BANK].sort(() => r() - 0.5).slice(0, count);
  return pool.map((q, i) => {
    const matched = q.faq !== undefined;
    let state: QuestionnaireItem["state"] = matched ? "matched" : "needs_answer";
    if (i < answered && matched) state = "approved";
    if (i < answered && !matched) state = "edited";
    return {
      id: `qi_${seed}_${i}`,
      text: q.text,
      faqId: matched ? `faq_${q.faq}` : undefined,
      answer: !matched && state === "edited" ? "Answered by Northwind security for this questionnaire." : undefined,
      state,
    };
  });
}

export function seedQuestionnaires(now: number): Questionnaire[] {
  const at = (d: number) => new Date(now + d * DAY).toISOString();
  return [
    { id: "qn_1", title: "OFSA vendor security questionnaire", agencyId: "ofsa", requester: "Dana Whitfield", receivedAt: at(-2), dueAt: at(8), status: "in_progress", format: "xlsx", items: items(11, 18, 9) },
    { id: "qn_2", title: "FHRO cloud service intake form", agencyId: "fhro", requester: "Grace Kim", receivedAt: new Date(now - 6 * HOUR).toISOString(), dueAt: at(13), status: "new", format: "docx", items: items(23, 14, 0) },
    { id: "qn_3", title: "Supply chain risk questionnaire", agencyId: "dlro", requester: "Jordan Ellis", receivedAt: at(-12), dueAt: at(-2), status: "sent", format: "portal", items: items(37, 16, 16), sentAt: at(-3) },
    { id: "qn_4", title: "State agency CAIQ excerpt", agencyId: "other", requester: "Megan Doyle", receivedAt: at(-5), dueAt: at(4), status: "in_review", format: "xlsx", items: items(41, 12, 12) },
  ];
}

export function seedPublicQuestions(now: number): PublicQuestion[] {
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  return [
    { id: "pq_1", question: "Does Workbench support FIPS 140-3 validated modules, or 140-2 only?", name: "Elena Brandt", email: "elena.brandt@fwds.gov", organization: "Federal Workforce Data Service", askedAt: ago(20), status: "open" },
    { id: "pq_2", question: "Can audit logs be streamed to our agency SIEM in real time?", name: "Ravi Iyer", email: "ravi.iyer@larkspurfed.com", organization: "Larkspur Federal Consulting", askedAt: ago(52), status: "open" },
    { id: "pq_3", question: "Is there a public status page for outages?", name: "Grace Kim", email: "grace.kim@fhro.gov", organization: "Federal Housing Records Office", askedAt: ago(200), status: "answered", answer: "Yes. Service status and the incident history are on this trust page, and you can subscribe to incident notices.", answeredAt: ago(190) },
  ];
}

export function seedUpdates(now: number, prevMonth: string): Update[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const list: Omit<Update, "id">[] = [
    { kind: "maintenance", title: "Scheduled maintenance: document storage migration", body: "Document downloads may pause for up to 10 minutes during the window, 2:00 to 4:00 AM Eastern. Sign-in and the API stay available.", at: new Date(now + 9 * DAY).toISOString(), status: "scheduled", audience: "public", recipients: 0, opens: 0, author: "Hannah Cole" },
    { kind: "document", title: "KSI Validation Summary updated", body: "November validation results. KSI-MLA-05 now passes after the log retention change.", at: at(9), status: "published", audience: "reviewers", recipients: 34, opens: 21, docId: "ksi-validation-summary", author: "Hannah Cole" },
    { kind: "document", title: "Plan of Action and Milestones updated", body: "3 findings closed and 1 moderate finding added from October scanning.", at: at(12), status: "published", audience: "reviewers", recipients: 34, opens: 26, docId: "poam", author: "Hannah Cole" },
    { kind: "document", title: `Continuous Monitoring Report, ${prevMonth} published`, body: "Scanning, inventory changes and incident summary for the month.", at: at(13), status: "published", audience: "reviewers", recipients: 34, opens: 29, docId: "conmon-report", author: "Hannah Cole" },
    { kind: "incident", title: "Elevated API latency", body: "API requests were slow for 41 minutes because of a database connection pool limit. No data was lost or exposed. The limit was raised and an alert added.", at: at(23), status: "published", audience: "public", recipients: 58, opens: 37, author: "Hannah Cole" },
    { kind: "scn", title: "SCN-0142: database engine major version upgrade", body: "Upgrade of the primary database engine within the certified boundary. No change to data flows or the boundary. Assessed as an adaptive change.", at: at(26), status: "published", audience: "reviewers", recipients: 34, opens: 30, docId: "significant-change-log", author: "Hannah Cole" },
    { kind: "subprocessor", title: "New subprocessor: Parcel Docs", body: "Parcel Docs converts uploaded files to PDF inside the certification boundary. It processes document content transiently and stores nothing.", at: at(40), status: "published", audience: "public", recipients: 52, opens: 31, author: "Luis Ortega" },
    { kind: "general", title: "2026 annual assessment complete", body: "Keystone Assurance Partners completed the annual assessment. The report and two low findings are in the restricted package.", at: at(44), status: "published", audience: "public", recipients: 49, opens: 40, docId: "independent-assessment-report", author: "Hannah Cole" },
    { kind: "document", title: "Customer Responsibility Matrix v3.1", body: "Adds the IP allowlist settings for the API.", at: at(-2), status: "draft", audience: "reviewers", recipients: 0, opens: 0, docId: "customer-responsibility-matrix", author: "Luis Ortega" },
  ];
  return list.map((u, i) => ({ ...u, id: `up_${i + 1}` }));
}

export function seedSubscribers(now: number): Subscriber[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const list: Omit<Subscriber, "id">[] = [
    { email: "dana.whitfield@ofsa.gov", name: "Dana Whitfield", organization: "Office of Federal Systems Assurance", topics: ["documents", "changes", "incidents"], at: at(50), status: "confirmed", source: "reviewer portal" },
    { email: "marcus.oyelaran@ofsa.gov", name: "Marcus Oyelaran", organization: "Office of Federal Systems Assurance", topics: ["changes", "incidents"], at: at(118), status: "confirmed", source: "reviewer portal" },
    { email: "elena.brandt@fwds.gov", name: "Elena Brandt", organization: "Federal Workforce Data Service", topics: ["documents", "changes", "incidents", "subprocessors"], at: at(69), status: "confirmed", source: "reviewer portal" },
    { email: "grace.kim@fhro.gov", name: "Grace Kim", organization: "Federal Housing Records Office", topics: ["incidents"], at: at(29), status: "confirmed", source: "trust page" },
    { email: "jordan.ellis@dlro.mil", name: "Jordan Ellis", organization: "Defense Logistics Readiness Office", topics: ["changes", "incidents", "subprocessors"], at: at(19), status: "confirmed", source: "reviewer portal" },
    { email: "security-notices@ibx.gov", organization: "Interagency Benefits Exchange", topics: ["incidents", "changes"], at: at(170), status: "confirmed", source: "trust page" },
    { email: "vendor-risk@larkspurfed.com", organization: "Larkspur Federal Consulting", topics: ["subprocessors", "documents"], at: at(88), status: "confirmed", source: "trust page" },
    { email: "owen.hartley@keystoneassurance.com", name: "Owen Hartley", organization: "Keystone Assurance Partners", topics: ["documents", "changes"], at: at(20), status: "confirmed", source: "reviewer portal" },
    { email: "it-security@harborviewadvisory.com", organization: "Harborview Advisory", topics: ["incidents"], at: at(1), status: "pending", source: "trust page" },
    { email: "ravi.menon@dcinfra.gov", name: "Ravi Menon", organization: "Department of Coastal Infrastructure", topics: ["incidents"], at: at(130), status: "unsubscribed", source: "trust page" },
  ];
  return list.map((s, i) => ({ ...s, id: `sub_${i + 1}` }));
}

export function seedSubprocessors(now: number): Subprocessor[] {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const list: Omit<Subprocessor, "id">[] = [
    { name: "Meridian Federal Cloud", purpose: "Infrastructure hosting, compute and storage", data: "All customer data", location: "US East, US West", since: at(900), status: "active", certifications: ["FedRAMP 20x Class C", "SOC 2"] },
    { name: "Keyline HSM Service", purpose: "Encryption key management", data: "Encryption keys only", location: "US East, US West", since: at(900), status: "active", certifications: ["FIPS 140-3", "SOC 2"] },
    { name: "Parcel Docs", purpose: "Document conversion inside the boundary", data: "Document content, transient", location: "US East", since: at(40), status: "active", certifications: ["SOC 2"] },
    { name: "Lumen Mail", purpose: "Transactional email (sign-in links, notices)", data: "Names and email addresses", location: "United States", since: at(600), status: "active", certifications: ["SOC 2", "ISO 27001"] },
    { name: "Tracewell Observability", purpose: "Logs and metrics", data: "System metadata, no customer content", location: "United States", since: at(450), status: "active", certifications: ["SOC 2"] },
    { name: "Northstar Support Desk", purpose: "Support tickets", data: "Contact details and ticket text", location: "United States", since: at(700), status: "active", certifications: ["SOC 2"] },
    { name: "Harbor Vault Backup", purpose: "Encrypted offsite backups", data: "Encrypted backup copies", location: "US Central", since: new Date(now + 20 * DAY).toISOString(), status: "planned", certifications: ["SOC 2"] },
  ];
  return list.map((s, i) => ({ ...s, id: `sp_${i + 1}` }));
}

export function seedStatus(now: number): { components: StatusComponent[]; incidents: Incident[] } {
  const r = mulberry32(90210);
  const days = (dips: Record<number, number>) =>
    Array.from({ length: 90 }, (_, i) => {
      const daysAgo = 89 - i;
      if (dips[daysAgo] !== undefined) return dips[daysAgo]!;
      return r() < 0.03 ? 99.95 : 100;
    });
  const components: StatusComponent[] = [
    { id: "app", name: "Workbench web application", description: "Case intake, review and records", status: "operational", uptime: days({ 27: 99.86 }) },
    { id: "api", name: "Workbench API", description: "REST API for agency systems", status: "operational", uptime: days({ 23: 97.15 }) },
    { id: "storage", name: "Document storage", description: "Uploads, downloads and conversion", status: "operational", uptime: days({ 27: 99.9 }) },
    { id: "auth", name: "Sign-in and SSO", description: "SAML, OIDC and PIV/CAC sign-in", status: "operational", uptime: days({}) },
    { id: "email", name: "Email notifications", description: "Sign-in links and notices", status: "operational", uptime: days({ 61: 99.4 }) },
  ];
  const t = (d: number, h = 0, m = 0) => new Date(now - d * DAY + h * HOUR + m * MIN).toISOString();
  const incidents: Incident[] = [
    {
      id: "inc_3",
      title: "Scheduled maintenance: document storage migration",
      impact: "maintenance",
      startedAt: new Date(now + 9 * DAY).toISOString(),
      components: ["storage"],
      updates: [{ at: t(1), status: "scheduled", text: "Downloads may pause for up to 10 minutes between 2:00 and 4:00 AM Eastern. Sign-in and the API stay available." }],
    },
    {
      id: "inc_2",
      title: "Elevated API latency",
      impact: "minor",
      startedAt: t(23, 0, 0),
      resolvedAt: t(23, 0, 41),
      components: ["api"],
      updates: [
        { at: t(23, 0, 41), status: "resolved", text: "Latency is back to normal. The connection pool limit was raised and an alert added. No data was lost or exposed." },
        { at: t(23, 0, 22), status: "identified", text: "A database connection pool limit is causing slow API responses. Raising the limit now." },
        { at: t(23, 0, 6), status: "investigating", text: "Some API requests are taking longer than usual. The web application is not affected." },
      ],
    },
    {
      id: "inc_1",
      title: "Database engine upgrade (SCN-0142)",
      impact: "maintenance",
      startedAt: t(27, 2),
      resolvedAt: t(27, 3, 50),
      components: ["app", "storage"],
      updates: [{ at: t(27, 3, 50), status: "completed", text: "Upgrade complete. Two brief read-only periods of under a minute each." }],
    },
  ];
  return { components, incidents };
}

export function seedIntegrations(now: number): Integration[] {
  const ago = (m: number) => new Date(now - m * MIN).toISOString();
  const list: Omit<Integration, "id">[] = [
    { name: "SecureKnots Workspace", category: "SecureKnots", description: "Publishes documents approved in Workspace to this trust center, with their version history.", status: "connected", detail: "Syncs approved documents every 15 minutes", lastSyncAt: ago(4) },
    { name: "Microsoft Entra ID", category: "Identity", description: "Single sign-on for Northwind and SecureKnots admins.", status: "connected", detail: "SAML · 3 admins mapped", lastSyncAt: ago(60 * 5) },
    { name: "Login.gov", category: "Identity", description: "Let agency reviewers sign in with Login.gov instead of an email link.", status: "available" },
    { name: "Okta", category: "Identity", description: "SSO and SCIM provisioning for client admins.", status: "available" },
    { name: "Slack", category: "Notifications", description: "Post new access requests, approvals and incidents to a channel.", status: "connected", detail: "#trust-center-alerts", lastSyncAt: ago(300) },
    { name: "Microsoft Teams", category: "Notifications", description: "Send the same alerts to a Teams channel.", status: "available" },
    { name: "Splunk", category: "Security", description: "Stream access logs to your SIEM over HTTP Event Collector.", status: "error", detail: "Token rejected (401) since yesterday", lastSyncAt: ago(60 * 26) },
    { name: "Syslog / S3 export", category: "Storage", description: "Daily export of access logs to your own bucket or syslog server.", status: "available" },
    { name: "ServiceNow GRC", category: "GRC", description: "Answer vendor questionnaires from your Q&A library inside ServiceNow.", status: "available" },
  ];
  return list.map((x, i) => ({ ...x, id: `int_${i + 1}` }));
}

export function seedWebhooks(now: number): Webhook[] {
  const r = mulberry32(777);
  const events = ["access.request.created", "access.request.approved", "document.published", "package.regenerated", "reviewer.revoked"];
  const deliveries = (ok: boolean, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `dl_${ok ? "a" : "b"}_${i}`,
      at: new Date(now - (i * 7 + Math.floor(r() * 5)) * HOUR).toISOString(),
      event: events[Math.floor(r() * events.length)]!,
      code: ok ? (r() < 0.95 ? 200 : 502) : i < 3 ? 401 : 200,
      ms: Math.round(80 + r() * 260),
    }));
  return [
    { id: "wh_1", url: "https://hooks.northwindcloud.com/trust-center", events: events.slice(0, 4), status: "active", createdAt: new Date(now - 120 * DAY).toISOString(), secretLast4: "9c2e", deliveries: deliveries(true, 12) },
    { id: "wh_2", url: "https://siem.northwindcloud.com/ingest/trust", events: ["access.request.approved", "reviewer.revoked"], status: "failing", createdAt: new Date(now - 60 * DAY).toISOString(), secretLast4: "41ab", deliveries: deliveries(false, 8) },
  ];
}

export function seedAudit(now: number): AuditEntry[] {
  const r = mulberry32(4242);
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  const ip = () => `198.51.100.${10 + Math.floor(r() * 80)}`;
  const list: Omit<AuditEntry, "id" | "ip">[] = [
    { at: ago(0.2), actor: "Seema Abdul", action: "Signed in", target: "Admin console", detail: "Microsoft Entra ID, MFA verified", category: "sign-in" },
    { at: ago(2), actor: "System", action: "Regenerated package JSON", target: "Revision 41", detail: "Validation passed (9 checks)", category: "package" },
    { at: ago(5.5), actor: "Hannah Cole", action: "Signed in", target: "Admin console", detail: "Email and authenticator code", category: "sign-in" },
    { at: ago(26), actor: "Hannah Cole", action: "Updated rule", target: "larkspurfed.com", detail: "Paused automatic approval", category: "access" },
    { at: ago(30), actor: "System", action: "Integration error", target: "Splunk", detail: "HEC token rejected with 401", category: "integrations" },
    { at: ago(48), actor: "Hannah Cole", action: "Approved request", target: "Jordan Ellis (DLRO)", detail: "90 days", category: "access" },
    { at: ago(72), actor: "Luis Ortega", action: "Answered questionnaire", target: "Supply chain risk questionnaire", detail: "Sent to DLRO, 16 answers", category: "updates" },
    { at: ago(9 * 24), actor: "Hannah Cole", action: "Published document", target: "KSI Validation Summary v3.0", detail: "Restricted", category: "documents" },
    { at: ago(12 * 24), actor: "Hannah Cole", action: "Published document", target: "Plan of Action and Milestones v14.0", detail: "Restricted", category: "documents" },
    { at: ago(13 * 24), actor: "SecureKnots Workspace", action: "Synced document", target: "Continuous Monitoring Report", detail: "Approved in Workspace by Seema Abdul", category: "documents" },
    { at: ago(18 * 24), actor: "Hannah Cole", action: "Denied request", target: "Chris Varga (Varga Digital)", detail: "Not eligible for restricted documents", category: "access" },
    { at: ago(23 * 24), actor: "Hannah Cole", action: "Posted incident", target: "Elevated API latency", detail: "Sent to 58 subscribers", category: "updates" },
    { at: ago(26 * 24), actor: "Hannah Cole", action: "Published notice", target: "SCN-0142", detail: "Reviewers only, 34 recipients", category: "updates" },
    { at: ago(34 * 24), actor: "Hannah Cole", action: "Revoked reviewer", target: "Ravi Menon (DCI)", detail: "Left the agency", category: "access" },
    { at: ago(40 * 24), actor: "Luis Ortega", action: "Added subprocessor", target: "Parcel Docs", detail: "30-day notice sent", category: "settings" },
    { at: ago(41 * 24), actor: "Luis Ortega", action: "Denied request", target: "J. Patel", detail: "Disposable email address", category: "access" },
    { at: ago(60 * 24), actor: "Seema Abdul", action: "Created webhook", target: "siem.northwindcloud.com", detail: "2 events", category: "integrations" },
    { at: ago(100 * 24), actor: "Hannah Cole", action: "Created API key", target: "FWDS GRC sync", detail: "package:read, documents:read", category: "keys" },
    { at: ago(160 * 24), actor: "Seema Abdul", action: "Created API key", target: "OFSA continuous monitoring", detail: "3 scopes, no expiry", category: "keys" },
    { at: ago(228 * 24), actor: "Seema Abdul", action: "Verified domain", target: "trust.northwindcloud.com", detail: "TLS certificate issued", category: "settings" },
  ];
  return list.map((a, i) => ({ ...a, id: `au_${i + 1}`, ip: a.actor === "System" || a.actor === "SecureKnots Workspace" ? "internal" : ip() }));
}
