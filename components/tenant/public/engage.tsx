"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpRight, BellRing, ChevronDown, FileSpreadsheet, FileText, LockKeyhole, MailCheck, MessageSquareText, Rss, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { CopyButton } from "@/components/kit/bits";
import { TOPIC_LABEL, useTrust } from "@/lib/store";
import type { FaqCategory, StandardAnswer, Topic, TrustDocument, Update, UpdateKind } from "@/lib/types";
import { cn, fmt, nowMs } from "@/lib/utils";
import { Highlight, Section } from "./layout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ───────── Security Q&A ───────── */
const CATS: ("All" | FaqCategory)[] = ["All", "Data protection", "Access control", "Infrastructure", "Incident response", "Compliance", "Privacy"];

function score(text: string, q: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!words.length) return 1;
  const t = text.toLowerCase();
  return words.reduce((a, w) => a + (t.includes(w) ? 1 : 0), 0) / words.length;
}

export function SecurityQA({ onOpenDoc, onRequest }: { onOpenDoc: (d: TrustDocument) => void; onRequest?: () => void }) {
  const faqs = useTrust((s) => s.faqs);
  const standards = useTrust((s) => s.standardQuestionnaires);
  const [mode, setMode] = React.useState<"faq" | "caiq" | "sig-lite">("faq");
  const docs = useTrust((s) => s.documents);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("All");
  const [open, setOpen] = React.useState<string | null>("faq_1");
  const [all, setAll] = React.useState(false);

  const results = React.useMemo(() => {
    const pub = faqs.filter((f) => f.public && (cat === "All" || f.category === cat));
    if (!q.trim()) return pub;
    return pub
      .map((f) => ({ f, s: score(`${f.question} ${f.answer}`, q) }))
      .filter((x) => x.s > 0.34)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.f);
  }, [faqs, q, cat]);

  return (
    <Section
      id="qa"
      title="Security Q&A"
      lead="Answers from Northwind's security team, plus pre-answered CAIQ and SIG Lite questionnaires. Each answer links to the document that backs it."
      aside={<AskNorthwind />}
    >
      <div className="scroll-thin -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          layoutId="qa-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "faq", label: "Common questions", count: faqs.filter((f) => f.public).length },
            ...standards.map((sq) => ({ value: sq.id, label: sq.id === "caiq" ? "CAIQ v4" : "SIG Lite", count: sq.items.length })),
          ]}
        />
      </div>
      {mode !== "faq" ? (
        <StandardView key={mode} id={mode} onOpenDoc={onOpenDoc} onRequest={onRequest} />
      ) : (
        <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(null);
          }}
          placeholder="Search answers, for example encryption, SSO or incident"
          aria-label="Search security answers"
          className="h-12 w-full rounded-[12px] border border-line-strong bg-surface pl-11 pr-10 text-[15px] text-fg shadow-xs outline-none placeholder:text-faint focus-visible:border-fg/40 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
        />
        {q && (
          <button aria-label="Clear" onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="scroll-thin -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {CATS.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="mt-5 text-[12.5px] text-muted">
        {q ? `${results.length} ${results.length === 1 ? "answer" : "answers"} for “${q}”` : `${results.length} answers`}
      </div>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {(all || q ? results : results.slice(0, 7)).map((f) => {
          const isOpen = open === f.id || (!!q && results.length <= 3);
          return (
            <li key={f.id}>
              <button onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={isOpen} className="flex w-full items-start gap-4 py-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-snug text-fg">
                    <Highlight text={f.question} query={q} />
                  </span>
                  <span className="mt-1 block text-[12px] text-faint">{f.category}</span>
                </span>
                <ChevronDown className={cn("mt-1 size-4 shrink-0 text-faint transition-transform duration-200", isOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <div className="pb-5 pr-8">
                      <p className="max-w-[68ch] text-[14px] leading-relaxed text-fg/85">
                        <Highlight text={f.answer} query={q} />
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {f.docIds.map((id) => {
                          const d = docs.find((x) => x.id === id);
                          if (!d) return null;
                          return (
                            <button key={id} onClick={() => onOpenDoc(d)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[12px] text-muted transition-colors hover:bg-subtle hover:text-fg">
                              <FileText className="size-3" />
                              {d.title}
                            </button>
                          );
                        })}
                        <span className="ml-1 text-[11.5px] text-faint">Updated {fmt.date(f.updatedAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      {!all && !q && results.length > 7 && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll(true)}>
          Show all {results.length} answers
        </Button>
      )}
      {results.length === 0 && (
        <div className="rounded-[12px] border border-dashed border-line-strong px-5 py-8 text-center">
          <div className="text-[14px] font-medium text-fg">No published answer matches “{q}”</div>
          <p className="mt-1 text-[13px] text-muted">Ask Northwind directly. Answers usually come within two business days.</p>
        </div>
      )}
        </>
      )}
    </Section>
  );
}

function AskNorthwind() {
  const ask = useTrust((s) => s.askQuestion);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ question: "", name: "", email: "", organization: "" });
  const [touched, setTouched] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const valid = f.question.trim().length > 10 && f.name.trim() && EMAIL_RE.test(f.email) && f.organization.trim();
  return (
    <>
      <div className="rounded-[12px] border border-line bg-surface p-4">
        <MessageSquareText className="size-4 text-muted" />
        <div className="mt-2 text-[13.5px] font-medium text-fg">Can&apos;t find an answer?</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">Send your question to Northwind&apos;s security team. Good answers are added here for everyone.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Ask Northwind
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setTimeout(() => {
              setSent(false);
              setTouched(false);
              setF({ question: "", name: "", email: "", organization: "" });
            }, 200);
        }}
      >
        <DialogContent>
          {sent ? (
            <div className="px-6 pb-7 pt-9 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success-fg">
                <MailCheck className="size-5" />
              </span>
              <h3 className="mt-4 font-serif text-[26px] text-fg">Question sent</h3>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted">Northwind will reply to {f.email}. You can follow it in the reviewer portal if you have access.</p>
              <Button className="mt-5" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (!valid) return;
                ask(f);
                setSent(true);
              }}
            >
              <DialogHeader title="Ask Northwind a security question" description="Your question goes to the security team, not a chatbot." />
              <DialogBody className="grid grid-cols-1 gap-4">
                <Field label="Question" htmlFor="ask-q" error={touched && f.question.trim().length <= 10 ? "Write your question in a sentence or two." : undefined}>
                  <Textarea id="ask-q" rows={3} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name" htmlFor="ask-n" error={touched && !f.name.trim() ? "Enter your name." : undefined}>
                    <Input id="ask-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                  </Field>
                  <Field label="Organization" htmlFor="ask-o" error={touched && !f.organization.trim() ? "Enter your organization." : undefined}>
                    <Input id="ask-o" value={f.organization} onChange={(e) => setF({ ...f, organization: e.target.value })} />
                  </Field>
                </div>
                <Field label="Work email" htmlFor="ask-e" error={touched && !EMAIL_RE.test(f.email) ? "Enter a valid email." : undefined}>
                  <Input id="ask-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="tenant">
                  Send question
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───────── Subprocessors ───────── */
export function Subprocessors({ onSubscribe }: { onSubscribe: (t: Topic[]) => void }) {
  const list = useTrust((s) => s.subprocessors);
  const shown = list.filter((s) => s.status !== "removed");
  return (
    <Section
      id="subprocessors"
      title="Subprocessors"
      lead="Third parties that process data for Workbench. Northwind gives 30 days' notice before adding one that handles customer data."
      aside={
        <Button size="sm" variant="secondary" onClick={() => onSubscribe(["subprocessors"])}>
          <BellRing /> Get notified of changes
        </Button>
      }
    >
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line-strong text-[12px] text-muted">
              <th className="py-2.5 pr-4 font-medium">Name</th>
              <th className="py-2.5 pr-4 font-medium">Purpose</th>
              <th className="py-2.5 pr-4 font-medium">Data</th>
              <th className="py-2.5 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const planned = s.status === "planned";
              return (
                <tr key={s.id} className="border-b border-line align-top last:border-0">
                  <td className="py-3.5 pr-4">
                    <div className="font-medium text-fg">{s.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {planned ? (
                        <Badge tone="warning">Starts {fmt.date(s.since)}</Badge>
                      ) : (
                        s.certifications.map((c) => (
                          <span key={c} className="text-[11.5px] text-faint">
                            {c}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-fg/85">{s.purpose}</td>
                  <td className="py-3.5 pr-4 text-muted">{s.data}</td>
                  <td className="whitespace-nowrap py-3.5 text-muted">{s.location}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ───────── Updates feed ───────── */
const KIND: Record<UpdateKind, { label: string; tone: Tone }> = {
  scn: { label: "Significant change", tone: "review" },
  incident: { label: "Incident", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "warning" },
  document: { label: "Document", tone: "neutral" },
  subprocessor: { label: "Subprocessor", tone: "info" },
  general: { label: "Announcement", tone: "success" },
};

export function UpdatesFeed({ onSubscribe, onOpenDoc }: { onSubscribe: (t: Topic[]) => void; onOpenDoc: (d: TrustDocument) => void }) {
  const updates = useTrust((s) => s.updates);
  const docs = useTrust((s) => s.documents);
  const host = useTrust((s) => s.domain.host);
  const [filter, setFilter] = React.useState<"all" | UpdateKind>("all");
  const [more, setMore] = React.useState(false);
  const visible = React.useMemo(() => updates.filter((u) => (u.status !== "draft" && u.audience === "public") || (u.status === "published" && u.audience === "reviewers")), [updates]);
  const upcoming = visible.filter((u) => u.status === "scheduled");
  const past = visible.filter((u) => u.status === "published" && (filter === "all" || u.kind === filter)).sort((a, b) => b.at.localeCompare(a.at));
  const shown = more ? past : past.slice(0, 5);

  return (
    <Section
      id="updates"
      title="Updates"
      lead="Change notifications, incidents and new documents, newest first."
      aside={
        <div className="grid grid-cols-1 gap-2">
          <Button size="sm" variant="tenant" onClick={() => onSubscribe(["documents", "changes", "incidents", "subprocessors"])} className="justify-self-start">
            <BellRing /> Subscribe to updates
          </Button>
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <Rss className="size-3.5" />
            <span className="truncate font-mono text-[11.5px]">{host}/updates.json</span>
            <CopyButton value={`https://${host}/updates.json`} iconOnly label="Copy feed URL" toastText="Feed URL copied" />
          </div>
        </div>
      }
    >
      {upcoming.map((u) => (
        <div key={u.id} className="mb-5 flex gap-3 rounded-[12px] border border-warning/30 bg-warning-soft p-4">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" />
          <div>
            <div className="text-[12px] font-medium text-warning-fg">Upcoming · {fmt.dateTime(u.at)}</div>
            <div className="mt-0.5 text-[14px] font-medium text-fg">{u.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-fg/80">{u.body}</p>
          </div>
        </div>
      ))}
      <div className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", "scn", "incident", "document", "subprocessor", "general"] as const).map((k) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {k === "all" ? "All" : KIND[k].label}
          </Chip>
        ))}
      </div>
      <ol className="mt-5">
        {shown.map((u, i) => (
          <FeedItem key={u.id} u={u} last={i === shown.length - 1} doc={docs.find((d) => d.id === u.docId)} onOpenDoc={onOpenDoc} />
        ))}
        {!shown.length && <li className="py-6 text-[13px] text-muted">No updates of this kind yet.</li>}
      </ol>
      {past.length > 5 && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setMore((m) => !m)}>
          {more ? "Show fewer" : `Show ${past.length - 5} older`}
        </Button>
      )}
    </Section>
  );
}

function FeedItem({ u, last, doc, onOpenDoc }: { u: Update; last: boolean; doc?: TrustDocument; onOpenDoc: (d: TrustDocument) => void }) {
  const k = KIND[u.kind];
  return (
    <li className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <div className="pt-0.5 text-[12.5px] text-muted">
        <div className="font-medium text-fg">{fmt.short(u.at)}</div>
        <div>{new Date(u.at).getFullYear()}</div>
      </div>
      <div className={cn("relative border-l border-line pb-7 pl-5", last && "pb-1")}>
        <span className="absolute -left-[5px] top-1.5 size-[9px] rounded-full border-2 border-canvas bg-line-strong ring-1 ring-line-strong" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={k.tone}>{k.label}</Badge>
          {u.audience === "reviewers" && <span className="text-[11.5px] text-faint">Details for approved reviewers</span>}
        </div>
        <div className="mt-1.5 text-[14.5px] font-medium leading-snug text-fg">{u.title}</div>
        <p className="mt-1 max-w-[68ch] text-[13.5px] leading-relaxed text-muted">{u.body}</p>
        {doc && (
          <button onClick={() => onOpenDoc(doc)} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
            {doc.title} <ArrowUpRight className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

/* ───────── Subscribe dialog ───────── */
export function SubscribeDialog({ open, topics: initial, onOpenChange }: { open: boolean; topics: Topic[]; onOpenChange: (v: boolean) => void }) {
  const subscribe = useTrust((s) => s.subscribe);
  const [email, setEmail] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [topics, setTopics] = React.useState<Topic[]>(initial);
  const [touched, setTouched] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setTopics(initial);
  }
  const valid = EMAIL_RE.test(email) && topics.length > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v)
          setTimeout(() => {
            setDone(false);
            setTouched(false);
            setEmail("");
            setOrg("");
          }, 200);
      }}
    >
      <DialogContent size="sm">
        {done ? (
          <div className="px-6 pb-7 pt-9 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-tenant-soft text-tenant">
              <MailCheck className="size-5" />
            </span>
            <h3 className="mt-4 font-serif text-[26px] text-fg">Confirm your email</h3>
            <p className="mx-auto mt-2 max-w-xs text-[13.5px] text-muted">We sent a confirmation link to {email}. Updates start once you confirm. Every email has an unsubscribe link.</p>
            <Button className="mt-5" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (!valid) return;
              subscribe({ email, organization: org, topics, source: "trust page" });
              setDone(true);
              toast.success("Subscription saved", { description: "Check your email to confirm it." });
            }}
          >
            <DialogHeader title="Subscribe to updates" description="Email when Northwind publishes something you care about. No marketing." />
            <DialogBody className="grid grid-cols-1 gap-4">
              <Field label="Work email" htmlFor="sub-e" error={touched && !EMAIL_RE.test(email) ? "Enter a valid email." : undefined}>
                <Input id="sub-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@agency.gov" />
              </Field>
              <Field label="Organization" htmlFor="sub-o" optional>
                <Input id="sub-o" value={org} onChange={(e) => setOrg(e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-2">
                <span className="text-[13px] font-medium text-fg">Topics</span>
                {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-fg">
                    <Checkbox checked={topics.includes(t)} onCheckedChange={(v) => setTopics(v ? [...topics, t] : topics.filter((x) => x !== t))} />
                    {TOPIC_LABEL[t]}
                  </label>
                ))}
                {touched && !topics.length && <p className="text-[12.5px] text-danger-fg">Pick at least one topic.</p>}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="tenant">
                Subscribe
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function daysAgoLabel(iso: string) {
  const d = Math.round((nowMs() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

/* ───────── Pre-answered standard questionnaires (CAIQ, SIG Lite) ───────── */
const ANSWER_TONE: Record<StandardAnswer, Tone> = { Yes: "success", Partial: "warning", No: "neutral", "N/A": "neutral" };

export function StandardView({
  id,
  onOpenDoc,
  onRequest,
  onDownload,
}: {
  id: "caiq" | "sig-lite";
  onOpenDoc: (d: TrustDocument) => void;
  onRequest?: () => void;
  /** Set for approved reviewers: the spreadsheet downloads directly. */
  onDownload?: () => void;
}) {
  const sq = useTrust((s) => s.standardQuestionnaires.find((x) => x.id === id));
  const docs = useTrust((s) => s.documents);
  const [q, setQ] = React.useState("");
  const [domain, setDomain] = React.useState("All");
  const [answer, setAnswer] = React.useState<"All" | StandardAnswer>("All");
  const domains = React.useMemo(() => ["All", ...Array.from(new Set(sq?.items.map((i) => i.domain) ?? []))], [sq]);
  const items = React.useMemo(() => {
    if (!sq) return [];
    return sq.items.filter(
      (i) =>
        (domain === "All" || i.domain === domain) &&
        (answer === "All" || i.answer === answer) &&
        (!q.trim() || score(`${i.id} ${i.question} ${i.detail} ${i.domain}`, q) > 0.34),
    );
  }, [sq, q, domain, answer]);
  if (!sq) return null;
  const counts = { Yes: sq.items.filter((i) => i.answer === "Yes").length, Partial: sq.items.filter((i) => i.answer === "Partial").length, No: sq.items.filter((i) => i.answer === "No").length };

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-subtle text-muted">
          <FileSpreadsheet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg">
            {sq.name} <span className="font-normal text-muted">· version {sq.version}</span>
          </div>
          <div className="text-[12.5px] text-muted">
            {sq.items.length} answers: {counts.Yes} yes, {counts.Partial} partial, {counts.No} no · Updated {fmt.date(sq.updatedAt)} by {sq.owner}
          </div>
        </div>
        {onDownload ? (
          <Button size="sm" variant="secondary" onClick={onDownload}>
            <FileSpreadsheet /> Download spreadsheet
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onRequest} disabled={!onRequest}>
            <LockKeyhole /> Spreadsheet for reviewers
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="relative md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${sq.id === "caiq" ? "CAIQ" : "SIG Lite"} answers or IDs`}
            aria-label="Search questionnaire answers"
            className="h-10 w-full rounded-[9px] border border-line-strong bg-surface pl-9 pr-3 text-[13.5px] text-fg outline-none placeholder:text-faint focus-visible:border-fg/40 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
          />
        </div>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-label="Domain"
          className="h-10 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] text-fg outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]"
        >
          {domains.map((d) => (
            <option key={d} value={d}>
              {d === "All" ? "All domains" : d}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {(["All", "Yes", "Partial", "No"] as const).map((a) => (
            <Chip key={a} active={answer === a} onClick={() => setAnswer(a)}>
              {a}
            </Chip>
          ))}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i.id} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-4">
            <span className="font-mono text-[11.5px] text-faint">{i.id}</span>
            <div className="min-w-0">
              <div className="text-[14px] font-medium leading-snug text-fg">
                <Highlight text={i.question} query={q} />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                <Highlight text={i.detail} query={q} />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11.5px] text-faint">{i.domain}</span>
                {i.docIds.map((dId) => {
                  const d = docs.find((x) => x.id === dId);
                  if (!d) return null;
                  return (
                    <button key={dId} onClick={() => onOpenDoc(d)} className="inline-flex h-6 items-center gap-1 rounded-full border border-line-strong px-2 text-[11.5px] text-muted transition-colors hover:bg-subtle hover:text-fg">
                      <FileText className="size-3" />
                      {d.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:text-right">
              <Badge tone={ANSWER_TONE[i.answer]}>{i.answer}</Badge>
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p className="py-8 text-center text-[13px] text-muted">No answers match. Try another word or clear the filters.</p>}
      <p className="mt-4 text-[12px] text-faint">
        Answers are written in Northwind&apos;s own words for the topics these questionnaires cover. The reviewer spreadsheet uses the official question numbering.
      </p>
    </div>
  );
}
