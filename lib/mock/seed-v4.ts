import type { Automation, AutomationRun } from "@/lib/types";
import { DAY, HOUR, mulberry32 } from "@/lib/utils";

/* Rules that replace routine manual work. All data is fictional. */
const LIST: Omit<Automation, "id">[] = [
  { name: "Approve agency domains automatically", category: "access", trigger: "Access request received", condition: "Email matches an enabled allowlist rule", actions: ["Approve for the rule's access length", "Email a sign-in link", "Post to #trust-center-alerts"], enabled: true, runs: 41, minutesPerRun: 6, createdBy: "Seema Abdul" },
  { name: "Remind reviewers before access ends", category: "access", trigger: "Reviewer access ends in 14 days", condition: "Reviewer was active in the last 30 days", actions: ["Email the reviewer a \"request more time\" link", "Notify Northwind admins"], enabled: true, runs: 23, minutesPerRun: 4, createdBy: "Hannah Cole" },
  { name: "Publish documents approved in Workspace", category: "documents", trigger: "Document approved in SecureKnots Workspace", condition: "Client is on the Trust plan", actions: ["Publish to the trust center as restricted", "Regenerate and validate the package JSON", "Notify subscribers to document updates"], enabled: true, runs: 18, minutesPerRun: 25, createdBy: "Seema Abdul" },
  { name: "Handle a failing KSI check", category: "monitoring", trigger: "A KSI check fails in the daily run", actions: ["Alert the security team in Slack", "Draft a POA&M entry with the failing check", "Draft a status notice for review"], enabled: true, runs: 2, minutesPerRun: 45, createdBy: "Hannah Cole" },
  { name: "Ask owners for annual policy review", category: "documents", trigger: "Policy version is 11 months old", actions: ["Create a review task in Workspace for the owner", "Remind weekly until a new version is approved"], enabled: true, runs: 6, minutesPerRun: 10, createdBy: "Luis Ortega" },
  { name: "Pre-answer uploaded questionnaires", category: "questionnaires", trigger: "Agency questionnaire uploaded", actions: ["Match answers from the Q&A library", "Draft the rest from published documents, with citations", "Assign review to the owner of each answer"], enabled: true, runs: 4, minutesPerRun: 240, createdBy: "Seema Abdul" },
  { name: "Retire unused API keys", category: "access", trigger: "API key unused for 90 days", actions: ["Email the agency contact", "Revoke the key after 30 more days without use"], enabled: true, runs: 1, minutesPerRun: 8, createdBy: "Seema Abdul" },
  { name: "Monthly snapshot and trust digest", category: "reporting", trigger: "1st of every month, 2:00 AM", actions: ["Take a package snapshot", "Email Northwind leadership a one-page digest: views, downloads, KSI pass rate, open requests"], enabled: true, runs: 6, minutesPerRun: 60, createdBy: "Seema Abdul" },
  { name: "Answer repeat questions from the trust page", category: "questionnaires", trigger: "Question asked on the trust page", condition: "A library answer matches strongly", actions: ["Draft the reply from the library answer", "Send after an admin approves it"], enabled: false, runs: 0, minutesPerRun: 12, createdBy: "Luis Ortega" },
];

export function seedAutomations(now: number): { automations: Automation[]; runs: AutomationRun[] } {
  const r = mulberry32(8080);
  const automations = LIST.map((a, i) => ({ ...a, id: `auto_${i + 1}`, lastRunAt: a.runs ? new Date(now - (i * 7 + 2) * HOUR - Math.floor(r() * 20) * HOUR).toISOString() : undefined }));
  const samples: Record<string, string[]> = {
    auto_1: ["Approved Jordan Ellis (DLRO) for 90 days", "Approved Grace Kim (FHRO) for 90 days", "Approved Owen Hartley (Keystone) for 30 days, package only"],
    auto_2: ["Reminded Lena Fischer (FWDS): access ends in 14 days", "Reminded Owen Hartley (Keystone): access ends in 14 days"],
    auto_3: ["Published KSI Validation Summary v3.0; JSON revision 41 valid; 34 subscribers notified", "Published Plan of Action and Milestones v14.0; JSON revision 40 valid; 34 subscribers notified"],
    auto_4: ["KSI-MLA-05 failed: drafted POA&M-064 and a status notice; alerted #security"],
    auto_5: ["Asked Luis Ortega to review the Acceptable Use Policy (11 months old)"],
    auto_6: ["OFSA vendor security questionnaire: 14 of 18 answered from the library, 4 drafted from documents"],
    auto_7: ["Emailed FWDS: key 'FWDS GRC sync' unused for 90 days (skipped: used yesterday)"],
    auto_8: ["Snapshot taken; digest emailed to 3 Northwind leaders"],
  };
  const runs: AutomationRun[] = [];
  let k = 0;
  for (const a of automations) {
    const list = samples[a.id];
    if (!list) continue;
    const count = Math.min(a.runs, 4);
    for (let i = 0; i < count; i++) {
      const skipped = a.id === "auto_7";
      runs.push({
        id: `run_${++k}`,
        automationId: a.id,
        at: new Date(now - (i * 5 + (k % 7)) * DAY - Math.floor(r() * 10) * HOUR).toISOString(),
        summary: list[i % list.length]!,
        result: skipped ? "skipped" : "success",
        ms: Math.round(400 + r() * 2600),
      });
    }
  }
  runs.sort((a, b) => b.at.localeCompare(a.at));
  return { automations, runs };
}
