"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowRight, CornerDownLeft, FileText, LockKeyhole, Search, X } from "lucide-react";
import { useTrust } from "@/lib/store";
import { SECTIONS, type DocSection } from "@/lib/mock/sections";
import type { TrustDocument } from "@/lib/types";
import { cn, fmt, sleep } from "@/lib/utils";
import { Highlight } from "./layout";

type QaHit = { kind: "faq" | "caiq" | "sig-lite"; ref: string; question: string; answer: string; docIds: string[]; updated?: string; score: number };
type SectionHit = { s: DocSection; doc: TrustDocument; readable: boolean; score: number };

const STOP = new Set(["the", "and", "for", "you", "your", "our", "are", "does", "with", "what", "how", "when", "where", "which", "who", "have", "has", "can", "data", "northwind", "workbench", "is", "do", "there", "any", "about", "use"]);
const SYN: Record<string, string[]> = {
  encrypt: ["encryption", "encrypted", "aes", "fips", "keys", "tls"],
  key: ["keys", "rotation", "rotated", "hsm"],
  sso: ["single", "sign-on", "saml", "oidc", "piv"],
  piv: ["cac", "saml", "oidc", "sign"],
  mfa: ["multi-factor", "authentication", "phishing-resistant"],
  breach: ["incident", "notify", "notification", "notifies"],
  incident: ["notify", "notifies", "cisa"],
  outage: ["recovery", "availability", "rto", "rpo", "failover"],
  ai: ["models", "train", "machine", "learning"],
  location: ["stored", "regions", "united", "states"],
  stored: ["regions", "united", "states", "location"],
  delete: ["deletion", "deleted", "retention", "contract", "export"],
  scan: ["scanned", "vulnerabilities", "findings", "remediation"],
  pen: ["penetration", "independent", "tested"],
  vendor: ["subprocessor", "subprocessors", "third-party"],
  change: ["changes", "deployed", "significant", "review"],
  session: ["timeout", "inactivity"],
  backup: ["backups", "recovery", "restored"],
  accessib: ["wcag", "section", "508", "vpat"],
};

type Terms = { base: string[]; extra: string[] };

/** The asker's own words, plus related words that count half. */
function terms(q: string): Terms {
  const base = Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  );
  const extra = base.flatMap((w) => Object.entries(SYN).flatMap(([k, v]) => (w.startsWith(k) || v.includes(w) ? [k, ...v] : [])));
  return { base, extra: Array.from(new Set(extra)).filter((w) => !base.includes(w)) };
}

/** Consecutive word pairs from the question ("recovery time", "time objective"). Exact phrases outrank loose matches. */
function phrases(q: string) {
  const w = q
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((x) => x.length > 1 && !STOP.has(x));
  return w.slice(1).map((x, i) => `${w[i]} ${x}`);
}

function phraseBonus(text: string, p: string[]) {
  const s = text.toLowerCase();
  return p.reduce((a, x) => a + (s.includes(x) ? 0.6 : 0), 0);
}

function score(text: string, t: Terms) {
  if (!t.base.length) return 0;
  const s = text.toLowerCase();
  // Related words help, but never more than one of the asker's own words would.
  const hit = t.base.reduce((a, w) => a + (s.includes(w) ? 1 : 0), 0) + Math.min(1, t.extra.reduce((a, w) => a + (s.includes(w) ? 0.5 : 0), 0));
  return hit / Math.max(2, t.base.length);
}

const SUGGEST = ["Is data encrypted at rest?", "Where is federal data stored?", "How fast will you tell us about an incident?", "Do you use our data to train AI?", "Do you support PIV/CAC sign-in?"];

/**
 * Ask this trust center: answers quoted from Northwind's published documents, with the document
 * and section. Restricted sections are named but not shown; the visitor can request that document.
 */
export function AskBox({
  onOpenDoc,
  onRequest,
  canRead = (d) => d.visibility === "public",
  who = "public",
  className,
}: {
  onOpenDoc: (d: TrustDocument) => void;
  onRequest?: (docIds: string[]) => void;
  canRead?: (d: TrustDocument) => boolean;
  who?: "public" | "reviewer";
  className?: string;
}) {
  const faqs = useTrust((s) => s.faqs);
  const standards = useTrust((s) => s.standardQuestionnaires);
  const docs = useTrust((s) => s.documents);
  const [q, setQ] = React.useState("");
  const [asked, setAsked] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ sections: SectionHit[]; qa: QaHit[] } | null>(null);

  const search = async (question: string) => {
    if (!question.trim()) return;
    setQ(question);
    setAsked(question);
    setBusy(true);
    setResult(null);
    await sleep(520);
    const t = terms(question);
    const p = phrases(question);
    const sections = SECTIONS.flatMap((s) => {
      const doc = docs.find((d) => d.id === s.docId);
      if (!doc) return [];
      return [{ s, doc, readable: canRead(doc), score: score(s.heading, t) * 1.5 + score(s.text, t) + phraseBonus(`${s.heading} ${s.text}`, p) }];
    })
      .filter((h) => h.score > 0.5)
      .sort((a, b) => b.score - a.score || Number(b.readable) - Number(a.readable));
    const pool: QaHit[] = [
      ...faqs.filter((f) => f.public).map((f) => ({ kind: "faq" as const, ref: f.category, question: f.question, answer: f.answer, docIds: f.docIds, updated: f.updatedAt, score: 0 })),
      ...standards.flatMap((sq) => sq.items.map((i) => ({ kind: sq.id, ref: i.id, question: i.question, answer: `${i.answer}. ${i.detail}`, docIds: i.docIds, updated: sq.updatedAt, score: 0 }))),
    ];
    const qa = pool
      .map((h) => ({ ...h, score: score(h.question, t) * 1.4 + score(h.answer, t) }))
      .filter((h) => h.score > 0.45)
      .sort((a, b) => b.score - a.score || (a.kind === "faq" ? -1 : 1))
      .slice(0, 3);
    setResult({ sections: sections.slice(0, 4), qa });
    setBusy(false);
  };

  const clear = () => {
    setQ("");
    setResult(null);
    setAsked("");
  };

  // Prefer an answer the visitor can read when it is nearly as relevant as the best match.
  const sections = result?.sections ?? [];
  const best = sections[0];
  const readableBest = sections.find((h) => h.readable);
  const primary = best && readableBest && readableBest.score >= best.score * 0.98 ? readableBest : best;
  const others = sections.filter((h) => h !== primary && h.score >= (best?.score ?? 0) * 0.5);
  const total = SECTIONS.filter((s) => docs.some((d) => d.id === s.docId)).length;

  return (
    <div className={cn("mt-8", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="group relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={who === "public" ? "Ask a security question, for example: is our data encrypted?" : "Ask the documents, for example: what is the RTO?"}
          aria-label="Ask this trust center"
          suppressHydrationWarning
          className="h-[52px] w-full rounded-[14px] border border-line-strong bg-surface pl-11 pr-24 text-[15px] text-fg shadow-sm outline-none placeholder:text-faint focus-visible:border-fg/40 focus-visible:shadow-[0_0_0_4px_var(--ring)]"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {q && (
            <button type="button" aria-label="Clear" onClick={clear} className="grid size-8 place-items-center rounded-full text-faint hover:text-fg">
              <X className="size-4" />
            </button>
          )}
          <button type="submit" className="flex h-9 items-center gap-1.5 rounded-[10px] bg-tenant px-3 text-[13px] font-medium text-tenant-fg">
            Ask <CornerDownLeft className="size-3.5" />
          </button>
        </div>
      </form>
      {!result && !busy && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGEST.map((s) => (
            <button key={s} onClick={() => search(s)} className="rounded-full border border-line px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      )}
      {busy && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-[14px] border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-fg/50" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </span>
            Reading {total} sections in {new Set(SECTIONS.map((s) => s.docId)).size} published documents
          </div>
        </motion.div>
      )}
      {result && !busy && (
        <motion.div key={asked} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 overflow-hidden rounded-[14px] border border-line-strong bg-surface shadow-md">
          {primary ? (
            <PrimaryAnswer hit={primary} asked={asked} onOpenDoc={onOpenDoc} onRequest={onRequest} who={who} />
          ) : result.qa[0] ? (
            <div className="p-4 sm:p-5">
              <div className="text-[12px] text-muted">
                No document section matches. Closest published answer · {result.qa[0].kind === "faq" ? `Security Q&A, ${result.qa[0].ref}` : `${result.qa[0].kind === "caiq" ? "CAIQ" : "SIG Lite"} ${result.qa[0].ref}`}
              </div>
              <div className="mt-1.5 text-[15px] font-semibold leading-snug text-fg">{result.qa[0].question}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-fg/85">
                <Highlight text={result.qa[0].answer} query={asked} />
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="text-[14px] font-medium text-fg">No published document answers this yet</div>
              <p className="mt-1 text-[13px] text-muted">
                Ask Northwind&apos;s security team directly in the{" "}
                <a href="#qa" className="font-medium text-fg underline underline-offset-4">
                  Security Q&A
                </a>{" "}
                section. Good answers are added here for everyone.
              </p>
            </div>
          )}

          {others.length > 0 && (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <div className="text-[12px] text-faint">Also covered in</div>
              <ul className="mt-1 grid gap-0.5">
                {others.map((h) => (
                  <li key={h.s.docId + h.s.ref} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 text-[13px]">
                    {h.readable ? <FileText className="size-3.5 shrink-0 text-faint" /> : <LockKeyhole className="size-3.5 shrink-0 text-faint" />}
                    <button onClick={() => (h.readable ? onOpenDoc(h.doc) : onRequest?.([h.doc.id]))} className="min-w-0 text-left text-fg hover:underline">
                      {h.doc.title}, §{h.s.ref} {h.s.heading}
                    </button>
                    {!h.readable && <span className="text-[12px] text-muted">restricted</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {primary && result.qa.length > 0 && (
            <div className="border-t border-line bg-raised/60 px-4 py-3 sm:px-5 dark:bg-transparent">
              <div className="text-[12px] text-faint">Related answers</div>
              <ul className="mt-1 grid gap-0.5">
                {result.qa.slice(0, 2).map((h) => (
                  <li key={h.kind + h.ref + h.question}>
                    <button onClick={() => search(h.question)} className="flex w-full items-center gap-2 rounded-[6px] py-1 text-left text-[13px] text-fg hover:underline">
                      <ArrowRight className="size-3.5 shrink-0 text-faint" /> {h.question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-line px-4 py-2 text-[11.5px] text-faint sm:px-5">
            Quoted from Northwind&apos;s published documents, with the section it came from. Nothing is generated.
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PrimaryAnswer({
  hit,
  asked,
  onOpenDoc,
  onRequest,
  who,
}: {
  hit: SectionHit;
  asked: string;
  onOpenDoc: (d: TrustDocument) => void;
  onRequest?: (docIds: string[]) => void;
  who: "public" | "reviewer";
}) {
  const v = hit.doc.versions[0]!;
  const cite = (
    <>
      {hit.doc.title}, §{hit.s.ref} {hit.s.heading}
    </>
  );
  if (!hit.readable) {
    return (
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <LockKeyhole className="size-3.5" /> Answer found in a restricted document
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug text-fg">{cite}</div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {who === "public"
            ? "This section is shared with approved reviewers. Request access and Northwind will review it, usually within one business day."
            : "This document is not part of your current access. Ask Northwind to add it."}
        </p>
        {onRequest && (
          <button onClick={() => onRequest([hit.doc.id])} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-tenant px-3 text-[13px] font-medium text-tenant-fg">
            Request access to this document <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-5">
      <div className="text-[12px] text-muted">
        From {hit.doc.visibility === "restricted" ? "a restricted document" : "a public document"} · version {v.version}, {fmt.date(v.publishedAt)}
      </div>
      <blockquote className="mt-2 border-l-2 border-tenant pl-3 text-[14.5px] leading-relaxed text-fg">
        <Highlight text={hit.s.text} query={asked} />
      </blockquote>
      <button onClick={() => onOpenDoc(hit.doc)} className="mt-3 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-left text-[12.5px] text-fg hover:bg-subtle">
        <FileText className="size-3.5 shrink-0 text-muted" /> {cite}
      </button>
    </div>
  );
}
