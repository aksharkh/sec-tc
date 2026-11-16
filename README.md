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
| `/t/northwind` | Public | Trust page. "Ask this trust center": answers quoted from published documents with the document and section; a restricted section is named, not shown, with a one-click request for that document; hero with the FedRAMP credential card and a package fingerprint you can verify; key figures; compliance ledger and assessment timeline; KSI dashboard (checks passing, automation coverage, last validated, 30-day trend); document library with a request basket; searchable security Q&A, pre-answered CAIQ v4 and SIG Lite, and an "Ask Northwind" form; subprocessors; service status with 90-day uptime; machine-readable package and API; updates feed with email subscription; access steps and contacts |
| `/t/northwind/portal` | Reviewer | Ask box with full answers from every document the reviewer can open; Documents (viewer with page thumbnails and a watermark preview, versions, download), KSI dashboard, CAIQ and SIG Lite with spreadsheet download; "New since your last visit"; watchlist; access summary and a "Request more time" form; agency API key; the agency's questionnaires; "Ask Northwind"; email preferences; the reviewer's own access history |
| `/admin/automations` | Admin | "When X, do Y" rules for approvals, reminders, publishing, validation and reporting, with run history, a rule builder and hours saved |
| `/admin/analytics` | Admin | Access funnel (page views → requests → approvals → active → downloads), top agencies with engagement scores, weekday activity, most-read and unopened documents |
| `/login` | Admin | Sign in (Microsoft 365 or email), then a 6-digit MFA code |
| `/admin` | Admin | KPIs, **Trust center health** (package completeness, KSIs, documents on schedule, answers with evidence, request speed, NDA coverage) in seven chart styles, Autopilot (one-click routine work), a "Needs attention" list, access over time (bars or 3D), top documents, recent access, JSON and domain status |
| `/admin/documents` | Admin | Documents table, upload drawer, bulk visibility. `/admin/documents/[id]` has the version timeline and preview |
| `/admin/access` | Admin | Requests with triage suggestions (approve for 1 year / 90 days, approve for 30 days, or review by hand, each with its reason) and **Accept all suggestions**; auto-approval rules, reviewer inventory, NDA records (click-wrap signatures, versions, re-sign) |
| `/admin/logs` | Admin | Access log, 6-month retention, per-agency summaries, CSV export |
| `/admin/updates` | Admin | Notices (significant changes, incidents, maintenance, documents, subprocessors) with a composer, scheduling, previews and open rates; subscriber management |
| `/admin/questionnaires` | Admin | Agency security questionnaires answered from the Q&A library: upload, auto-match, review, export, send; Q&A library; CAIQ and SIG Lite answer library; inbox for questions from the trust page |
| `/admin/subprocessors` | Admin | Subprocessor list with 30-day notice workflow |
| `/admin/status` | Admin | Component status, incidents and maintenance with lifecycle updates |
| `/admin/machine-readable` | Admin | **Package completeness** check (overview JSON valid and current, each expected document uploaded and within its refresh period, with a fix button per gap), published JSON, Regenerate & validate, diff against the last snapshot, validation checks |
| `/admin/api` | Admin | API keys, playground (send real requests against the demo data), request log, endpoint reference |
| `/admin/integrations` | Admin | SecureKnots Workspace sync, identity (Entra ID, Login.gov, Okta), Slack and Teams, Splunk, S3 or syslog export, ServiceNow GRC; webhooks with delivery log and retries |
| `/admin/snapshots` | Admin | Snapshot timeline; the snapshot dialog writes the subscriber notice from what changed since the last snapshot (new versions, added documents, JSON revision, subprocessors, KSIs, incidents) and flags package gaps; restore, backup status, export all client data |
| `/admin/audit` | Admin | Tamper-evident trail of admin activity, with chain verification |
| `/admin/settings` | Admin | Branding with live preview, custom domain wizard, security, client admins with Viewer / Editor / Admin roles and a permissions matrix |
| `/platform` | SecureKnots staff | All client trust centers with plan usage and health, and the New trust center wizard |

The **design switcher** in the top bar (admin, trust page, portal and sign-in) has the same seven designs as SecureKnots Workspace: Meridian (matches secureknots.com, the default), Mono, Boardroom, Aurora, Brutal, Spatial and Nocturne. Hover it to see live previews of all seven and click one to switch; clicking the button itself moves to the next design. The switch uses a circular reveal from the click point. Boardroom, Aurora and Brutal are light only and Spatial and Nocturne are dark only, so the theme toggle is disabled while they are active. The choice is saved in the browser. The Trust center health chart on the overview follows the design (editorial, dot matrix, classic bars, rings, blocks, 3D towers, neon bars), and its menu can override it. Ctrl K also lists the designs.

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
9. **Let Autopilot work.** Admin › Overview › Autopilot › Apply all: low-risk requests are approved, risky ones denied, expiring active reviewers extended, matched answers approved.
10. **Upload with checks.** Admin › Documents › Upload › Use a sample file: the app fills in section, summary and KSI tags, then highlights IP addresses, internal hostnames, personal emails and cloud account IDs in the text. Choose Redact or Keep for each; both choices go to the audit trail.
11. **Ask the documents.** On the trust page, ask "Is data encrypted at rest?" (quoted from the Information Security Policy, §4.2) and then "What is the recovery time objective?" (restricted: the answer names the BCDR plan, §2.1, and Request access opens with that document selected). View as Reviewer and ask again in the portal to see the full text.
12. **Triage in one click.** Admin › Access: the Triage suggestions panel proposes a decision for each pending request with its reason. Accept all suggestions approves the safe ones with the suggested expiry and leaves the risky one for you; Undo is in the toast.
13. **Snapshot with a written notice.** Admin › Snapshots › Take snapshot now: the notice lists the changes since the last snapshot, ready to send. Edit it if you like; "Rewrite from changes" restores it.
14. **Find package gaps.** Admin › Machine-readable › Package completeness lists what is missing or out of date (the demo is missing the SDR) with a fix button for each.
15. **Switch designs.** Hover the design button in the top bar and click Spatial or Nocturne, then open the overview to see the chart follow.

Changes are kept in the browser's localStorage (zustand persist) and survive a reload. Reset demo data restores the seeded state.

## Stack

Next.js 16.3.6 (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4, Radix (via `radix-ui`) with components restyled in `components/ui`, motion, cmdk, sonner, vaul, TanStack Table v8, zustand, date-fns, next-themes, lucide-react, recharts. Fonts: Geist, Geist Mono, Instrument Serif.

The design tokens are in `app/globals.css`; the seven designs are token sets in `app/designs.css` (shared with Workspace), selected by `data-design` on `<html>`. Light mode uses warm paper and cobalt; dark mode is neutral black, gray and white. The client's accent color appears on its own trust page and portal. Mock data is in `lib/mock` (seeded, so it is stable) and app state is in `lib/store.ts`.

## Copy rules

Never say "FedRAMP approved", and never imply SecureKnots or the trust center grants certification; it is a managed information-sharing service. Use US spelling and plain, specific wording.
