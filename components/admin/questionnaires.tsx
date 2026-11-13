"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Command } from "cmdk";
import {
  BookOpenText,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  Download,
  FileText,
  Inbox,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { EmptyState, PageHeader } from "@/components/kit/bits";
import { Dropzone, StatCard, type UploadedFile } from "@/components/kit/widgets";
import { Button } from "@/components/ui/button";
import { Badge, Chip, type Tone } from "@/components/ui/badge";
import { Avatar, Card, ProgressBar } from "@/components/ui/display";
import { Checkbox, Segmented, Select, Switch, Tabs } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { AGENCIES } from "@/lib/mock/catalog";
import { useReady } from "@/lib/hooks";
import { ADMIN_NAME, useTrust } from "@/lib/store";
import { useQueryParam } from "@/lib/ui";
import type { Faq, FaqCategory, PublicQuestion, Questionnaire, QuestionnaireItem, QuestionState, StandardAnswer, TrustDocument } from "@/lib/types";
import { cn, downloadText, fmt, nowMs, sleep, uid } from "@/lib/utils";
import { PageSkeleton, agencyName, agencyShort } from "./common";

/* ───────── Matching (simple keyword overlap, shown as Strong / Partial / None) ───────── */

const STOP = new Set(
  "the and for are you your our what how does with that this from any all when which into per has have been was were its can do is of to in a an or on by be we us describe provide state list there their them also between after before each every current used use".split(" "),
);

function tokens(s: string) {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w))
        .map((w) => w.replace(/ies$/, "y").replace(/s$/, "")),
    ),
  ];
}

function scoreMatch(question: string, faq: Faq) {
  const qt = tokens(question);
  if (!qt.length) return 0;
  const fq = new Set(tokens(faq.question));
  const fa = new Set(tokens(faq.answer));
  let s = 0;
  for (const t of qt) {
    if (fq.has(t)) s += 1;
    else if (fa.has(t)) s += 0.5;
  }
  return s / qt.length;
}

function bestMatch(question: string, faqs: Faq[]) {
  let best: { faq: Faq; score: number } | undefined;
  for (const f of faqs) {
    const score = scoreMatch(question, f);
    if (!best || score > best.score) best = { faq: f, score };
  }
  return best;
}

type Strength = "strong" | "partial" | "none";
const strengthOf = (score: number): Strength => (score >= 0.45 ? "strong" : score >= 0.22 ? "partial" : "none");
const STRENGTH: Record<Strength, { label: string; tone: Tone }> = {
  strong: { label: "Strong match", tone: "success" },
  partial: { label: "Partial match", tone: "warning" },
  none: { label: "No match", tone: "neutral" },
};

const SAMPLE_QUESTIONS = [
  "Is all customer data encrypted at rest? Describe the algorithm and key management.",
  "Which TLS versions are supported for data in transit?",
  "In which regions or countries is customer data stored?",
  "Describe your process for deleting customer data at contract termination.",
  "Does the service support SAML single sign-on and PIV/CAC authentication?",
  "How is privileged access to production systems approved, limited and logged?",
  "How frequently are vulnerability scans performed, and what are remediation timelines?",
  "When was the last independent penetration test performed?",
  "Describe your change management process for production systems.",
  "What are your incident notification timelines to customer agencies?",
  "What are your RTO and RPO, and when was disaster recovery last tested?",
  "What is your current FedRAMP status and package identifier?",
  "Do you have a current SOC 2 Type II report? What period does it cover?",
  "How do you monitor security controls continuously between assessments?",
  "Is customer data used to train machine learning or AI models?",
  "List all subprocessors that store or process customer data.",
  "Does the product conform to Section 508 accessibility requirements?",
  "Can access to the tenant be restricted by source IP address?",
  "Describe background checks for personnel with production access.",
  "What insurance coverage do you carry for cyber incidents?",
  "How long are security audit logs retained?",
  "Do you run a vulnerability disclosure or bug bounty program?",
  "How are developer workstations secured and managed?",
  "Describe how data from different customers is logically separated.",
];

/* ───────── Labels ───────── */

const QN_STATUS: Record<Questionnaire["status"], { label: string; tone: Tone }> = {
  new: { label: "New", tone: "brand" },
  in_progress: { label: "In progress", tone: "warning" },
  in_review: { label: "In review", tone: "review" },
  sent: { label: "Sent", tone: "success" },
};

const ITEM_STATE: Record<QuestionState, { label: string; tone: Tone }> = {
  matched: { label: "Matched", tone: "info" },
  edited: { label: "Edited", tone: "review" },
  needs_answer: { label: "Needs answer", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
};

const CATEGORIES: FaqCategory[] = ["Data protection", "Access control", "Infrastructure", "Incident response", "Compliance", "Privacy"];

const isOverdue = (q: Questionnaire) => q.status !== "sent" && new Date(q.dueAt).getTime() < nowMs();
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - nowMs()) / 86400000);

function dueLabel(q: Questionnaire) {
  if (q.status === "sent") return q.sentAt ? `Sent ${fmt.date(q.sentAt)}` : "Sent";
  const d = daysUntil(q.dueAt);
  if (d < 0) return `Overdue by ${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"}`;
  if (d === 0) return "Due today";
  return `Due in ${d} ${d === 1 ? "day" : "days"}`;
}

function progressOf(q: Questionnaire) {
  const total = q.items.length;
  const approved = q.items.filter((i) => i.state === "approved").length;
  const needs = q.items.filter((i) => i.state === "needs_answer").length;
  return { total, approved, needs, pct: total ? (approved / total) * 100 : 0 };
}

/** Derive the workflow status from item states (sent stays sent). */
function withStatus(q: Questionnaire): Questionnaire {
  if (q.status === "sent") return q;
  const { total, approved } = progressOf(q);
  if (total && approved === total) return { ...q, status: "in_review" };
  const touched = q.items.some((i) => i.state === "approved" || i.state === "edited");
  return { ...q, status: touched ? "in_progress" : q.status === "in_review" ? "in_progress" : q.status };
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/* ───────── Page ───────── */

type Tab = "questionnaires" | "library" | "standard" | "inbox";

export function AdminQuestionnaires() {
  const ready = useReady();
  const tab = useQueryParam("tab");
  if (!ready) return <PageSkeleton stats={4} />;
  return <Body initialTab={tab === "library" || tab === "inbox" || tab === "standard" ? tab : "questionnaires"} />;
}

function Body({ initialTab }: { initialTab: Tab }) {
  const questionnaires = useTrust((s) => s.questionnaires);
  const faqs = useTrust((s) => s.faqs);
  const standards = useTrust((s) => s.standardQuestionnaires);
  const standardCount = standards.reduce((a, x) => a + x.items.length, 0);
  const inbox = useTrust((s) => s.publicQuestions);
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [faqEdit, setFaqEdit] = React.useState<Faq | "new" | null>(null);

  const open = questionnaires.filter((q) => q.status !== "sent");
  const dueSoon = open.filter((q) => daysUntil(q.dueAt) <= 7).length;
  const openInbox = inbox.filter((q) => q.status === "open").length;
  const publicCount = faqs.filter((f) => f.public).length;
  const reused = questionnaires.reduce((a, q) => a + q.items.filter((i) => i.faqId && i.state !== "edited").length, 0);
  const totalItems = questionnaires.reduce((a, q) => a + q.items.length, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        eyebrow="Engagement"
        title="Q&A and questionnaires"
        description="Answer agency security questionnaires from one library of approved answers. The public answers also appear in the Security Q&A on Northwind's trust page."
        actions={
          <>
            <Button variant="secondary" onClick={() => { setTab("library"); setFaqEdit("new"); }}>
              <Plus />
              Add answer
            </Button>
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              <Upload />
              Upload questionnaire
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open questionnaires" value={String(open.length)} footer={`${dueSoon} due in the next 7 days`} icon={<ClipboardList />} />
        <StatCard label="Answers in the library" value={String(faqs.length)} footer={`${publicCount} public, ${faqs.length - publicCount} internal`} icon={<BookOpenText />} />
        <StatCard label="Answered from the library" value={`${totalItems ? Math.round((reused / totalItems) * 100) : 0}%`} footer={`${reused} of ${totalItems} questions reused an answer`} icon={<CheckCheck />} />
        <StatCard label="Questions from the trust page" value={String(openInbox)} footer={openInbox ? "Waiting for an answer" : "Nothing waiting"} icon={<Inbox />} />
      </div>

      <Tabs
        className="mt-6"
        layoutId="qa-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "questionnaires", label: "Questionnaires", count: open.length || undefined },
          { value: "library", label: "Q&A library", count: faqs.length },
          { value: "standard", label: "CAIQ and SIG Lite", count: standardCount },
          { value: "inbox", label: "Inbox", count: openInbox || undefined },
        ]}
      />
      <div className="pt-5">
        {tab === "questionnaires" && <QuestionnaireList onOpen={setOpenId} onUpload={() => setUploadOpen(true)} />}
        {tab === "library" && <Library onEdit={setFaqEdit} />}
        {tab === "standard" && <StandardLibrary />}
        {tab === "inbox" && <InboxList />}
      </div>

      <Workspace id={openId} onClose={() => setOpenId(null)} />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onCreated={(id) => {
          setTab("questionnaires");
          setOpenId(id);
        }}
      />
      <FaqSheet value={faqEdit} onClose={() => setFaqEdit(null)} />
    </motion.div>
  );
}

/* ───────── Questionnaire list ───────── */

function QuestionnaireList({ onOpen, onUpload }: { onOpen: (id: string) => void; onUpload: () => void }) {
  const questionnaires = useTrust((s) => s.questionnaires);
  const [filter, setFilter] = React.useState<"open" | "sent" | "all">("open");
  const list = React.useMemo(
    () =>
      questionnaires
        .filter((q) => (filter === "all" ? true : filter === "sent" ? q.status === "sent" : q.status !== "sent"))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [questionnaires, filter],
  );
  const openCount = questionnaires.filter((q) => q.status !== "sent").length;

  return (
    <div>
      <Segmented
        layoutId="qn-filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "open", label: "Open", count: openCount },
          { value: "sent", label: "Sent", count: questionnaires.length - openCount },
          { value: "all", label: "All", count: questionnaires.length },
        ]}
      />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {list.map((q) => {
            const p = progressOf(q);
            const overdue = isOverdue(q);
            return (
              <motion.button
                key={q.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => onOpen(q.id)}
                className="card group flex min-w-0 flex-col p-4 text-left transition-shadow hover:shadow-md sm:p-5"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-fg group-hover:text-brand-ink">{q.title}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {agencyName(q.agencyId)} · {q.requester}
                    </div>
                  </div>
                  <Badge tone={QN_STATUS[q.status].tone} dot>
                    {QN_STATUS[q.status].label}
                  </Badge>
                </div>
                <div className="mt-4 flex w-full items-center justify-between gap-3 text-[12.5px]">
                  <span className="text-muted">
                    <span className="font-medium text-fg">{p.approved}</span> of {p.total} approved
                    {p.needs > 0 && <span className="text-warning-fg"> · {p.needs} need answers</span>}
                  </span>
                  <span className={cn("shrink-0 font-medium", overdue ? "text-danger-fg" : "text-muted")}>{dueLabel(q)}</span>
                </div>
                <ProgressBar value={p.pct} tone={q.status === "sent" ? "success" : overdue ? "danger" : "brand"} className="mt-2" label={`${q.title} progress`} />
                <div className="mt-3 flex w-full flex-wrap items-center gap-2 text-[12px] text-faint">
                  <span className="rounded-[5px] border border-line-strong px-1.5 font-mono text-[10.5px] uppercase text-muted">{q.format}</span>
                  <span>Received {fmt.ago(q.receivedAt)}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      {!list.length && (
        <Card className="mt-4">
          <EmptyState
            compact
            title={filter === "sent" ? "Nothing sent yet" : "No open questionnaires"}
            body="Upload a questionnaire an agency sent you. Questions are matched against your Q&A library."
            action={
              <Button size="sm" variant="primary" onClick={onUpload}>
                <Upload /> Upload questionnaire
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}

/* ───────── Questionnaire workspace ───────── */

function Workspace({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qn = useTrust((s) => (id ? s.questionnaires.find((q) => q.id === id) : undefined));
  return (
    <Sheet open={!!id && !!qn} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={820}>{qn && <WorkspaceBody qn={qn} />}</SheetContent>
    </Sheet>
  );
}

function WorkspaceBody({ qn }: { qn: Questionnaire }) {
  const faqs = useTrust((s) => s.faqs);
  const docs = useTrust((s) => s.documents);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [filter, setFilter] = React.useState<"all" | QuestionState>("all");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const p = progressOf(qn);
  const counts = React.useMemo(() => {
    const c: Record<QuestionState, number> = { matched: 0, edited: 0, needs_answer: 0, approved: 0 };
    qn.items.forEach((i) => (c[i.state] += 1));
    return c;
  }, [qn.items]);
  const shown = filter === "all" ? qn.items : qn.items.filter((i) => i.state === filter);
  const sent = qn.status === "sent";

  const save = (items: QuestionnaireItem[], audit?: { action: string; detail?: string }) => {
    upsert("questionnaires", withStatus({ ...qn, items }));
    if (audit) addAudit({ action: audit.action, target: qn.title, detail: audit.detail, category: "updates" });
  };
  const setItem = (itemId: string, change: Partial<QuestionnaireItem>, audit?: { action: string; detail?: string }) =>
    save(
      qn.items.map((i) => (i.id === itemId ? { ...i, ...change } : i)),
      audit,
    );

  const approveAll = () => {
    const prev = useTrust.getState().questionnaires;
    const n = qn.items.filter((i) => i.state === "matched").length;
    save(
      qn.items.map((i) => (i.state === "matched" ? { ...i, state: "approved" } : i)),
      { action: "Approved matched answers", detail: `${n} answers` },
    );
    toast.success(`Approved ${n} matched ${n === 1 ? "answer" : "answers"}`, { action: { label: "Undo", onClick: () => patch({ questionnaires: prev }) } });
  };

  const exportCsv = () => {
    const rows = [["#", "Question", "Answer", "Status", "Source"].map(csvCell).join(",")];
    qn.items.forEach((i, idx) => {
      const faq = faqs.find((f) => f.id === i.faqId);
      const answer = i.answer ?? faq?.answer ?? "";
      rows.push([String(idx + 1), i.text, answer, ITEM_STATE[i.state].label, i.answer ? "Written for this questionnaire" : faq ? `Q&A library: ${faq.question}` : ""].map(csvCell).join(","));
    });
    downloadText(`${qn.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-answers.csv`, rows.join("\n"), "text/csv");
    addAudit({ action: "Exported answers", target: qn.title, detail: `${qn.items.length} questions`, category: "updates" });
    toast.success("Answers exported", { description: `${qn.items.length} questions, CSV` });
  };

  const markSent = () => {
    const prev = useTrust.getState().questionnaires;
    upsert("questionnaires", { ...qn, status: "sent", sentAt: new Date().toISOString() });
    addAudit({ action: "Sent questionnaire", target: qn.title, detail: `${qn.items.length} answers to ${agencyShort(qn.agencyId)}`, category: "updates" });
    toast.success(`Marked as sent to ${qn.requester}`, { action: { label: "Undo", onClick: () => patch({ questionnaires: prev }) } });
  };

  return (
    <>
      <SheetHeader title={qn.title} description={`${agencyName(qn.agencyId)} · ${qn.requester} · ${dueLabel(qn)}`}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={QN_STATUS[qn.status].tone} dot>
            {QN_STATUS[qn.status].label}
          </Badge>
          <span className="text-[12.5px] text-muted">
            {p.approved} of {p.total} approved
          </span>
        </div>
        <ProgressBar value={p.pct} tone={sent ? "success" : "brand"} className="mt-2" label="Questionnaire progress" />
      </SheetHeader>
      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
        <div className="scroll-thin -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All <span className="opacity-60">{qn.items.length}</span>
          </Chip>
          {(Object.keys(ITEM_STATE) as QuestionState[]).map((st) => (
            <Chip key={st} active={filter === st} onClick={() => setFilter(filter === st ? "all" : st)}>
              {ITEM_STATE[st].label} <span className="opacity-60">{counts[st]}</span>
            </Chip>
          ))}
        </div>
        {!sent && (
          <Button size="sm" variant="secondary" disabled={!counts.matched} onClick={approveAll} className="shrink-0">
            <CheckCheck /> Approve all matched
          </Button>
        )}
      </div>
      <SheetBody className="grid grid-cols-1 content-start gap-3">
        <AnimatePresence initial={false}>
          {shown.map((item) => {
            const idx = qn.items.indexOf(item) + 1;
            const faq = faqs.find((f) => f.id === item.faqId);
            const strength = faq ? strengthOf(scoreMatch(item.text, faq)) : "none";
            const answer = item.answer ?? faq?.answer;
            const linked = (faq?.docIds ?? []).map((d) => docs.find((x) => x.id === d)).filter(Boolean) as TrustDocument[];
            const isEditing = editing === item.id;
            return (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[10px] border border-line bg-surface p-4 dark:bg-raised">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[12px] text-faint">{String(idx).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-fg">{item.text}</p>
                      <Badge tone={ITEM_STATE[item.state].tone}>{ITEM_STATE[item.state].label}</Badge>
                    </div>

                    {isEditing ? (
                      <div className="mt-3">
                        <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Answer" autoFocus />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={draft.trim().length < 5}
                            onClick={() => {
                              setItem(item.id, { answer: draft.trim(), state: "edited" }, { action: "Edited answer", detail: item.text.slice(0, 80) });
                              setEditing(null);
                              toast.success("Answer saved", { description: "Approve it when it's ready to send." });
                            }}
                          >
                            Save answer
                          </Button>
                        </div>
                      </div>
                    ) : answer ? (
                      <div className="mt-3 rounded-[8px] bg-subtle/70 p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                          {item.answer ? (
                            <span>Written for this questionnaire</span>
                          ) : (
                            <>
                              <span className="truncate">From Q&A: {faq?.question}</span>
                              <Badge tone={STRENGTH[strength].tone} className="h-5 text-[11px]">
                                {STRENGTH[strength].label}
                              </Badge>
                            </>
                          )}
                        </div>
                        <p className="text-[13px] leading-relaxed text-fg/90">{answer}</p>
                        {!item.answer && linked.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {linked.map((d) => (
                              <span key={d.id} className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface px-2 text-[11.5px] text-muted dark:bg-raised">
                                <FileText className="size-3 shrink-0" />
                                <span className="truncate">{d.title}</span>
                                {d.visibility === "restricted" && <Lock className="size-3 shrink-0 text-faint" />}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[13px] text-warning-fg">No answer in the library matches this question. Write one for this questionnaire.</p>
                    )}

                    {!sent && !isEditing && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.state === "matched" && (
                          <Button size="xs" variant="primary" onClick={() => setItem(item.id, { state: "approved" }, { action: "Accepted answer", detail: item.text.slice(0, 80) })}>
                            <Check /> Accept
                          </Button>
                        )}
                        {item.state === "edited" && (
                          <Button size="xs" variant="primary" onClick={() => setItem(item.id, { state: "approved" }, { action: "Approved answer", detail: item.text.slice(0, 80) })}>
                            <Check /> Approve
                          </Button>
                        )}
                        {item.state === "approved" ? (
                          <Button size="xs" variant="ghost" onClick={() => setItem(item.id, { state: item.answer ? "edited" : item.faqId ? "matched" : "needs_answer" }, { action: "Reopened answer", detail: item.text.slice(0, 80) })}>
                            <RotateCcw /> Reopen
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => {
                              setDraft(answer ?? "");
                              setEditing(item.id);
                            }}
                          >
                            <Pencil /> {answer ? "Edit answer" : "Write answer"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!shown.length && <p className="py-8 text-center text-[13px] text-muted">No questions in this state.</p>}
      </SheetBody>
      <SheetFooter className="flex-wrap">
        <span className="mr-auto text-[12.5px] text-muted">
          {sent ? `Sent ${qn.sentAt ? fmt.date(qn.sentAt) : ""}` : p.approved === p.total ? "Every answer is approved." : `${p.total - p.approved} still to approve`}
        </span>
        <Button variant="secondary" onClick={exportCsv}>
          <Download /> Export answers
        </Button>
        {!sent && (
          <Button variant="primary" disabled={p.approved !== p.total} onClick={markSent}>
            <Send /> Mark as sent
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

/* ───────── Upload questionnaire ───────── */

type Phase = "form" | "reading" | "matching" | "done";

function UploadDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const faqs = useTrust((s) => s.faqs);
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [title, setTitle] = React.useState("");
  const [requester, setRequester] = React.useState("");
  const [agencyId, setAgencyId] = React.useState("ofsa");
  const [due, setDue] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("form");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<{ items: QuestionnaireItem[]; strengths: Strength[] } | null>(null);

  const reset = () => {
    setFile(null);
    setTitle("");
    setRequester("");
    setAgencyId("ofsa");
    setDue("");
    setTouched(false);
    setPhase("form");
    setProgress(0);
    setResult(null);
  };

  const onFile = (f: UploadedFile) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim());
  };

  const errors = {
    file: !file ? "Upload the questionnaire first." : "",
    title: title.trim().length < 3 ? "Give it a name." : "",
    requester: requester.trim().length < 2 ? "Who sent it?" : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const run = async () => {
    setTouched(true);
    if (!valid) return;
    setPhase("reading");
    for (let p = 0; p <= 100; p += 10) {
      setProgress(p);
      await sleep(70);
    }
    setPhase("matching");
    setProgress(0);
    const items: QuestionnaireItem[] = [];
    const strengths: Strength[] = [];
    for (let i = 0; i < SAMPLE_QUESTIONS.length; i++) {
      const text = SAMPLE_QUESTIONS[i]!;
      const m = bestMatch(text, faqs);
      const st = m ? strengthOf(m.score) : "none";
      strengths.push(st);
      items.push({ id: uid("qi"), text, faqId: st === "none" ? undefined : m!.faq.id, state: st === "none" ? "needs_answer" : "matched" });
      setProgress(((i + 1) / SAMPLE_QUESTIONS.length) * 100);
      await sleep(45);
    }
    setResult({ items, strengths });
    setPhase("done");
  };

  const create = () => {
    if (!result) return;
    const now = new Date();
    const dueAt = due ? new Date(`${due}T17:00:00`).toISOString() : new Date(now.getTime() + 14 * 86400000).toISOString();
    const qn: Questionnaire = {
      id: uid("qn"),
      title: title.trim(),
      agencyId,
      requester: requester.trim(),
      receivedAt: now.toISOString(),
      dueAt,
      status: "new",
      format: file?.kind === "docx" ? "docx" : file?.kind === "xlsx" ? "xlsx" : "portal",
      items: result.items,
    };
    upsert("questionnaires", qn);
    addAudit({ action: "Uploaded questionnaire", target: qn.title, detail: `${qn.items.length} questions from ${agencyShort(agencyId)}`, category: "updates" });
    toast.success("Questionnaire ready", { description: `${result.strengths.filter((s) => s !== "none").length} of ${qn.items.length} questions matched an answer.` });
    onOpenChange(false);
    setTimeout(reset, 200);
    onCreated(qn.id);
  };

  const count = (s: Strength) => result?.strengths.filter((x) => x === s).length ?? 0;
  const busy = phase === "reading" || phase === "matching";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader title="Upload a questionnaire" description="Questions are read from the file and matched against your Q&A library. You review every answer before anything is sent." />
        {phase === "form" ? (
          <>
            <DialogBody className="grid grid-cols-1 gap-4">
              <div>
                <Dropzone file={file} onFile={onFile} onClear={() => setFile(null)} accept=".xlsx,.xls,.csv,.docx,.pdf" />
                {!file && (
                  <button
                    type="button"
                    onClick={() => onFile({ name: "OFSA-Annual-Vendor-Review.xlsx", sizeKb: 86, kind: "xlsx" })}
                    className="mt-2 text-[12.5px] font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-fg"
                  >
                    Use a sample questionnaire (24 questions)
                  </button>
                )}
                {touched && errors.file && <p className="mt-1.5 text-[12.5px] text-danger-fg">{errors.file}</p>}
              </div>
              <Field label="Name" htmlFor="qu-title" error={touched && errors.title}>
                <Input id="qu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: OFSA annual vendor review" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Requested by" htmlFor="qu-req" error={touched && errors.requester}>
                  <Input id="qu-req" value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Name of the agency contact" />
                </Field>
                <Field label="Agency or organization">
                  <Select ariaLabel="Agency" value={agencyId} onValueChange={setAgencyId} options={AGENCIES.map((a) => ({ value: a.id, label: a.name }))} />
                </Field>
              </div>
              <Field label="Due date" htmlFor="qu-due" optional hint="Defaults to two weeks from today.">
                <Input id="qu-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={run}>
                Read and match questions
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="grid grid-cols-1 gap-4">
              <ol className="grid grid-cols-1 gap-3">
                <Step label={`Reading ${SAMPLE_QUESTIONS.length} questions`} state={phase === "reading" ? "current" : "done"} progress={phase === "reading" ? progress : 100} />
                <Step
                  label={`Matching against ${faqs.length} answers`}
                  state={phase === "reading" ? "waiting" : phase === "matching" ? "current" : "done"}
                  progress={phase === "matching" ? progress : phase === "done" ? 100 : 0}
                />
              </ol>
              <AnimatePresence>
                {phase === "done" && result && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      {(["strong", "partial", "none"] as Strength[]).map((s) => (
                        <div key={s} className="rounded-[10px] border border-line bg-raised p-3">
                          <div className="text-[20px] font-semibold leading-none text-fg">{count(s)}</div>
                          <div className="mt-1.5 text-[12px] text-muted">{STRENGTH[s].label === "No match" ? "Need an answer" : STRENGTH[s].label}</div>
                        </div>
                      ))}
                    </div>
                    <ul className="scroll-thin max-h-[240px] overflow-y-auto rounded-[10px] border border-line">
                      {result.items.map((it, i) => (
                        <li key={it.id} className="flex items-start gap-3 border-b border-line px-3 py-2 text-[12.5px] last:border-0">
                          <span className="w-5 shrink-0 font-mono text-faint">{i + 1}</span>
                          <span className="min-w-0 flex-1 text-fg/90">{it.text}</span>
                          <Badge tone={STRENGTH[result.strengths[i]!].tone} className="h-5 shrink-0 text-[11px]">
                            {STRENGTH[result.strengths[i]!].label.replace(" match", "")}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" disabled={phase !== "done"} onClick={create}>
                Open questionnaire
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Step({ label, state, progress }: { label: string; state: "waiting" | "current" | "done"; progress: number }) {
  return (
    <li className="rounded-[10px] border border-line p-3">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", state === "done" ? "bg-success text-white dark:text-[#04120f]" : state === "current" ? "text-fg" : "text-faint")}>
          {state === "done" ? <Check className="size-3" strokeWidth={3} /> : state === "current" ? <LoaderCircle className="size-4 animate-spin" /> : <CircleDashed className="size-4" />}
        </span>
        <span className={cn("text-[13px] font-medium", state === "waiting" ? "text-muted" : "text-fg")}>{label}</span>
        <span className="ml-auto font-mono text-[11.5px] text-muted">{Math.round(progress)}%</span>
      </div>
      <ProgressBar value={progress} tone={state === "done" ? "success" : "brand"} className="mt-2" label={label} />
    </li>
  );
}

/* ───────── Q&A library ───────── */

function Library({ onEdit }: { onEdit: (f: Faq) => void }) {
  const faqs = useTrust((s) => s.faqs);
  const docs = useTrust((s) => s.documents);
  const remove = useTrust((s) => s.remove);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | FaqCategory>("all");
  const [vis, setVis] = React.useState<"all" | "public" | "internal">("all");

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (cat === "all" || f.category === cat) &&
        (vis === "all" || (vis === "public" ? f.public : !f.public)) &&
        (!needle || `${f.question} ${f.answer}`.toLowerCase().includes(needle)),
    );
  }, [faqs, q, cat, vis]);

  const del = (f: Faq) => {
    const prev = useTrust.getState().faqs;
    remove("faqs", f.id);
    addAudit({ action: "Deleted answer", target: f.question, category: "updates" });
    toast(`Deleted "${f.question.slice(0, 48)}${f.question.length > 48 ? "…" : ""}"`, { action: { label: "Undo", onClick: () => patch({ faqs: prev }) } });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-[300px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions and answers" aria-label="Search Q&A" className="pl-8" />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Segmented
          size="sm"
          layoutId="qa-vis"
          value={vis}
          onChange={setVis}
          options={[
            { value: "all", label: "All" },
            { value: "public", label: "Public" },
            { value: "internal", label: "Internal" },
          ]}
        />
      </div>
      <div className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>
          All categories
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "all" : c)}>
            {c} <span className="opacity-60">{faqs.filter((f) => f.category === c).length}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <AnimatePresence initial={false}>
          {list.map((f) => {
            const linked = f.docIds.map((d) => docs.find((x) => x.id === d)).filter(Boolean) as TrustDocument[];
            return (
              <motion.div key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="card min-w-0 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{f.category}</Badge>
                  {f.public ? <Badge tone="success">Public on trust page</Badge> : <Badge tone="neutral" outline>Internal only</Badge>}
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon-xs" variant="ghost" aria-label={`Edit ${f.question}`} onClick={() => onEdit(f)}>
                      <Pencil />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label={`Delete ${f.question}`} onClick={() => del(f)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2.5 text-[14.5px] font-semibold leading-snug text-fg">{f.question}</h3>
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">{f.answer}</p>
                {linked.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {linked.map((d) => (
                      <span key={d.id} className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-line-strong px-2 text-[11.5px] text-muted">
                        <FileText className="size-3 shrink-0" />
                        <span className="truncate">{d.title}</span>
                        {d.visibility === "restricted" && <Lock className="size-3 shrink-0 text-faint" />}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[12px] text-faint">
                  <span>
                    Used <span className="font-medium text-muted">{f.uses}</span> times
                  </span>
                  <span>Updated {fmt.date(f.updatedAt)}</span>
                  <span className="flex items-center gap-1.5">
                    <Avatar name={f.owner} size={16} /> {f.owner}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {!list.length && (
        <Card className="mt-3">
          <EmptyState compact title="No answers match" body="Try another word, or clear the filters." />
        </Card>
      )}
    </div>
  );
}

function DocsSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const docs = useTrust((s) => s.documents);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="grid grid-cols-1 gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-[8px] border border-line-strong bg-surface px-3 text-left text-[13.5px] shadow-xs outline-none hover:bg-raised focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--ring)] dark:bg-raised"
          >
            <span className={value.length ? "text-fg" : "text-faint"}>{value.length ? `${value.length} linked` : "Link supporting documents"}</span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px]">
          <Command>
            <Command.Input placeholder="Search documents" className="h-10 w-full border-b border-line bg-transparent px-3 text-[13px] text-fg outline-none placeholder:text-faint" />
            <Command.List className="scroll-thin max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">No match</Command.Empty>
              {docs.map((d) => {
                const on = value.includes(d.id);
                return (
                  <Command.Item
                    key={d.id}
                    value={d.title}
                    onSelect={() => toggle(d.id)}
                    className="flex h-9 cursor-default items-center gap-2.5 rounded-[6px] px-2 text-[13px] text-fg outline-none data-[selected=true]:bg-subtle"
                  >
                    <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", on ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{d.title}</span>
                    {d.visibility === "restricted" && <Lock className="ml-auto size-3 shrink-0 text-faint" />}
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const d = docs.find((x) => x.id === id);
            return (
              <span key={id} className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-brand-soft pl-2 pr-1 text-[11.5px] text-brand-ink">
                <span className="truncate">{d?.title ?? id}</span>
                <button type="button" aria-label={`Unlink ${d?.title ?? id}`} onClick={() => toggle(id)} className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-fg/10">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FaqSheet({ value, onClose }: { value: Faq | "new" | null; onClose: () => void }) {
  return (
    <Sheet open={value !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={560}>{value !== null && <FaqForm key={value === "new" ? "new" : value.id} faq={value === "new" ? null : value} onClose={onClose} />}</SheetContent>
    </Sheet>
  );
}

function FaqForm({ faq, onClose }: { faq: Faq | null; onClose: () => void }) {
  const upsert = useTrust((s) => s.upsert);
  const addAudit = useTrust((s) => s.addAudit);
  const [question, setQuestion] = React.useState(faq?.question ?? "");
  const [answer, setAnswer] = React.useState(faq?.answer ?? "");
  const [category, setCategory] = React.useState<FaqCategory>(faq?.category ?? "Data protection");
  const [docIds, setDocIds] = React.useState<string[]>(faq?.docIds ?? []);
  const [isPublic, setPublic] = React.useState(faq?.public ?? true);
  const [touched, setTouched] = React.useState(false);
  const errors = {
    question: question.trim().length < 8 ? "Write the question as a reviewer would ask it." : "",
    answer: answer.trim().length < 20 ? "Write a complete answer (at least a sentence)." : "",
  };

  const save = () => {
    setTouched(true);
    if (errors.question || errors.answer) return;
    const next: Faq = {
      id: faq?.id ?? uid("faq"),
      question: question.trim(),
      answer: answer.trim(),
      category,
      docIds,
      public: isPublic,
      updatedAt: new Date().toISOString(),
      owner: ADMIN_NAME,
      uses: faq?.uses ?? 0,
    };
    upsert("faqs", next);
    addAudit({ action: faq ? "Updated answer" : "Added answer", target: next.question, detail: isPublic ? "Public" : "Internal", category: "updates" });
    toast.success(faq ? "Answer updated" : "Answer added to the library", { description: isPublic ? "It shows in the Security Q&A on the trust page." : "Internal only. Used for questionnaires." });
    onClose();
  };

  return (
    <>
      <SheetHeader title={faq ? "Edit answer" : "Add an answer"} description="Approved answers are reused across questionnaires and, when public, on the trust page." />
      <SheetBody className="grid grid-cols-1 content-start gap-5">
        <Field label="Question" htmlFor="faq-q" error={touched && errors.question}>
          <Input id="faq-q" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label="Answer" htmlFor="faq-a" error={touched && errors.answer} hint={`${answer.trim().split(/\s+/).filter(Boolean).length} words. Plain, specific and current.`}>
          <Textarea id="faq-a" rows={7} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select ariaLabel="Category" value={category} onValueChange={(v) => setCategory(v as FaqCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Supporting documents" optional hint="Shown under the answer. Restricted documents stay locked for public visitors.">
          <DocsSelect value={docIds} onChange={setDocIds} />
        </Field>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[10px] border border-line p-3.5">
          <span>
            <span className="block text-[13.5px] font-medium text-fg">Show on the trust page</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">Public answers appear in the Security Q&A. Internal answers are only used in questionnaires.</span>
          </span>
          <Switch checked={isPublic} onCheckedChange={setPublic} aria-label="Show on the trust page" />
        </label>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          {faq ? "Save changes" : "Add to library"}
        </Button>
      </SheetFooter>
    </>
  );
}

/* ───────── Inbox (questions from the trust page) ───────── */

function InboxList() {
  const questions = useTrust((s) => s.publicQuestions);
  const sorted = React.useMemo(
    () => [...questions].sort((a, b) => (a.status === b.status ? b.askedAt.localeCompare(a.askedAt) : a.status === "open" ? -1 : 1)),
    [questions],
  );
  return (
    <div>
      <p className="mb-4 max-w-2xl text-[13px] text-muted">
        Questions visitors send from the &ldquo;Ask Northwind&rdquo; form on the trust page. Your answer is emailed to them, and you can add it to the library so the next person finds it on the page.
      </p>
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((pq) => (
            <motion.div key={pq.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <InboxCard pq={pq} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!sorted.length && (
        <Card>
          <EmptyState compact title="No questions yet" body="Questions sent from the trust page land here." />
        </Card>
      )}
    </div>
  );
}

function InboxCard({ pq }: { pq: PublicQuestion }) {
  const faqs = useTrust((s) => s.faqs);
  const upsert = useTrust((s) => s.upsert);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [open, setOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState("");
  const [addToLib, setAddToLib] = React.useState(true);
  const [category, setCategory] = React.useState<FaqCategory>("Data protection");
  const suggestion = React.useMemo(() => {
    const m = bestMatch(pq.question, faqs);
    return m && strengthOf(m.score) !== "none" ? m : undefined;
  }, [pq.question, faqs]);

  const send = () => {
    const prev = { publicQuestions: useTrust.getState().publicQuestions, faqs: useTrust.getState().faqs };
    upsert("publicQuestions", { ...pq, status: "answered", answer: answer.trim(), answeredAt: new Date().toISOString() });
    if (addToLib) {
      upsert("faqs", {
        id: uid("faq"),
        question: pq.question,
        answer: answer.trim(),
        category,
        docIds: suggestion?.faq.docIds ?? [],
        public: true,
        updatedAt: new Date().toISOString(),
        owner: ADMIN_NAME,
        uses: 0,
      });
    }
    addAudit({ action: "Answered question", target: pq.question, detail: `${pq.name}, ${pq.organization}${addToLib ? "; added to Q&A library" : ""}`, category: "updates" });
    toast.success(`Answer sent to ${pq.email}`, {
      description: addToLib ? "They'll get it by email, and it's now in the public Q&A." : "They'll get it by email.",
      action: { label: "Undo", onClick: () => patch(prev) },
    });
    setOpen(false);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={pq.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-semibold text-fg">{pq.name}</span>
            <span className="text-[12.5px] text-muted">{pq.organization}</span>
            <Badge tone={pq.status === "open" ? "warning" : "success"} dot className="ml-auto">
              {pq.status === "open" ? "Waiting" : "Answered"}
            </Badge>
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            <span className="font-mono text-[11.5px]">{pq.email}</span> · Asked {fmt.ago(pq.askedAt)}
          </div>
          <p className="mt-2.5 border-l-2 border-line-strong pl-3 text-[13.5px] leading-relaxed text-fg">{pq.question}</p>

          {pq.status === "answered" && pq.answer && (
            <div className="mt-3 rounded-[8px] bg-subtle/70 p-3 text-[13px] leading-relaxed text-fg/90">
              <div className="mb-1 text-[11.5px] text-muted">Answered {pq.answeredAt ? fmt.ago(pq.answeredAt) : ""}</div>
              {pq.answer}
            </div>
          )}

          {pq.status === "open" && !open && (
            <Button size="sm" variant="primary" className="mt-3" onClick={() => setOpen(true)}>
              <Pencil /> Answer
            </Button>
          )}

          <AnimatePresence>
            {pq.status === "open" && open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {suggestion && (
                    <div className="rounded-[8px] border border-dashed border-line-strong p-3 text-[12.5px]">
                      <div className="flex flex-wrap items-center gap-2 text-muted">
                        Closest answer in the library
                        <Badge tone={STRENGTH[strengthOf(suggestion.score)].tone} className="h-5 text-[11px]">
                          {STRENGTH[strengthOf(suggestion.score)].label}
                        </Badge>
                      </div>
                      <div className="mt-1 font-medium text-fg">{suggestion.faq.question}</div>
                      <p className="mt-1 line-clamp-2 text-muted">{suggestion.faq.answer}</p>
                      <Button size="xs" variant="secondary" className="mt-2" onClick={() => { setAnswer(suggestion.faq.answer); setCategory(suggestion.faq.category); }}>
                        Use this answer
                      </Button>
                    </div>
                  )}
                  <Textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write a plain, specific answer" aria-label="Answer" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg">
                      <Checkbox checked={addToLib} onCheckedChange={(v) => setAddToLib(!!v)} aria-label="Add to Q&A library" />
                      Add to Q&A library as a public answer
                    </label>
                    {addToLib && (
                      <Select size="sm" ariaLabel="Category" className="sm:w-[180px]" value={category} onValueChange={(v) => setCategory(v as FaqCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" disabled={answer.trim().length < 10} onClick={send}>
                      <Send /> Send answer
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

/* ───────── Standard questionnaires (CAIQ, SIG Lite) answer library ───────── */
function StandardLibrary() {
  const standards = useTrust((s) => s.standardQuestionnaires);
  const docs = useTrust((s) => s.documents);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);
  const [active, setActive] = React.useState<"caiq" | "sig-lite">("caiq");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; answer: StandardAnswer; detail: string } | null>(null);
  const sq = standards.find((x) => x.id === active)!;
  const items = React.useMemo(
    () => sq.items.filter((i) => !q.trim() || `${i.id} ${i.question} ${i.detail} ${i.domain}`.toLowerCase().includes(q.toLowerCase())),
    [sq, q],
  );

  const save = () => {
    if (!editing) return;
    const prev = useTrust.getState().standardQuestionnaires;
    patch({
      standardQuestionnaires: prev.map((x) =>
        x.id === active
          ? { ...x, updatedAt: new Date().toISOString(), items: x.items.map((i) => (i.id === editing.id ? { ...i, answer: editing.answer, detail: editing.detail.trim() } : i)) }
          : x,
      ),
    });
    addAudit({ action: "Edited questionnaire answer", target: `${sq.name} ${editing.id}`, detail: editing.answer, category: "updates" });
    toast.success(`${editing.id} updated`, {
      description: "The trust page shows the new answer now.",
      action: { label: "Undo", onClick: () => patch({ standardQuestionnaires: prev }) },
    });
    setEditing(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          layoutId="std-lib"
          value={active}
          onChange={(v) => {
            setActive(v);
            setEditing(null);
          }}
          options={standards.map((x) => ({ value: x.id, label: x.id === "caiq" ? "CAIQ v4" : "SIG Lite", count: x.items.length }))}
        />
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers or IDs" className="pl-8" aria-label="Search answers" />
        </div>
      </div>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg">
            {sq.name} <span className="font-normal text-muted">· version {sq.version}</span>
          </div>
          <div className="text-[12.5px] text-muted">
            Published on the trust page. Updated {fmt.date(sq.updatedAt)} by {sq.owner}. Agencies download the spreadsheet after their access is approved.
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            downloadText(
              `${sq.id}-${sq.version}-northwind.csv`,
              ["ID,Domain,Question,Answer,Detail,Documents", ...sq.items.map((i) => [i.id, i.domain, i.question, i.answer, i.detail, i.docIds.join(" ")].map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n"),
              "text/csv",
            )
          }
        >
          Export spreadsheet
        </Button>
      </Card>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map((i) => {
            const isEditing = editing?.id === i.id;
            return (
              <li key={i.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className="w-[78px] shrink-0 pt-0.5 font-mono text-[11.5px] text-faint">{i.id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-fg">{i.question}</div>
                    {!isEditing && <p className="mt-0.5 text-[13px] text-muted">{i.detail}</p>}
                    {!isEditing && i.docIds.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {i.docIds.map((d) => (
                          <span key={d} className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-muted">
                            {docs.find((x) => x.id === d)?.title ?? d}
                          </span>
                        ))}
                      </div>
                    )}
                    {isEditing && editing && (
                      <div className="mt-2 grid grid-cols-1 gap-2.5">
                        <Segmented
                          size="sm"
                          layoutId={`std-ans-${i.id}`}
                          value={editing.answer}
                          onChange={(v) => setEditing({ ...editing, answer: v })}
                          options={(["Yes", "Partial", "No", "N/A"] as StandardAnswer[]).map((a) => ({ value: a, label: a }))}
                        />
                        <Textarea rows={3} value={editing.detail} onChange={(e) => setEditing({ ...editing, detail: e.target.value })} aria-label="Answer detail" />
                        <div className="flex gap-2">
                          <Button size="sm" variant="primary" onClick={save} disabled={editing.detail.trim().length < 3}>
                            Save answer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={i.answer === "Yes" ? "success" : i.answer === "Partial" ? "warning" : "neutral"}>{i.answer}</Badge>
                    {!isEditing && (
                      <Button size="xs" variant="ghost" onClick={() => setEditing({ id: i.id, answer: i.answer, detail: i.detail })}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {!items.length && <p className="px-5 py-8 text-center text-[13px] text-muted">No answers match.</p>}
      </Card>
    </div>
  );
}
