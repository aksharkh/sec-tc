"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleDashed,
  Ellipsis,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";
import { SecureKnotsLogo } from "@/components/brand/SecureKnotsLogo";
import { CopyButton, EmptyState, PageHeader } from "@/components/kit/bits";
import { CodeViewer } from "@/components/kit/code";
import { StatCard } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Meta } from "@/components/ui/display";
import { Checkbox, Select } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { Integration, IntegrationCategory, Webhook, WebhookDelivery } from "@/lib/types";
import { cn, fakeHash, fmt, sleep, uid } from "@/lib/utils";
import { PageSkeleton } from "./common";

/* ───────── Connection definitions ───────── */

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "password" | "select";
  options?: { value: string; label: string }[];
  validate: (v: string) => string | null;
};

type ConnectDef = {
  fields: FieldDef[];
  example: Record<string, string>;
  checks: (v: Record<string, string>) => string[];
  detail: (v: Record<string, string>) => string;
  readonly?: { label: string; value: string }[];
  testLabel?: string;
};

const req = (msg: string) => (v: string) => (v.trim() ? null : msg);
const re = (r: RegExp, msg: string) => (v: string) => (r.test(v.trim()) ? null : msg);
const HTTPS = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d{2,5})?(\/\S*)?$/i;

const CONNECT: Record<string, ConnectDef> = {
  "Microsoft Entra ID": {
    fields: [
      { key: "tenant", label: "Directory (tenant) ID", placeholder: "00000000-0000-0000-0000-000000000000", validate: re(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Paste the tenant ID from Entra ID › Overview.") },
      { key: "group", label: "Admin group", placeholder: "Trust center admins", validate: req("Name the group whose members can sign in.") },
    ],
    example: { tenant: "6f1c2a9e-3b4d-4c8e-9a1f-2d7b5e0c8a41", group: "Trust center admins" },
    checks: () => ["Reading the federation metadata", "Mapping admin group members", "Saving"],
    detail: (v) => `SAML · group ${v.group}`,
    readonly: [{ label: "Reply URL", value: "https://trust.secureknots.com/auth/saml/northwind" }],
  },
  "Login.gov": {
    fields: [
      { key: "issuer", label: "Issuer", placeholder: "urn:gov:gsa:openidconnect.profiles:sp:sso:agency:app", validate: re(/^urn:gov:gsa:openidconnect\.profiles:sp:sso:[a-z0-9_:-]+$/i, "Use the issuer from your Login.gov partner portal, starting with urn:gov:gsa:.") },
      {
        key: "ial",
        label: "Identity assurance level",
        type: "select",
        options: [
          { value: "ial1", label: "IAL1, email and MFA" },
          { value: "ial2", label: "IAL2, identity verified" },
        ],
        validate: req("Choose an assurance level."),
      },
    ],
    example: { issuer: "urn:gov:gsa:openidconnect.profiles:sp:sso:secureknots:northwind_trust", ial: "ial1" },
    checks: () => ["Checking the issuer with Login.gov", "Registering the redirect URI", "Saving"],
    detail: (v) => `OIDC · ${v.ial === "ial2" ? "IAL2" : "IAL1"} · reviewers can choose Login.gov`,
    readonly: [{ label: "Redirect URI", value: "https://trust.northwindcloud.com/auth/login-gov/callback" }],
  },
  Okta: {
    fields: [
      { key: "domain", label: "Okta domain", placeholder: "northwind.okta.com", validate: re(/^[a-z0-9-]+\.(okta|oktapreview)\.com$/i, "Use your Okta domain, for example northwind.okta.com.") },
      { key: "client", label: "Client ID", placeholder: "0oa1b2c3d4E5f6G7h8i9", validate: (v) => (v.trim().length >= 10 ? null : "Paste the client ID of the app integration.") },
    ],
    example: { domain: "northwind.okta.com", client: "0oa7xk2m9QpLr4Tz5d7" },
    checks: (v) => [`Reaching ${v.domain}`, "Checking SCIM provisioning", "Saving"],
    detail: (v) => `OIDC + SCIM · ${v.domain}`,
  },
  Slack: {
    fields: [
      { key: "channel", label: "Channel", placeholder: "#trust-center-alerts", validate: re(/^#[a-z0-9][a-z0-9_-]{1,79}$/, "Use a channel name like #trust-center-alerts.") },
    ],
    example: { channel: "#trust-center-alerts" },
    checks: (v) => ["Authorizing the SecureKnots app", `Posting a test message to ${v.channel}`, "Saving"],
    detail: (v) => v.channel,
    testLabel: "Post a test message",
  },
  "Microsoft Teams": {
    fields: [{ key: "url", label: "Incoming webhook URL", placeholder: "https://northwind.webhook.office.com/…", validate: re(HTTPS, "Paste the HTTPS webhook URL from the Teams channel connector.") }],
    example: { url: "https://northwind.webhook.office.com/webhookb2/7c1e9a/IncomingWebhook/3f2d" },
    checks: () => ["Checking the webhook URL", "Posting a test card", "Saving"],
    detail: () => "Security team channel",
    testLabel: "Post a test card",
  },
  Splunk: {
    fields: [
      { key: "url", label: "HTTP Event Collector URL", placeholder: "https://splunk.example.com:8088/services/collector", validate: re(HTTPS, "Use the HTTPS URL of your HEC endpoint.") },
      { key: "token", label: "HEC token", type: "password", placeholder: "Paste a new token", validate: (v) => (v.trim().length >= 20 ? null : "Paste the full HEC token (at least 20 characters).") },
      { key: "index", label: "Index", placeholder: "trust_access", validate: re(/^[a-z0-9_-]{2,}$/, "Use lowercase letters, numbers, - or _.") },
    ],
    example: { url: "https://splunk.northwindcloud.com:8088/services/collector", token: "8f3c1d2e-7b6a-4e5f-9a0b-1c2d3e4f5a6b", index: "trust_access" },
    checks: (v) => ["Checking the token", `Sending a test event to index ${v.index}`, "Resuming the log stream"],
    detail: (v) => `HEC · index ${v.index} · streaming`,
    testLabel: "Send a test event",
  },
  "Syslog / S3 export": {
    fields: [
      { key: "bucket", label: "S3 bucket", placeholder: "northwind-trust-logs", validate: re(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Bucket names use lowercase letters, numbers, dots and hyphens.") },
      {
        key: "region",
        label: "Region",
        type: "select",
        options: [
          { value: "us-east-1", label: "US East (N. Virginia)" },
          { value: "us-west-2", label: "US West (Oregon)" },
          { value: "us-gov-west-1", label: "US GovCloud (West)" },
        ],
        validate: req("Choose a region."),
      },
      {
        key: "schedule",
        label: "Schedule",
        type: "select",
        options: [
          { value: "daily", label: "Daily at 01:00 UTC" },
          { value: "hourly", label: "Every hour" },
        ],
        validate: req("Choose a schedule."),
      },
    ],
    example: { bucket: "northwind-trust-logs", region: "us-east-1", schedule: "daily" },
    checks: (v) => [`Writing a test object to ${v.bucket}`, "Checking the bucket policy", "Saving"],
    detail: (v) => `s3://${v.bucket} · ${v.schedule === "hourly" ? "hourly" : "daily"}`,
    readonly: [{ label: "Role to trust", value: "arn:aws:iam::000000000000:role/secureknots-trust-export" }],
  },
  "ServiceNow GRC": {
    fields: [
      { key: "instance", label: "Instance", placeholder: "northwind.service-now.com", validate: re(/^[a-z0-9-]+\.service-now\.com$/i, "Use your instance host, for example northwind.service-now.com.") },
      { key: "user", label: "Integration user", placeholder: "svc_trust_center", validate: req("Name the integration user.") },
    ],
    example: { instance: "northwind.service-now.com", user: "svc_trust_center" },
    checks: (v) => [`Reaching ${v.instance}`, "Importing the Q&A library", "Saving"],
    detail: (v) => `${v.instance} · Q&A library linked`,
  },
};

const MONOGRAM: Record<string, string> = {
  "Microsoft Entra ID": "EN",
  "Login.gov": "LG",
  Okta: "OK",
  Slack: "SL",
  "Microsoft Teams": "MT",
  Splunk: "SP",
  "Syslog / S3 export": "S3",
  "ServiceNow GRC": "SN",
};

const CATEGORY_NOTE: Record<Exclude<IntegrationCategory, "SecureKnots">, string> = {
  Identity: "Single sign-on for admins and reviewers",
  Notifications: "Alerts for requests, approvals and incidents",
  Security: "Send access logs to your SIEM",
  Storage: "Keep your own copy of the logs",
  GRC: "Reuse answers where questionnaires arrive",
};

const CATEGORIES = ["Identity", "Notifications", "Security", "Storage", "GRC"] as const;

/* ───────── Webhook event catalog ───────── */

const EVENTS: { id: string; body: string; data: Record<string, unknown> }[] = [
  { id: "access.request.created", body: "Someone asked for access on the trust page.", data: { request_id: "rq_8k2m1", name: "Priya Natarajan", organization: "Larkspur Federal Consulting", email_domain: "larkspurfed.com", status: "pending" } },
  { id: "access.request.approved", body: "A request was approved, by an admin or an allowlist rule.", data: { request_id: "rq_8k2m1", reviewer_id: "rv_31", approved_by: "Seema Abdul", expires_at: "2027-02-11T00:00:00Z" } },
  { id: "access.request.denied", body: "A request was denied, with the reason sent to the requester.", data: { request_id: "rq_4n7c2", reason: "Use your work email address and request again." } },
  { id: "reviewer.revoked", body: "A reviewer's access was revoked before it expired.", data: { reviewer_id: "rv_11", agency: "DCI", revoked_by: "Hannah Cole" } },
  { id: "document.published", body: "A new document was published to the trust page.", data: { document_id: "poam", title: "Plan of Action and Milestones", version: "14.0", visibility: "restricted" } },
  { id: "package.regenerated", body: "The package JSON was rebuilt and passed validation.", data: { revision: 42, url: "https://trust.northwindcloud.com/fedramp/certification-package-overview.json", sha256: "9c1e4d…a40f" } },
  { id: "incident.posted", body: "An incident or maintenance notice was posted.", data: { incident_id: "inc_2", title: "Elevated API latency", impact: "minor", status: "resolved" } },
  { id: "subprocessor.changed", body: "A subprocessor was added, changed or removed.", data: { subprocessor: "Harbor Vault Backup", change: "planned", effective_on: "2026-12-03" } },
];

function payloadFor(id: string) {
  const e = EVENTS.find((x) => x.id === id) ?? EVENTS[0]!;
  return JSON.stringify({ id: "evt_2Hq7Lm9xT4", type: e.id, created_at: "2026-11-13T09:12:44Z", tenant: "northwind", data: e.data }, null, 2);
}

const okCode = (c: number) => c >= 200 && c < 300;
/** Simulated response time for demo deliveries and tests. */
const latency = (min: number, spread: number) => Math.round(min + Math.random() * spread);
const successRate = (d: WebhookDelivery[]) => (d.length ? Math.round((d.filter((x) => okCode(x.code)).length / d.length) * 100) : 100);

/* ───────── Page ───────── */

export function AdminIntegrations() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={4} table={false} />;
  return <Body />;
}

function Body() {
  const integrations = useTrust((s) => s.integrations);
  const webhooks = useTrust((s) => s.webhooks);
  const [connect, setConnect] = React.useState<{ id: string; fix?: boolean } | null>(null);
  const [manageId, setManageId] = React.useState<string | null>(null);

  const workspace = integrations.find((i) => i.category === "SecureKnots");
  const connected = integrations.filter((i) => i.status === "connected").length;
  const attention = integrations.filter((i) => i.status === "error").length + webhooks.filter((w) => w.status === "failing").length;
  const allDeliveries = webhooks.flatMap((w) => w.deliveries);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Data and integrations"
        title="Integrations"
        description="Connect Northwind's trust center to SecureKnots Workspace, identity providers, alerting and your own security tools. Every change here is recorded in the audit trail."
        actions={
          <Button variant="secondary" asChild>
            <a href="#webhooks">
              <WebhookIcon /> Webhooks
            </a>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Connected" value={String(connected)} footer={`of ${integrations.length} available integrations`} />
        <StatCard label="Needs attention" value={String(attention)} footer={attention ? "An integration or webhook is failing" : "Everything is healthy"} />
        <StatCard label="Webhook success" value={`${successRate(allDeliveries)}%`} footer={`${allDeliveries.length} recent deliveries`} />
        <StatCard label="Workspace sync" value={workspace?.lastSyncAt ? fmt.ago(workspace.lastSyncAt).replace(" ago", "") : "Off"} footer={workspace?.lastSyncAt ? "since the last sync" : "Not connected"} />
      </div>

      {workspace && <WorkspaceCard integration={workspace} />}

      <div className="mt-8 grid grid-cols-1 gap-8">
        {CATEGORIES.map((cat) => {
          const items = integrations.filter((i) => i.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`cat-${cat}`} className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
                  {cat}
                </h2>
                <span className="text-[12.5px] text-muted">{CATEGORY_NOTE[cat]}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((i) => (
                  <IntegrationCard
                    key={i.id}
                    integration={i}
                    onConnect={() => setConnect({ id: i.id })}
                    onFix={() => setConnect({ id: i.id, fix: true })}
                    onManage={() => setManageId(i.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Webhooks />

      <ConnectDialog target={connect} onClose={() => setConnect(null)} />
      <ManageDialog id={manageId} onClose={() => setManageId(null)} />
    </motion.div>
  );
}

/* ───────── SecureKnots Workspace ───────── */

function WorkspaceCard({ integration }: { integration: Integration }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const docs = useTrust((s) => s.documents);
  const [syncing, setSyncing] = React.useState(false);
  const synced = docs.filter((d) => d.source === "workspace").length;

  const sync = async () => {
    setSyncing(true);
    await sleep(1600);
    const at = new Date().toISOString();
    upsert("integrations", { ...integration, status: "connected", lastSyncAt: at });
    addAudit({ actor: "SecureKnots Workspace", action: "Synced documents", target: "SecureKnots Workspace", detail: `${synced} approved documents checked, no changes`, category: "integrations" });
    setSyncing(false);
    toast.success("Sync complete", { description: `${synced} approved documents checked, no changes.` });
  };

  const runs = integration.lastSyncAt
    ? [0, 15, 30].map((m) => ({ at: new Date(new Date(integration.lastSyncAt!).getTime() - m * 60_000).toISOString(), m }))
    : [];

  const rows = [
    { ws: "Approved and marked for the trust center", trust: "Published", vis: "Restricted unless the owner marks it public" },
    { ws: "Approved policy marked public", trust: "Published", vis: "Public" },
    { ws: "New approved version", trust: "Published as the current version", vis: "Same as before; older versions stay available" },
    { ws: "In review, Revise or Waiting on client", trust: "Not published", vis: "Never shared" },
  ];

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-start sm:p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#0b0b0b] ring-1 ring-line">
          <SecureKnotsLogo className="h-7 w-auto" onDark />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{integration.name}</span>
            {integration.status === "connected" ? (
              <Badge tone="success" dot pulse={syncing}>
                {syncing ? "Syncing" : "Connected"}
              </Badge>
            ) : (
              <Badge tone="neutral">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{integration.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            <span>{integration.detail}</span>
            {integration.lastSyncAt && (
              <span>
                Last sync <span className="font-medium text-fg">{fmt.ago(integration.lastSyncAt)}</span>
              </span>
            )}
            <span>
              <span className="font-medium text-fg">{synced}</span> documents came from Workspace
            </span>
          </div>
        </div>
        <Button variant="primary" onClick={sync} disabled={syncing} className="self-start">
          <RefreshCw className={cn(syncing && "animate-spin")} />
          {syncing ? "Syncing" : "Sync now"}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
          <div className="px-4 pb-2 pt-4 text-[12.5px] font-medium text-muted sm:px-5">How Workspace statuses map to the trust center</div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-y border-line bg-raised text-left text-[12px] text-muted dark:bg-transparent">
                  <th className="px-4 py-2 font-medium sm:px-5">In Workspace</th>
                  <th className="px-3 py-2 font-medium">On the trust center</th>
                  <th className="px-4 py-2 font-medium sm:px-5">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ws} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-fg sm:px-5">{r.ws}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-fg">
                        <ArrowRight className="size-3.5 text-faint" />
                        {r.trust}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted sm:px-5">{r.vis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="text-[12.5px] font-medium text-muted">Recent sync runs</div>
          <ul className="mt-2 grid grid-cols-1 gap-2">
            {runs.map((r) => (
              <li key={r.m} className="flex items-center gap-2.5 text-[13px]">
                <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success-fg">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate text-fg">{synced} documents checked, no changes</span>
                <span className="shrink-0 text-[12px] text-muted">{fmt.ago(r.at)}</span>
              </li>
            ))}
            {!runs.length && <li className="text-[13px] text-muted">No sync runs yet.</li>}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">Only documents approved in Workspace can be published here. Internal notes and evidence never leave Workspace.</p>
        </div>
      </div>
    </Card>
  );
}

/* ───────── Catalog card ───────── */

function Monogram({ name, status }: { name: string; status: Integration["status"] }) {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center rounded-[9px] border border-line-strong bg-subtle font-mono text-[12.5px] font-semibold tracking-tight text-fg">
      {MONOGRAM[name] ?? name.slice(0, 2).toUpperCase()}
      {status !== "available" && (
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface", status === "connected" ? "bg-success" : "bg-danger")} aria-hidden />
      )}
    </span>
  );
}

function IntegrationCard({ integration: i, onConnect, onFix, onManage }: { integration: Integration; onConnect: () => void; onFix: () => void; onManage: () => void }) {
  return (
    <motion.div layout className={cn("card flex flex-col p-4", i.status === "error" && "border-danger/40")}>
      <div className="flex items-start gap-3">
        <Monogram name={i.name} status={i.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-semibold text-fg">{i.name}</span>
            {i.status === "connected" && (
              <Badge tone="success" dot>
                Connected
              </Badge>
            )}
            {i.status === "error" && (
              <Badge tone="danger" dot>
                Error
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{i.description}</p>
        </div>
      </div>
      {i.status === "error" && i.detail && (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-danger-soft px-3 py-2 text-[12.5px] text-danger-fg">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span>{i.detail}. Logs are queued and will send once it is fixed.</span>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="min-w-0 truncate text-[12px] text-muted">
          {i.status === "connected" ? (
            <>
              {i.detail}
              {i.lastSyncAt && <> · {fmt.ago(i.lastSyncAt)}</>}
            </>
          ) : i.status === "error" ? (
            i.lastSyncAt ? `Last success ${fmt.ago(i.lastSyncAt)}` : "Not delivering"
          ) : (
            "Not connected"
          )}
        </span>
        {i.status === "available" && (
          <Button size="sm" variant="secondary" onClick={onConnect}>
            Connect
          </Button>
        )}
        {i.status === "connected" && (
          <Button size="sm" variant="ghost" onClick={onManage}>
            Manage
          </Button>
        )}
        {i.status === "error" && (
          <Button size="sm" variant="primary" onClick={onFix}>
            Fix connection
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/* ───────── Connect dialog ───────── */

function ConnectDialog({ target, onClose }: { target: { id: string; fix?: boolean } | null; onClose: () => void }) {
  const integrations = useTrust((s) => s.integrations);
  const integration = target ? integrations.find((i) => i.id === target.id) : undefined;
  return (
    <Dialog open={!!integration} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md">{integration && <ConnectForm key={integration.id + (target?.fix ? "-fix" : "")} integration={integration} fix={!!target?.fix} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ConnectForm({ integration, fix, onClose }: { integration: Integration; fix: boolean; onClose: () => void }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const def = CONNECT[integration.name];
  const initial = React.useMemo(() => {
    const v: Record<string, string> = {};
    def?.fields.forEach((f) => (v[f.key] = f.type === "select" ? (f.options?.[0]?.value ?? "") : ""));
    if (fix && def) Object.assign(v, def.example, { token: "" });
    return v;
  }, [def, fix]);
  const [values, setValues] = React.useState<Record<string, string>>(initial);
  const [touched, setTouched] = React.useState(false);
  const [phase, setPhase] = React.useState<"form" | "connecting" | "done">("form");
  const [step, setStep] = React.useState(0);

  if (!def) {
    return (
      <>
        <DialogHeader title={integration.name} description="This integration is set up by SecureKnots." />
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </>
    );
  }

  const errors = Object.fromEntries(def.fields.map((f) => [f.key, f.validate(values[f.key] ?? "")]));
  const valid = Object.values(errors).every((e) => !e);
  const checks = def.checks(values);

  const run = async () => {
    setTouched(true);
    if (!valid) return;
    setPhase("connecting");
    for (let i = 0; i < checks.length; i++) {
      setStep(i);
      await sleep(550 + i * 150);
    }
    upsert("integrations", { ...integration, status: "connected", detail: def.detail(values), lastSyncAt: new Date().toISOString() });
    addAudit({ action: fix ? "Fixed integration" : "Connected integration", target: integration.name, detail: def.detail(values), category: "integrations" });
    setStep(checks.length);
    setPhase("done");
    toast.success(`${integration.name} ${fix ? "is working again" : "connected"}`, { description: def.detail(values) });
  };

  return (
    <>
      <DialogHeader
        icon={<Monogram name={integration.name} status={phase === "done" ? "connected" : integration.status} />}
        title={phase === "done" ? `${integration.name} is connected` : fix ? `Fix ${integration.name}` : `Connect ${integration.name}`}
        description={fix ? "The current token was rejected with a 401. Paste a new HEC token; queued logs send once the check passes." : integration.description}
      />
      <DialogBody className="grid grid-cols-1 gap-4">
        {phase === "form" && (
          <>
            {def.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`cn-${f.key}`} error={touched ? errors[f.key] : undefined} hint={f.hint}>
                {f.type === "select" ? (
                  <Select ariaLabel={f.label} value={values[f.key] ?? ""} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} options={f.options ?? []} />
                ) : (
                  <Input
                    id={`cn-${f.key}`}
                    type={f.type === "password" ? "password" : "text"}
                    autoComplete="off"
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    aria-invalid={touched && !!errors[f.key]}
                    className={f.key !== "group" && f.key !== "user" ? "font-mono text-[12.5px]" : undefined}
                  />
                )}
              </Field>
            ))}
            {def.readonly?.map((r) => (
              <div key={r.label} className="grid grid-cols-1 gap-1.5">
                <span className="text-[13px] font-medium text-fg">{r.label}</span>
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-raised py-1.5 pl-3 pr-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">{r.value}</span>
                  <CopyButton value={r.value} iconOnly label={`Copy ${r.label.toLowerCase()}`} />
                </div>
              </div>
            ))}
          </>
        )}
        {phase !== "form" && (
          <ol className="grid grid-cols-1 gap-3 py-1">
            {checks.map((c, i) => {
              const done = step > i || phase === "done";
              const current = step === i && phase === "connecting";
              return (
                <li key={c} className="flex items-center gap-3 text-[13.5px]">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", done ? "bg-success text-white dark:text-[#04120f]" : current ? "text-fg" : "text-faint")}>
                    {done ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                        <Check className="size-3.5" strokeWidth={3} />
                      </motion.span>
                    ) : current ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <CircleDashed className="size-4" />
                    )}
                  </span>
                  <span className={cn(done || current ? "text-fg" : "text-muted")}>{c}</span>
                </li>
              );
            })}
          </ol>
        )}
      </DialogBody>
      <DialogFooter className="sm:justify-between">
        {phase === "form" ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setValues({ ...def.example });
                setTouched(false);
              }}
            >
              Use example values
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={run}>
                {fix ? "Check and reconnect" : "Connect"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-[12.5px] text-muted">{phase === "done" ? "Saved. Recorded in the audit trail." : "Checking the connection"}</span>
            <Button variant="primary" onClick={onClose} disabled={phase !== "done"}>
              Done
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}

/* ───────── Manage dialog ───────── */

function ManageDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const integrations = useTrust((s) => s.integrations);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const integration = id ? integrations.find((i) => i.id === id) : undefined;
  const [confirm, setConfirm] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const def = integration ? CONNECT[integration.name] : undefined;

  const disconnect = () => {
    if (!integration) return;
    const prev = useTrust.getState().integrations;
    upsert("integrations", { ...integration, status: "available", detail: undefined, lastSyncAt: undefined });
    addAudit({ action: "Disconnected integration", target: integration.name, category: "integrations" });
    toast(`${integration.name} disconnected`, { action: { label: "Undo", onClick: () => patch({ integrations: prev }) } });
    setConfirm(false);
    onClose();
  };

  const test = async () => {
    if (!integration) return;
    setTesting(true);
    await sleep(900);
    setTesting(false);
    upsert("integrations", { ...integration, lastSyncAt: new Date().toISOString() });
    toast.success(`${def?.testLabel ?? "Test"} sent`, { description: `${integration.name} answered in ${latency(120, 180)} ms.` });
  };

  return (
    <Dialog
      open={!!integration}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setTimeout(() => setConfirm(false), 200);
        }
      }}
    >
      <DialogContent size="md">
        {integration && (
          <>
            <DialogHeader icon={<Monogram name={integration.name} status={integration.status} />} title={integration.name} description={integration.description} />
            <DialogBody>
              <Meta
                items={[
                  { label: "Status", value: <Badge tone="success" dot>Connected</Badge> },
                  { label: "Category", value: integration.category },
                  { label: "Configuration", value: integration.detail ?? "Default" },
                  { label: "Last activity", value: integration.lastSyncAt ? fmt.ago(integration.lastSyncAt) : "None yet" },
                ]}
              />
              <AnimatePresence>
                {confirm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-4 rounded-[8px] bg-danger-soft p-3 text-[13px] text-danger-fg">
                      {integration.category === "Identity"
                        ? "People who sign in through this provider will need an email link until you reconnect it."
                        : "Alerts and exports stop at once. Nothing already delivered is deleted."}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </DialogBody>
            <DialogFooter className="sm:justify-between">
              {confirm ? (
                <>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Keep connected
                  </Button>
                  <Button variant="danger" onClick={disconnect}>
                    Disconnect {integration.name}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="danger-ghost" onClick={() => setConfirm(true)}>
                    Disconnect
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    {def?.testLabel && (
                      <Button variant="secondary" onClick={test} loading={testing}>
                        <Send /> {def.testLabel}
                      </Button>
                    )}
                    <Button variant="primary" onClick={onClose}>
                      Done
                    </Button>
                  </div>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Webhooks ───────── */

function Webhooks() {
  const webhooks = useTrust((s) => s.webhooks);
  const upsert = useTrust((s) => s.upsert);
  const remove = useTrust((s) => s.remove);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [logId, setLogId] = React.useState<string | null>(null);
  const [event, setEvent] = React.useState(EVENTS[0]!.id);

  const sendTest = (w: Webhook) => {
    const ms = latency(90, 180);
    const d: WebhookDelivery = { id: uid("dl"), at: new Date().toISOString(), event: "test.ping", code: 200, ms };
    upsert("webhooks", { ...w, deliveries: [d, ...w.deliveries] });
    toast.success("Test event delivered", { description: `200 OK in ${ms} ms to ${new URL(w.url).host}` });
  };

  const setStatus = (w: Webhook, status: Webhook["status"]) => {
    upsert("webhooks", { ...w, status });
    addAudit({ action: status === "paused" ? "Paused webhook" : "Resumed webhook", target: new URL(w.url).host, category: "integrations" });
    toast(status === "paused" ? "Webhook paused" : "Webhook resumed", { description: status === "paused" ? "Events are held for 24 hours, then dropped." : "Held events are being sent now." });
  };

  const del = (w: Webhook) => {
    const prev = useTrust.getState().webhooks;
    remove("webhooks", w.id);
    addAudit({ action: "Deleted webhook", target: new URL(w.url).host, category: "integrations" });
    toast(`Deleted ${new URL(w.url).host}`, { action: { label: "Undo", onClick: () => patch({ webhooks: prev }) } });
  };

  return (
    <section id="webhooks" aria-labelledby="wh-h" className="mt-10 scroll-mt-20">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="wh-h" className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
            Webhooks
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-muted">
            Signed HTTPS callbacks when something changes. Failed deliveries retry with backoff for 24 hours. Each request carries an <span className="font-mono text-[12px]">SKT-Signature</span> header.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)} className="self-start">
          <Plus /> Add endpoint
        </Button>
      </div>

      <Card className="overflow-hidden">
        {webhooks.length === 0 ? (
          <EmptyState compact title="No endpoints yet" body="Add an HTTPS endpoint to receive events from this trust center." action={<Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>Add endpoint</Button>} />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {webhooks.map((w) => {
                const failed = w.deliveries.slice(0, 5).filter((d) => !okCode(d.code)).length;
                const last = w.deliveries[0];
                return (
                  <motion.li key={w.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="border-b border-line last:border-0">
                    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 max-w-full truncate font-mono text-[13px] text-fg">{w.url}</span>
                          <Badge tone={w.status === "active" ? "success" : w.status === "paused" ? "neutral" : "danger"} dot>
                            {w.status === "active" ? "Active" : w.status === "paused" ? "Paused" : "Failing"}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {w.events.slice(0, 3).map((e) => (
                            <span key={e} className="rounded-[5px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">
                              {e}
                            </span>
                          ))}
                          {w.events.length > 3 && <span className="px-1 font-mono text-[11px] text-faint">+{w.events.length - 3}</span>}
                        </div>
                        {w.status === "failing" && failed > 0 && (
                          <div className="mt-2 flex items-start gap-2 text-[12.5px] text-danger-fg">
                            <CircleAlert className="mt-px size-3.5 shrink-0" />
                            {failed} of the last 5 deliveries failed with {w.deliveries.find((d) => !okCode(d.code))?.code}. Check the endpoint&apos;s signature verification.
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
                        <span>
                          <span className="font-medium text-fg">{successRate(w.deliveries)}%</span> delivered
                        </span>
                        <span>{last ? `Last ${fmt.ago(last.at)}` : "No deliveries"}</span>
                        <span className="font-mono text-[11.5px]">whsec_…{w.secretLast4}</span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setLogId(w.id)}>
                            Deliveries
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => sendTest(w)} disabled={w.status === "paused"}>
                            <Send /> Test
                          </Button>
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${w.url}`}>
                                <Ellipsis />
                              </Button>
                            </MenuTrigger>
                            <MenuContent>
                              {w.status === "paused" ? (
                                <MenuItem onSelect={() => setStatus(w, "active")}>
                                  <Play /> Resume
                                </MenuItem>
                              ) : (
                                <MenuItem onSelect={() => setStatus(w, "paused")}>
                                  <Pause /> Pause
                                </MenuItem>
                              )}
                              <MenuItem
                                onSelect={() => {
                                  const secret = `whsec_${fakeHash(`${w.id}${latency(0, 1e9)}`, 32)}`;
                                  upsert("webhooks", { ...w, secretLast4: secret.slice(-4) });
                                  addAudit({ action: "Rotated webhook secret", target: new URL(w.url).host, category: "integrations" });
                                  toast.success("Signing secret rotated", { description: "The old secret keeps working for 24 hours." });
                                }}
                              >
                                <RotateCcw /> Rotate signing secret
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem danger onSelect={() => del(w)}>
                                <Trash2 /> Delete endpoint
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <Card className="mt-4 min-w-0 overflow-hidden">
        <CardHeader title="Event catalog" description="Every event has the same envelope: id, type, created_at, tenant and data." />
        <div className="mt-3 grid grid-cols-1 border-t border-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="min-w-0 border-b border-line p-2 lg:border-b-0 lg:border-r">
            {EVENTS.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setEvent(e.id)}
                  className={cn("flex w-full flex-col items-start rounded-[8px] px-3 py-2 text-left transition-colors", event === e.id ? "bg-subtle" : "hover:bg-subtle/60")}
                >
                  <span className="font-mono text-[12.5px] text-fg">{e.id}</span>
                  <span className="text-[12px] text-muted">{e.body}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 p-4">
            <CodeViewer code={payloadFor(event)} title={`POST · ${event}`} maxHeight={360} />
            <p className="mt-2 text-[12px] text-muted">Verify the signature with HMAC-SHA256 of the raw body and your endpoint secret. Respond with any 2xx within 10 seconds.</p>
          </div>
        </div>
      </Card>

      <CreateWebhookDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeliveriesSheet id={logId} onClose={() => setLogId(null)} />
    </section>
  );
}

function CreateWebhookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>(["access.request.created", "document.published"]);
  const [touched, setTouched] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);

  const urlError = !HTTPS.test(url.trim()) ? "Use an HTTPS URL that is reachable from the internet." : /localhost|127\.0\.0\.1/.test(url) ? "Local addresses can't receive events." : null;
  const evError = events.length ? null : "Pick at least one event.";

  const reset = () => {
    setUrl("");
    setEvents(["access.request.created", "document.published"]);
    setTouched(false);
    setSecret(null);
  };

  const create = () => {
    setTouched(true);
    if (urlError || evError) return;
    const s = `whsec_${fakeHash(`${url}${latency(0, 1e9)}`, 32)}`;
    upsert("webhooks", { id: uid("wh"), url: url.trim(), events, status: "active", createdAt: new Date().toISOString(), secretLast4: s.slice(-4), deliveries: [] });
    addAudit({ action: "Created webhook", target: new URL(url.trim()).host, detail: `${events.length} events`, category: "integrations" });
    setSecret(s);
    toast.success("Endpoint added", { description: "Send a test event to check it." });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="md">
        {secret ? (
          <>
            <DialogHeader title="Copy the signing secret" description="This is the only time the full secret is shown. Store it where your endpoint can read it." />
            <DialogBody className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-2 rounded-[8px] border border-line-strong bg-raised py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-fg">{secret}</span>
                <CopyButton value={secret} label="Copy" toastText="Signing secret copied" />
              </div>
              <div className="rounded-[8px] bg-warning-soft px-3 py-2 text-[12.5px] text-warning-fg">You won&apos;t see this secret again. If you lose it, rotate it from the endpoint menu.</div>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader title="Add webhook endpoint" description="Choose which events to send. You can change them later." />
            <DialogBody className="grid grid-cols-1 gap-4">
              <Field label="Endpoint URL" htmlFor="wh-url" error={touched ? urlError : undefined}>
                <Input id="wh-url" placeholder="https://hooks.example.com/trust-center" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-[12.5px]" aria-invalid={touched && !!urlError} />
              </Field>
              <div className="grid grid-cols-1 gap-1.5">
                <span className="text-[13px] font-medium text-fg">Events</span>
                <div className="grid grid-cols-1 gap-1 rounded-[8px] border border-line p-1.5">
                  {EVENTS.map((e) => {
                    const on = events.includes(e.id);
                    return (
                      <label key={e.id} className="flex cursor-pointer items-start gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-subtle">
                        <Checkbox className="mt-0.5" checked={on} onCheckedChange={(v) => setEvents((s) => (v ? [...s, e.id] : s.filter((x) => x !== e.id)))} aria-label={e.id} />
                        <span className="min-w-0">
                          <span className="block font-mono text-[12px] text-fg">{e.id}</span>
                          <span className="block text-[12px] text-muted">{e.body}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {touched && evError && <p className="text-[12.5px] text-danger-fg">{evError}</p>}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={create}>
                Add endpoint
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const webhooks = useTrust((s) => s.webhooks);
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const w = id ? webhooks.find((x) => x.id === id) : undefined;
  const [retrying, setRetrying] = React.useState<string | null>(null);

  const retry = async (ids: string[]) => {
    if (!w) return;
    setRetrying(ids.length > 1 ? "all" : ids[0]!);
    await sleep(700);
    const fresh = useTrust.getState().webhooks.find((x) => x.id === w.id);
    if (!fresh) return;
    const deliveries = fresh.deliveries.map((d) => (ids.includes(d.id) ? { ...d, id: uid("dl"), at: new Date().toISOString(), code: 200, ms: latency(90, 160) } : d));
    const stillFailing = deliveries.slice(0, 5).some((d) => !okCode(d.code));
    upsert("webhooks", { ...fresh, deliveries, status: fresh.status === "failing" && !stillFailing ? "active" : fresh.status });
    addAudit({ action: "Retried webhook deliveries", target: new URL(fresh.url).host, detail: `${ids.length} ${ids.length === 1 ? "delivery" : "deliveries"}`, category: "integrations" });
    setRetrying(null);
    toast.success(`${ids.length} ${ids.length === 1 ? "delivery" : "deliveries"} sent`, { description: "200 OK. The endpoint is accepting events again." });
  };

  const failed = w?.deliveries.filter((d) => !okCode(d.code)) ?? [];

  return (
    <Sheet open={!!w} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={600}>
        {w && (
          <>
            <SheetHeader title="Deliveries" description={w.url} />
            <SheetBody className="p-0">
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-5 py-3 text-[12.5px] text-muted">
                <span>
                  <span className="font-medium text-fg">{successRate(w.deliveries)}%</span> delivered
                </span>
                <span>
                  <span className="font-medium text-fg">{failed.length}</span> failed
                </span>
                <span>
                  Median{" "}
                  <span className="font-medium text-fg">
                    {w.deliveries.length ? [...w.deliveries].map((d) => d.ms).sort((a, b) => a - b)[Math.floor(w.deliveries.length / 2)] : 0} ms
                  </span>
                </span>
              </div>
              {w.deliveries.length === 0 ? (
                <EmptyState compact title="No deliveries yet" body="Send a test event from the endpoint list." />
              ) : (
                <ul>
                  {w.deliveries.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                      <span
                        className={cn(
                          "inline-flex h-5 w-11 shrink-0 items-center justify-center rounded-[5px] font-mono text-[11px] font-semibold",
                          okCode(d.code) ? "bg-success-soft text-success-fg" : "bg-danger-soft text-danger-fg",
                        )}
                      >
                        {d.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[12.5px] text-fg">{d.event}</div>
                        <div className="text-[12px] text-muted">
                          {fmt.day(d.at)} · {d.ms} ms
                        </div>
                      </div>
                      {!okCode(d.code) && (
                        <Button size="xs" variant="secondary" loading={retrying === d.id} onClick={() => retry([d.id])}>
                          Retry
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SheetBody>
            <SheetFooter className="justify-between">
              <span className="text-[12px] text-muted">Deliveries are kept for 30 days.</span>
              {failed.length > 0 ? (
                <Button variant="primary" loading={retrying === "all"} onClick={() => retry(failed.map((d) => d.id))}>
                  Retry {failed.length} failed
                </Button>
              ) : (
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
