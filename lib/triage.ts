import type { AccessLength, AccessRequest, Rule } from "@/lib/types";
import { domainMatches, emailDomain } from "@/lib/utils";
import { AGENCIES } from "@/lib/mock/catalog";

const PERSONAL = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "aol.com"];
const DISPOSABLE = ["mailinator.com", "mailbox-temp.net", "tempmail.com", "10minutemail.com", "guerrillamail.com"];
const COMPETITIVE = /compar|competit|vendor selection|evaluat(e|ing) vendors|research for a client/i;

export type Risk = { score: number; level: "low" | "medium" | "high"; reasons: { text: string; weight: number }[] };

/** Explainable risk score for an access request (0 = safe, 100 = risky). */
export function scoreRequest(r: AccessRequest, rules: Rule[], history: AccessRequest[]): Risk {
  const d = emailDomain(r.email);
  const reasons: Risk["reasons"] = [];
  const add = (text: string, weight: number) => reasons.push({ text, weight });
  if (d.endsWith(".gov") || d.endsWith(".mil")) add("Government email domain", -35);
  const agency = AGENCIES.find((a) => a.domain && (d === a.domain || d.endsWith(`.${a.domain}`)));
  if (agency && agency.kind !== "agency") add(`Known ${agency.kind === "assessor" ? "assessor" : "partner"}: ${agency.name}`, -20);
  if (rules.some((x) => domainMatches(x.domain, d))) add("Domain is on the allowlist (rule may be paused)", -10);
  const prior = history.filter((h) => h.id !== r.id && emailDomain(h.email) === d);
  if (prior.some((h) => h.status === "approved")) add(`${prior.filter((h) => h.status === "approved").length} earlier approvals from ${d}`, -15);
  if (prior.some((h) => h.status === "denied")) add(`Earlier request from ${d} was denied`, 20);
  if (PERSONAL.includes(d)) add("Personal email address", 35);
  if (DISPOSABLE.includes(d)) add("Disposable email address", 60);
  if (!r.nda) add("NDA not accepted", 25);
  if (r.purpose.trim().length < 25) add("Very short purpose", 12);
  if (COMPETITIVE.test(r.purpose)) add("Purpose suggests vendor comparison", 25);
  if (r.organization.toLowerCase().includes("independent")) add("No organization given", 10);
  const score = Math.max(0, Math.min(100, 40 + reasons.reduce((a, x) => a + x.weight, 0)));
  return { score, level: score < 35 ? "low" : score < 65 ? "medium" : "high", reasons: reasons.sort((a, b) => b.weight - a.weight) };
}

export type Suggestion = {
  action: "approve" | "approve-expiry" | "review";
  length?: AccessLength;
  label: string;
  why: string;
};

/** What a careful reviewer would most likely do with this request. Never applied without a click. */
export function suggestFor(r: AccessRequest, risk: Risk): Suggestion {
  const d = emailDomain(r.email);
  const gov = d.endsWith(".gov") || d.endsWith(".mil");
  const worst = risk.reasons.find((x) => x.weight > 0);
  const best = [...risk.reasons].reverse().find((x) => x.weight < 0);
  if (risk.level === "low")
    return { action: "approve", length: gov ? "1y" : "90d", label: gov ? "Approve for 1 year" : "Approve for 90 days", why: best?.text ?? "No risk signals" };
  if (risk.level === "medium")
    return { action: "approve-expiry", length: "30d", label: "Approve for 30 days", why: worst ? `${worst.text}; a short expiry limits exposure` : "Unknown organization and no history; a short expiry limits exposure" };
  return { action: "review", label: "Review by hand", why: worst?.text ?? "High risk score" };
}
