"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, CircleAlert, Info, MailCheck, Clock3, X, FileSignature } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { LENGTH_LABEL, matchRule, useTrust } from "@/lib/store";
import { NDA_TEXT } from "@/lib/mock/seed-v3";
import type { AccessRequest } from "@/lib/types";
import { cn, emailDomain, fmt } from "@/lib/utils";

const PERSONAL = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "aol.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Hint = { tone: "success" | "info" | "warning"; text: string } | null;

function useEmailHint(email: string): Hint {
  const rules = useTrust((s) => s.rules);
  if (!EMAIL_RE.test(email)) return null;
  const d = emailDomain(email);
  const rule = matchRule(rules, email);
  const agency = d.endsWith(".gov") || d.endsWith(".mil");
  if (rule) {
    return {
      tone: "success",
      text: agency
        ? `Agency domain: eligible for automatic approval (${LENGTH_LABEL[rule.access].toLowerCase()}).`
        : `${d} is on Northwind's allowlist: eligible for automatic approval.`,
    };
  }
  if (agency) return { tone: "info", text: "Agency domain. Northwind reviews the request, usually within one business day." };
  if (PERSONAL.includes(d)) return { tone: "warning", text: "Use your work email. Requests from personal addresses are usually denied." };
  return { tone: "info", text: "Northwind's security team reviews requests from this domain, usually within one business day." };
}

export function RequestAccessDialog({
  open,
  onOpenChange,
  docIds = [],
  onRemoveDoc,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docIds?: string[];
  onRemoveDoc?: (id: string) => void;
  onSent?: () => void;
}) {
  const docs = useTrust((s) => s.documents);
  const router = useRouter();
  const submit = useTrust((s) => s.submitRequest);
  const setReviewer = useTrust((s) => s.setReviewer);
  const ndaRequired = useTrust((s) => s.security.ndaRequired);
  const linkExpiry = useTrust((s) => s.security.linkExpiry);
  const ndaVersion = useTrust((s) => s.security.ndaVersion);
  const [form, setForm] = React.useState({ name: "", email: "", organization: "", purpose: "", nda: false, signature: "" });
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<AccessRequest | null>(null);
  const hint = useEmailHint(form.email);

  const errors = {
    name: !form.name.trim() ? "Enter your name." : "",
    email: !EMAIL_RE.test(form.email) ? "Enter a valid work email." : "",
    organization: !form.organization.trim() ? "Enter your agency or organization." : "",
    purpose: form.purpose.trim().length < 10 ? "Tell Northwind briefly why you need access." : "",
    nda: ndaRequired && !form.nda ? "Accept the NDA to request restricted documents." : "",
    signature:
      ndaRequired && form.signature.trim().toLowerCase() !== form.name.trim().toLowerCase()
        ? form.signature.trim()
          ? "The signature must match your full name exactly."
          : "Type your full name to sign."
        : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const reset = () => {
    setForm({ name: "", email: "", organization: "", purpose: "", nda: false, signature: "" });
    setTermsOpen(false);
    setTouched(false);
    setDone(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setTimeout(() => {
      const req = submit({ ...form, docIds });
      onSent?.();
      setBusy(false);
      setDone(req);
    }, 650);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent size="md">
        {done ? (
          <SuccessState
            req={done}
            linkExpiry={linkExpiry}
            onOpenPortal={() => {
              setReviewer(done.email);
              onOpenChange(false);
              setTimeout(reset, 200);
              router.push("/t/northwind/portal");
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader
              title="Request access to restricted documents"
              description="Northwind shares its certification package, audit reports and internal policies with agencies, their assessors and integrators."
            />
            <DialogBody className="grid grid-cols-1 gap-4">
              {docIds.length > 0 && (
                <div className="rounded-[10px] border border-line bg-raised p-3">
                  <div className="text-[12px] font-medium text-muted">
                    Requesting {docIds.length} {docIds.length === 1 ? "document" : "documents"}
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {docIds.map((id) => (
                      <li key={id} className="inline-flex h-7 items-center gap-1 rounded-full border border-line-strong bg-surface pl-2.5 pr-1 text-[12px] text-fg">
                        {docs.find((d) => d.id === id)?.title ?? id}
                        {onRemoveDoc && (
                          <button type="button" aria-label="Remove" onClick={() => onRemoveDoc(id)} className="grid size-5 place-items-center rounded-full text-faint hover:bg-subtle hover:text-fg">
                            <X className="size-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="ra-name" error={touched && errors.name}>
                  <Input id="ra-name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={touched && !!errors.name} />
                </Field>
                <Field label="Agency or organization" htmlFor="ra-org" error={touched && errors.organization}>
                  <Input id="ra-org" autoComplete="organization" value={form.organization} onChange={set("organization")} aria-invalid={touched && !!errors.organization} />
                </Field>
              </div>
              <Field
                label="Work email"
                htmlFor="ra-email"
                error={touched && errors.email}
                hint={
                  hint && (
                    <motion.span
                      key={hint.text}
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex items-start gap-1.5",
                        hint.tone === "success" && "text-success-fg",
                        hint.tone === "warning" && "text-warning-fg",
                        hint.tone === "info" && "text-muted",
                      )}
                    >
                      {hint.tone === "success" ? <BadgeCheck className="mt-px size-3.5 shrink-0" /> : hint.tone === "warning" ? <CircleAlert className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0" />}
                      {hint.text}
                    </motion.span>
                  )
                }
              >
                <Input
                  id="ra-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@agency.gov"
                  value={form.email}
                  onChange={set("email")}
                  aria-invalid={touched && !!errors.email}
                />
              </Field>
              <Field label="Purpose" htmlFor="ra-purpose" error={touched && errors.purpose} hint="For example: agency review before using Workbench, or annual assessment.">
                <Textarea id="ra-purpose" rows={3} value={form.purpose} onChange={set("purpose")} aria-invalid={touched && !!errors.purpose} />
              </Field>
              <div className="overflow-hidden rounded-[10px] border border-line-strong">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-raised px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
                    <FileSignature className="size-4 text-muted" />
                    Non-disclosure terms
                  </div>
                  <span className="font-mono text-[11.5px] text-muted">Version {ndaVersion}</span>
                </div>
                <div className="px-3.5 py-3">
                  <div className={cn("scroll-thin relative overflow-y-auto whitespace-pre-line rounded-[8px] bg-subtle/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg/85 transition-[max-height] duration-200", termsOpen ? "max-h-56" : "max-h-24")}>
                    {NDA_TEXT}
                  </div>
                  <button type="button" onClick={() => setTermsOpen((o) => !o)} className="mt-1.5 text-[12px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
                    {termsOpen ? "Show less" : "Read all six terms"}
                  </button>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Field label="Sign by typing your full name" htmlFor="ra-sign" error={touched && errors.signature}>
                      <Input
                        id="ra-sign"
                        autoComplete="off"
                        value={form.signature}
                        onChange={set("signature")}
                        placeholder={form.name || "Full name"}
                        aria-invalid={touched && !!errors.signature}
                      />
                    </Field>
                    <div className="flex min-h-[62px] flex-col justify-end rounded-[8px] border border-dashed border-line-strong px-3 py-2">
                      <span className="truncate font-serif text-[22px] italic leading-none text-fg">{form.signature || " "}</span>
                      <span className="mt-1.5 border-t border-line pt-1 text-[11px] text-faint">Signature · recorded with the date, time and IP address</span>
                    </div>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-fg">
                    <Checkbox checked={form.nda} onCheckedChange={(v) => setForm((f) => ({ ...f, nda: !!v }))} className="mt-0.5" aria-label="Accept the non-disclosure agreement" />
                    <span>I have read and agree to these terms. Files I download are watermarked with my name and the date.</span>
                  </label>
                  {touched && errors.nda && <p className="mt-1.5 text-[12.5px] text-danger-fg">{errors.nda}</p>}
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="tenant" loading={busy}>
                Send request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessState({ req, linkExpiry, onOpenPortal, onClose }: { req: AccessRequest; linkExpiry: number; onOpenPortal: () => void; onClose: () => void }) {
  const approved = req.status === "approved";
  const nda = useTrust((s) => s.ndaRecords.find((n) => n.requestId === req.id));
  return (
    <div>
      <div className="px-6 pb-2 pt-8 text-center sm:px-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className={cn("mx-auto grid size-14 place-items-center rounded-full", approved ? "bg-success-soft text-success-fg" : "bg-tenant-soft text-tenant")}
        >
          {approved ? <MailCheck className="size-6" /> : <Clock3 className="size-6" />}
        </motion.div>
        <h2 className="mt-4 font-serif text-[28px] leading-tight text-fg">{approved ? "Check your email" : "Request sent"}</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
          {approved ? (
            <>
              Your domain is approved automatically. We sent a sign-in link to <span className="font-medium text-fg">{req.email}</span>. It works for {linkExpiry} minutes.
            </>
          ) : (
            <>
              Northwind&apos;s security team reviews requests from this domain, usually within one business day. Once approved, check your email at{" "}
              <span className="font-medium text-fg">{req.email}</span> for a sign-in link.
            </>
          )}
        </p>
      </div>
      {nda && (
        <div className="mx-6 mt-5 flex items-center gap-3 rounded-[10px] border border-line px-4 py-3 sm:mx-8">
          <span className="font-serif text-[20px] italic leading-none text-fg">{nda.signature}</span>
          <span className="ml-auto text-right text-[11.5px] leading-snug text-muted">
            NDA {nda.version} signed
            <br />
            {fmt.dateTime(nda.signedAt)}
          </span>
        </div>
      )}
      <div className="mx-6 mb-6 mt-5 rounded-[10px] border border-dashed border-line-strong bg-raised p-4 sm:mx-8">
        <div className="text-[12px] font-medium text-muted">Demo shortcut</div>
        <p className="mt-1 text-[13px] leading-relaxed text-fg">
          {approved
            ? "No email is sent in this demo. Open the reviewer portal as if you clicked the link."
            : "No email is sent in this demo. Approve the request in Admin › Access, then open the portal. You can open it now to see the pending state."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onOpenPortal}>
            {approved ? "Open the sign-in link" : "Open portal as " + req.name.split(" ")[0]}
            <ArrowRight />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
