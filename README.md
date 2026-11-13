# SecureKnots Trust (front-end demo)

A clickable demo of the SecureKnots trust center. Certified clients publish their FedRAMP 20x package, audit reports and policies to their own trust page. Agencies request access, approved reviewers download documents, and agency systems read a machine-readable package JSON and an API. Every access is logged for six months.

This is front end only, with mock data. There is no backend, real authentication, file storage or real schema validation. All companies, agencies and people are fictional.

## Run it

```bash
npm install
npm run dev -- -p 3040
```

Open http://localhost:3040. It redirects to the public trust page.

## Routes

| Route | Who | What |
|---|---|---|
| `/t/northwind` | Public | Trust page. Hero with the FedRAMP credential card and a package fingerprint you can verify; key figures; compliance ledger and assessment timeline; KSI dashboard (checks passing, automation coverage, last validated, 30-day trend); document library with a request basket; searchable security Q&A, pre-answered CAIQ v4 and SIG Lite, and an "Ask Northwind" form; subprocessors; service status with 90-day uptime; machine-readable package and API; updates feed with email subscription; access steps and contacts |
| `/t/northwind/portal` | Reviewer | Documents (viewer with page thumbnails and a watermark preview, versions, download), KSI dashboard, CAIQ and SIG Lite with spreadsheet download; "New since your last visit"; watchlist; access summary and a "Request more time" form; agency API key; the agency's questionnaires; "Ask Northwind"; email preferences; the reviewer's own access history |
| `/admin/analytics` | Admin | Access funnel (page views → requests → approvals → active → downloads), top agencies with engagement scores, weekday activity, most-read and unopened documents |
| `/login` | Admin | Sign in (Microsoft 365 or email), then a 6-digit MFA code |
| `/admin` | Admin | KPIs, a "Needs attention" list across every module, access over time, top documents, recent access, JSON and domain status |
| `/admin/documents` | Admin | Documents table, upload drawer, bulk visibility. `/admin/documents/[id]` has the version timeline and preview |
| `/admin/access` | Admin | Requests (including which documents were asked for), auto-approval rules, reviewer inventory, NDA records (click-wrap signatures, versions, re-sign) |
| `/admin/logs` | Admin | Access log, 6-month retention, per-agency summaries, CSV export |
| `/admin/updates` | Admin | Notices (significant changes, incidents, maintenance, documents, subprocessors) with a composer, scheduling, previews and open rates; subscriber management |
| `/admin/questionnaires` | Admin | Agency security questionnaires answered from the Q&A library: upload, auto-match, review, export, send; Q&A library; CAIQ and SIG Lite answer library; inbox for questions from the trust page |
| `/admin/subprocessors` | Admin | Subprocessor list with 30-day notice workflow |
| `/admin/status` | Admin | Component status, incidents and maintenance with lifecycle updates |
| `/admin/machine-readable` | Admin | Published JSON, Regenerate & validate, diff against the last snapshot, validation checks |
| `/admin/api` | Admin | API keys, playground (send real requests against the demo data), request log, endpoint reference |
| `/admin/integrations` | Admin | SecureKnots Workspace sync, identity (Entra ID, Login.gov, Okta), Slack and Teams, Splunk, S3 or syslog export, ServiceNow GRC; webhooks with delivery log and retries |
| `/admin/snapshots` | Admin | Snapshot timeline with a "Notify subscribers" step, restore, backup status, export all client data |
| `/admin/audit` | Admin | Tamper-evident trail of admin activity, with chain verification |
| `/admin/settings` | Admin | Branding with live preview, custom domain wizard, security, client admins with Viewer / Editor / Admin roles and a permissions matrix |
| `/platform` | SecureKnots staff | All client trust centers with plan usage and health, and the New trust center wizard |

The floating **View as** switcher at the bottom moves between Public, Reviewer and Admin. Its menu has the platform view, the theme and **Reset demo data**.

In production, `proxy.ts` rewrites a client's own domain (for example `trust.northwindcloud.com`) to its tenant route. The demo uses the `/t/<tenant>` paths directly.

## Demo flows

1. **Request, approve, review.** On `/t/northwind`, use Request access with a non-government email, then Admin › Access › Approve, then View as Reviewer. A `.gov` or `.mil` address matches the default allowlist and is approved at once.
2. **Upload, then regenerate.** Admin › Documents › Upload document, then "Use a sample file" and Publish. Machine-readable shows the change as unpublished; Regenerate & validate fixes that, and the diff shows the new document.
3. **Custom domain.** Admin › Settings › Custom domain › Connect a different domain. The wizard steps are enter, add CNAME, pending, check now, verified.
4. **Request specific documents.** On the trust page, use "Add to request" on restricted documents, then "Request these documents". Admin › Access shows exactly which ones were asked for.
5. **Ask a question.** Trust page › Security Q&A › Ask Northwind. The question lands in Admin › Q&A and questionnaires › Inbox, where it can be answered and added to the library.
6. **Answer a questionnaire.** Admin › Q&A and questionnaires › Upload questionnaire › Use a sample, then review the matched answers, approve, export and mark as sent.
7. **Sign the NDA.** Request access on the trust page: read the terms, type your full name to sign. Admin › Access › NDA records shows the signature, version and IP.
8. **Try the API.** Admin › API › Playground: pick a key and an endpoint and send. A revoked key returns 401 and a missing scope returns 403.

Changes are kept in the browser's localStorage (zustand persist) and survive a reload. Reset demo data restores the seeded state.

## Stack

Next.js 16.3.6 (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4, Radix (via `radix-ui`) with components restyled in `components/ui`, motion, cmdk, sonner, vaul, TanStack Table v8, zustand, date-fns, next-themes, lucide-react, recharts. Fonts: Geist, Geist Mono, Instrument Serif.

The design tokens are in `app/globals.css`. Light mode uses warm paper and cobalt; dark mode is neutral black, gray and white. The client's accent color appears on its own trust page and portal. Mock data is in `lib/mock` (seeded, so it is stable) and app state is in `lib/store.ts`.

## Copy rules

Never say "FedRAMP approved", and never imply SecureKnots or the trust center grants certification; it is a managed information-sharing service. Use US spelling and plain, specific wording.
