"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Ban, Braces, Check, Clock3, MessagesSquare, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { effectiveStatus, useTrust } from "@/lib/store";
import { scoreRequest } from "@/lib/triage";
import type { Faq } from "@/lib/types";
import { nowMs, sleep } from "@/lib/utils";

type Suggestion = { id: string; icon: React.ElementType; title: string; detail: string; minutes: number; apply: () => void };

function bestFaq(question: string, faqs: Faq[]) {
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  let best: { f: Faq; s: number } | null = null;
  for (const f of faqs) {
    const t = `${f.question} ${f.answer}`.toLowerCase();
    const s = words.filter((w) => t.includes(w)).length / Math.max(1, words.length);
    if (!best || s > best.s) best = { f, s };
  }
  return best && best.s >= 0.4 ? best.f : null;
}

/** One-click suggestions computed from live data: the routine work an admin would otherwise do by hand. */
export function Autopilot() {
  const requests = useTrust((s) => s.requests);
  const rules = useTrust((s) => s.rules);
  const reviewers = useTrust((s) => s.reviewers);
  const logs = useTrust((s) => s.logs);
  const pkg = useTrust((s) => s.pkg);
  const publicQuestions = useTrust((s) => s.publicQuestions);
  const faqs = useTrust((s) => s.faqs);
  const questionnaires = useTrust((s) => s.questionnaires);
  const [busy, setBusy] = React.useState<string | null>(null);

  const suggestions = React.useMemo<Suggestion[]>(() => {
    const st = () => useTrust.getState();
    const out: Suggestion[] = [];
    const pending = requests.filter((r) => r.status === "pending");
    const scored = pending.map((r) => ({ r, risk: scoreRequest(r, rules, requests) }));
    const low = scored.filter((x) => x.risk.level === "low");
    const high = scored.filter((x) => x.risk.level === "high");
    if (low.length)
      out.push({
        id: "approve-low",
        icon: UserCheck,
        title: `Approve ${low.length} low-risk ${low.length === 1 ? "request" : "requests"}`,
        detail: low.map((x) => `${x.r.name} (${x.risk.reasons[0]?.text.toLowerCase() ?? "low risk"})`).join(", "),
        minutes: low.length * 6,
        apply: () => low.forEach((x) => st().approveRequest(x.r.id, "90d")),
      });
    if (high.length)
      out.push({
        id: "deny-high",
        icon: Ban,
        title: `Deny ${high.length} high-risk ${high.length === 1 ? "request" : "requests"}`,
        detail: high.map((x) => `${x.r.name}: ${x.risk.reasons.slice(0, 2).map((r) => r.text.toLowerCase()).join(", ")}`).join("; "),
        minutes: high.length * 5,
        apply: () => high.forEach((x) => st().denyRequest(x.r.id, "Please request again with your work email and a short description of the agency review you are supporting.")),
      });
    const now = nowMs();
    const expiring = reviewers.filter(
      (r) =>
        effectiveStatus(r) === "active" &&
        r.kind === "person" &&
        r.expiresAt &&
        new Date(r.expiresAt).getTime() - now < 14 * 86400000 &&
        logs.some((e) => e.handle === r.handle && now - new Date(e.at).getTime() < 30 * 86400000),
    );
    if (expiring.length)
      out.push({
        id: "extend",
        icon: Clock3,
        title: `Extend ${expiring.length} active ${expiring.length === 1 ? "reviewer" : "reviewers"} by 90 days`,
        detail: `${expiring.map((r) => r.name).join(", ")}: still using the portal, access ends within 14 days`,
        minutes: expiring.length * 4,
        apply: () => expiring.forEach((r) => st().extendReviewer(r.id, "90d")),
      });
    if (pkg.status === "stale")
      out.push({ id: "pkg", icon: Braces, title: "Regenerate and validate the package JSON", detail: "Documents changed since the last revision", minutes: 15, apply: () => st().regeneratePackage() });
    const answerable = publicQuestions.filter((q) => q.status === "open").map((q) => ({ q, f: bestFaq(q.question, faqs.filter((f) => f.public)) })).filter((x) => x.f);
    if (answerable.length)
      out.push({
        id: "answers",
        icon: MessagesSquare,
        title: `Send ${answerable.length} drafted ${answerable.length === 1 ? "answer" : "answers"} to trust page questions`,
        detail: answerable.map((x) => `"${x.q.question.slice(0, 60)}${x.q.question.length > 60 ? "…" : ""}" ← ${x.f!.question}`).join("; "),
        minutes: answerable.length * 12,
        apply: () =>
          st().patch({
            publicQuestions: st().publicQuestions.map((q) => {
              const hit = answerable.find((x) => x.q.id === q.id);
              return hit ? { ...q, status: "answered", answer: hit.f!.answer, answeredAt: new Date().toISOString() } : q;
            }),
          }),
      });
    const matched = questionnaires.filter((q) => q.status !== "sent").flatMap((q) => q.items.filter((i) => i.state === "matched").map(() => q.id));
    if (matched.length)
      out.push({
        id: "qn",
        icon: Check,
        title: `Approve ${matched.length} questionnaire answers matched from the library`,
        detail: `${new Set(matched).size} open ${new Set(matched).size === 1 ? "questionnaire" : "questionnaires"}; edited and unanswered items stay for review`,
        minutes: Math.round(matched.length * 2.5),
        apply: () =>
          st().patch({
            questionnaires: st().questionnaires.map((q) => (q.status === "sent" ? q : { ...q, status: q.status === "new" ? "in_progress" : q.status, items: q.items.map((i) => (i.state === "matched" ? { ...i, state: "approved" } : i)) })),
          }),
      });
    return out;
  }, [requests, rules, reviewers, logs, pkg, publicQuestions, faqs, questionnaires]);

  const total = suggestions.reduce((a, s) => a + s.minutes, 0);

  const run = async (s: Suggestion) => {
    setBusy(s.id);
    await sleep(450);
    s.apply();
    useTrust.getState().addAudit({ action: "Applied Autopilot suggestion", target: s.title, category: "settings" });
    setBusy(null);
    toast.success(s.title, { description: `Done. Saved about ${s.minutes} minutes.` });
  };
  const runAll = async () => {
    setBusy("all");
    for (const s of suggestions) {
      await sleep(300);
      s.apply();
    }
    useTrust.getState().addAudit({ action: "Applied all Autopilot suggestions", target: `${suggestions.length} suggestions`, category: "settings" });
    setBusy(null);
    toast.success(`Applied ${suggestions.length} suggestions`, { description: `Saved about ${total} minutes of manual work.` });
  };

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fg text-inverse">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg">Autopilot</div>
          <div className="text-[12.5px] text-muted">
            {suggestions.length
              ? `${suggestions.length} routine ${suggestions.length === 1 ? "task" : "tasks"} found in today's data. About ${total} minutes of work, one click each.`
              : "Nothing routine is waiting. New suggestions appear as requests, questions and documents come in."}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/automations">Automations</Link>
          </Button>
          {suggestions.length > 1 && (
            <Button size="sm" variant="primary" onClick={runAll} loading={busy === "all"}>
              Apply all ({suggestions.length})
            </Button>
          )}
        </div>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {suggestions.map((s) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-muted">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-fg">{s.title}</div>
                <div className="truncate text-[12.5px] text-muted" title={s.detail}>
                  {s.detail}
                </div>
              </div>
              <span className="hidden shrink-0 text-[12px] text-faint sm:inline">~{s.minutes} min</span>
              <Button size="sm" variant="secondary" onClick={() => run(s)} loading={busy === s.id} disabled={!!busy && busy !== s.id}>
                Apply
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
