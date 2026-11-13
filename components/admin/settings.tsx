"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Minus,
  Globe2,
  ImageUp,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PageHeader, CopyButton } from "@/components/kit/bits";
import { NorthwindMark } from "@/components/tenant/chrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, Card } from "@/components/ui/display";
import { Field, Input } from "@/components/ui/field";
import { Select, Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/menu";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { ClientAdmin } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";
import { PageSkeleton } from "./common";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "domain", label: "Custom domain" },
  { id: "security", label: "Security" },
  { id: "admins", label: "Client admins" },
  { id: "roles", label: "Roles and permissions" },
];

export function AdminSettings() {
  const ready = useReady();
  if (!ready) return <PageSkeleton stats={0} />;
  return <SettingsBody />;
}

function SettingsBody() {
  const [active, setActive] = React.useState("branding");

  React.useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) {
      const el = document.getElementById(h);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    }
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader title="Settings" description="How Northwind's trust center looks, where it lives, and who can manage it." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 grid grid-cols-1 gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  className={cn(
                    "relative flex h-8 items-center rounded-[7px] px-2.5 text-[13.5px] font-medium transition-colors",
                    active === s.id ? "text-fg" : "text-muted hover:bg-subtle/70 hover:text-fg",
                  )}
                >
                  {active === s.id && (
                    <motion.span
                      layoutId="settings-nav"
                      className="absolute inset-0 rounded-[7px] border border-line bg-surface shadow-xs dark:bg-subtle"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid grid-cols-1 min-w-0 gap-6">
          <BrandingSection />
          <DomainSection />
          <SecuritySection />
          <AdminsSection />
          <RolesSection />
        </div>
      </div>
    </motion.div>
  );
}

function Section({ id, title, description, action, children }: { id: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 id={`${id}-h`} className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
              {title}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{description}</p>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
        <div className="px-4 py-5 sm:px-5">{children}</div>
      </Card>
    </section>
  );
}

/* ───────── Branding ───────── */

const PRESETS = [
  { hex: "#0e6b5c", name: "Northwind teal" },
  { hex: "#1f3fae", name: "Cobalt" },
  { hex: "#6b3fa0", name: "Plum" },
  { hex: "#a5482a", name: "Rust" },
  { hex: "#1d5fa8", name: "Harbor blue" },
  { hex: "#3c4a66", name: "Graphite" },
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO_KB = 200;
/** Re-derives the tenant tokens from a local --tenant so previews show unsaved colors. */
const TENANT_SCOPE =
  "[--tenant-soft:color-mix(in_oklab,var(--tenant)_9%,white)] [--tenant-ui:var(--tenant)] dark:[--tenant-soft:color-mix(in_oklab,var(--tenant)_24%,transparent)] dark:[--tenant-ui:color-mix(in_oklab,var(--tenant)_62%,white)]";

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
const contrastOnWhiteText = (hex: string) => 1.05 / (luminance(hex) + 0.05);

function BrandingSection() {
  const branding = useTrust((s) => s.branding);
  const setBranding = useTrust((s) => s.setBranding);
  const host = useTrust((s) => s.domain.host);
  const [name, setName] = React.useState(branding.displayName);
  const [accent, setAccent] = React.useState(branding.accent);
  const [hexInput, setHexInput] = React.useState(branding.accent);
  const [logo, setLogo] = React.useState<string | null>(branding.logo);
  const [logoError, setLogoError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const hexValid = HEX_RE.test(hexInput);
  const nameValid = name.trim().length > 1;
  const dirty = name !== branding.displayName || accent.toLowerCase() !== branding.accent.toLowerCase() || logo !== branding.logo;
  const contrast = contrastOnWhiteText(accent);

  const pickHex = (raw: string) => {
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    setHexInput(v);
    if (HEX_RE.test(v)) setAccent(v.toLowerCase());
  };

  const onLogo = (f: File) => {
    setLogoError("");
    if (!/^image\/(png|svg\+xml|jpeg|webp)$/.test(f.type)) {
      setLogoError("Use a PNG, SVG, JPG or WebP image.");
      return;
    }
    const kb = Math.ceil(f.size / 1024);
    if (kb > MAX_LOGO_KB) {
      setLogoError(`Logo must be ${MAX_LOGO_KB} KB or smaller. This file is ${fmt.num(kb)} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setLogoError("Couldn't read that file. Try another one.");
    reader.readAsDataURL(f);
  };

  const save = () => {
    setBranding({ displayName: name.trim(), accent, logo });
    toast.success("Branding saved", { description: "The public page and reviewer portal now use the new look." });
  };
  const discard = () => {
    setName(branding.displayName);
    setAccent(branding.accent);
    setHexInput(branding.accent);
    setLogo(branding.logo);
    setLogoError("");
  };

  return (
    <Section
      id="branding"
      title="Branding"
      description="Northwind's name, logo and accent color on the public page and the reviewer portal."
      action={
        <>
          <Button variant="ghost" size="sm" onClick={discard} disabled={!dirty}>
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || !hexValid || !nameValid}>
            Save branding
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid grid-cols-1 content-start gap-5">
          <Field label="Display name" htmlFor="br-name" error={!nameValid ? "Enter a display name." : undefined} hint="Shown in the page header and browser tab.">
            <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!nameValid} />
          </Field>

          <div className="grid grid-cols-1 gap-1.5">
            <span className="text-[13px] font-medium text-fg">Logo</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("grid size-12 place-items-center rounded-[10px] border border-line bg-raised", TENANT_SCOPE)} style={{ ["--tenant" as string]: accent }}>
                {logo ? (
                  // Data URL kept in the browser for the demo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Logo preview" className="size-9 rounded-[7px] object-contain" />
                ) : (
                  <NorthwindMark size={36} />
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <ImageUp />
                  {logo ? "Replace logo" : "Upload logo"}
                </Button>
                {logo && (
                  <Button size="sm" variant="ghost" onClick={() => setLogo(null)}>
                    Remove logo
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="Logo file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogo(f);
                  e.target.value = "";
                }}
              />
            </div>
            {logoError ? (
              <p className="text-[12.5px] text-danger-fg" role="alert">
                {logoError}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted">Square PNG or SVG, up to {MAX_LOGO_KB} KB. Without a logo, Northwind&apos;s mark is used.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <span className="text-[13px] font-medium text-fg">Accent color</span>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent presets">
              {PRESETS.map((p) => {
                const on = accent.toLowerCase() === p.hex;
                return (
                  <button
                    key={p.hex}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => pickHex(p.hex)}
                    className={cn(
                      "grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      on ? "ring-2 ring-fg" : "hover:ring-2 hover:ring-line-strong",
                    )}
                    style={{ background: p.hex }}
                  >
                    {on && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </button>
                );
              })}
              <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-strong text-[10px] font-medium text-muted hover:bg-subtle" title="Custom color">
                <span aria-hidden>+</span>
                <input type="color" value={accent} onChange={(e) => pickHex(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a custom color" />
              </label>
            </div>
            <div className="flex items-start gap-2">
              <div className="relative w-36">
                <span className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 rounded-[4px] border border-line" style={{ background: hexValid ? hexInput : "transparent" }} />
                <Input
                  value={hexInput}
                  onChange={(e) => pickHex(e.target.value.trim())}
                  maxLength={7}
                  aria-label="Accent hex color"
                  aria-invalid={!hexValid}
                  className="pl-9 font-mono text-[13px] uppercase"
                />
              </div>
              <div className="min-h-9 pt-2 text-[12.5px]">
                {!hexValid ? (
                  <span className="text-danger-fg">Use a 6-digit hex color, like #0E6B5C.</span>
                ) : contrast < 4.5 ? (
                  <span className="inline-flex items-start gap-1.5 text-warning-fg">
                    <CircleAlert className="mt-px size-3.5 shrink-0" />
                    White text on this color is hard to read ({contrast.toFixed(1)}:1). Pick a darker shade.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <BadgeCheck className="size-3.5 text-success-fg" />
                    Button text contrast {contrast.toFixed(1)}:1
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">Live preview</span>
            {dirty && (
              <Badge tone="warning" dot>
                Unsaved
              </Badge>
            )}
          </div>
          <BrandPreview accent={hexValid ? accent : branding.accent} logo={logo} name={name.trim() || branding.displayName} host={host} />
        </div>
      </div>
    </Section>
  );
}

function BrandPreview({ accent, logo, name, host }: { accent: string; logo: string | null; name: string; host: string }) {
  return (
    <div
      aria-label="Preview of the public trust page"
      style={{ ["--tenant" as string]: accent }}
      className={cn("overflow-hidden rounded-[10px] border border-line bg-canvas shadow-xs", TENANT_SCOPE)}
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 dark:bg-raised">
        <LockKeyhole className="size-3 text-faint" />
        <span className="truncate font-mono text-[11px] text-muted">{host}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-6 shrink-0 rounded-[6px] object-contain" />
          ) : (
            <NorthwindMark size={24} />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12px] font-semibold text-fg">{name}</div>
            <div className="text-[10px] text-muted">Trust Center</div>
          </div>
        </div>
        <span className="shrink-0 rounded-[6px] bg-tenant px-2.5 py-1 text-[11px] font-medium text-tenant-fg">Request access</span>
      </div>
      <div className="grid gap-4 p-3.5 sm:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <div className="text-[10px] text-muted">Trust center · Updated recently</div>
          <div className="mt-1.5 font-serif text-[21px] leading-[1.05] text-fg">Security documentation for Northwind Workbench</div>
          <div className="mt-2.5 space-y-1.5" aria-hidden>
            <div className="h-1.5 w-full rounded-full bg-subtle" />
            <div className="h-1.5 w-[88%] rounded-full bg-subtle" />
            <div className="h-1.5 w-[64%] rounded-full bg-subtle" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-[6px] bg-tenant px-2.5 py-1 text-[11px] font-medium text-tenant-fg">Request access</span>
            <span className="rounded-[6px] border border-line-strong bg-surface px-2.5 py-1 text-[11px] font-medium text-fg dark:bg-raised">Browse documents</span>
          </div>
        </div>
        <div className="card min-w-0 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-muted">FedRAMP status</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[9.5px] font-medium text-success-fg">
              <span className="size-1 rounded-full bg-success" />
              Certified
            </span>
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-fg">FedRAMP 20x · Class C</div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-success-soft">
            <div className="h-full w-[12%] rounded-full bg-success" />
          </div>
          <div className="mt-2 space-y-1.5" aria-hidden>
            {[70, 82, 60].map((w) => (
              <div key={w} className="flex justify-between gap-2">
                <div className="h-1 w-[38%] rounded-full bg-subtle" />
                <div className="h-1 rounded-full bg-line-strong" style={{ width: `${w / 2.4}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3.5 pb-3.5">
        {["FedRAMP 20x", "SOC 2 Type II", "ISO 27001"].map((c) => (
          <div key={c} className="card min-w-0 p-2">
            <span className="grid size-5 place-items-center rounded-[5px] bg-tenant-soft text-tenant">
              <ShieldCheck className="size-3" />
            </span>
            <div className="mt-1.5 truncate text-[10.5px] font-medium text-fg">{c}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Custom domain ───────── */

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const STEPS = ["Enter domain", "Add DNS record", "Pending", "Verified"];

function DomainSection() {
  const domain = useTrust((s) => s.domain);
  const setDraft = useTrust((s) => s.setDomainDraft);
  const verify = useTrust((s) => s.verifyDomain);
  const [open, setOpen] = React.useState(domain.draftStep > 0 || domain.draftHost !== "");
  const [input, setInput] = React.useState(domain.draftHost);
  const [touched, setTouched] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [checks, setChecks] = React.useState(0);
  const step = open ? domain.draftStep : 0;

  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const hostError = !host
    ? "Enter the domain you want to use."
    : !HOST_RE.test(host)
      ? "That isn't a valid domain. Use something like trust.example.com."
      : host.split(".").length < 3
        ? "Use a subdomain such as trust.example.com. DNS doesn't allow a CNAME on a root domain."
        : host.endsWith("secureknots.com")
          ? "Use a domain Northwind owns, not a SecureKnots address."
          : host === domain.host
            ? "This domain is already connected."
            : "";

  const draftHost = domain.draftHost || host;
  const label = draftHost.split(".").slice(0, -2).join(".") || "@";

  const cancel = () => {
    setDraft({ draftStep: 0, draftHost: "" });
    setOpen(false);
    setInput("");
    setTouched(false);
    setChecks(0);
  };

  const checkNow = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setChecks((c) => c + 1);
      verify();
      toast.success(`${draftHost} is verified`, { description: "TLS certificate issued. The trust center now answers on this domain." });
    }, 1800);
  };

  return (
    <Section
      id="domain"
      title="Custom domain"
      description="Agencies reach the trust center on Northwind's own domain. SecureKnots handles TLS and renewals."
      action={
        !open && (
          <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setDraft({ draftStep: 0 }); }}>
            <Globe2 />
            Connect a different domain
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-raised p-4 sm:flex-row sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-surface text-muted shadow-xs dark:bg-subtle">
          <Globe2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[14px] text-fg">{domain.host}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            CNAME to <span className="font-mono">{domain.target}</span>
            {domain.verifiedAt && <> · verified {fmt.date(domain.verifiedAt)}</>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={domain.status === "verified" ? "success" : "warning"} dot>
            {domain.status === "verified" ? "Verified" : "Pending DNS"}
          </Badge>
          {domain.status === "verified" && (
            <Badge tone="neutral">
              <LockKeyhole />
              TLS active
            </Badge>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-[10px] border border-line">
              <ol className="flex items-center gap-2 border-b border-line px-4 py-3 sm:gap-3" aria-label="Domain setup steps">
                {STEPS.map((s, i) => {
                  const done = i < step || (i === 3 && step === 3);
                  const current = i === step && step !== 3;
                  return (
                    <li key={s} className={cn("flex min-w-0 items-center gap-2", i < STEPS.length - 1 && "flex-1")} aria-current={current ? "step" : undefined}>
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full border text-[11.5px] font-medium transition-colors",
                          done && "border-success bg-success text-white dark:text-[#04120f]",
                          current && "border-brand bg-brand text-brand-fg",
                          !done && !current && "border-line-strong text-muted",
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={cn("truncate text-[12.5px] font-medium", current || done ? "text-fg" : "text-muted", !current && "hidden md:inline")}>{s}</span>
                      {i < STEPS.length - 1 && <span className={cn("h-px min-w-3 flex-1", i < step ? "bg-success" : "bg-line-strong")} />}
                    </li>
                  );
                })}
              </ol>

              <div className="p-4 sm:p-5">
                {step === 0 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setTouched(true);
                      if (hostError) return;
                      setDraft({ draftHost: host, draftStep: 1 });
                    }}
                    noValidate
                    className="grid grid-cols-1 gap-4"
                  >
                    <Field label="Domain" htmlFor="dom-host" error={touched ? hostError : undefined} hint="Use a subdomain Northwind controls. Agencies see this address and the JSON URL uses it.">
                      <Input id="dom-host" placeholder="trust.example.com" value={input} onChange={(e) => setInput(e.target.value)} aria-invalid={touched && !!hostError} className="font-mono text-[13px] sm:max-w-sm" autoComplete="off" spellCheck={false} />
                    </Field>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="ghost" onClick={cancel}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary">
                        Continue
                        <ArrowRight />
                      </Button>
                    </div>
                  </form>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4">
                    <p className="text-[13.5px] leading-relaxed text-muted">
                      Add this record at the DNS provider for <span className="font-mono text-fg">{draftHost.split(".").slice(-2).join(".")}</span>, for example in Route 53, Cloudflare or your registrar. Changes usually show up within an hour.
                    </p>
                    <div className="overflow-hidden rounded-[10px] border border-line">
                      <div className="hidden grid-cols-[80px_minmax(0,1fr)_minmax(0,1.6fr)_70px] gap-3 border-b border-line bg-raised px-4 py-2 text-[12px] font-medium text-muted sm:grid">
                        <span>Type</span>
                        <span>Host</span>
                        <span>Value</span>
                        <span>TTL</span>
                      </div>
                      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.6fr)_70px] sm:items-center">
                        <DnsCell label="Type">
                          <span className="font-mono text-[13px] text-fg">CNAME</span>
                        </DnsCell>
                        <DnsCell label="Host">
                          <span className="truncate font-mono text-[13px] text-fg">{label}</span>
                          <CopyButton value={label} label="Copy host" iconOnly toastText="Host copied" />
                        </DnsCell>
                        <DnsCell label="Value">
                          <span className="truncate font-mono text-[13px] text-fg">{domain.target}</span>
                          <CopyButton value={domain.target} label="Copy value" iconOnly toastText="CNAME value copied" />
                        </DnsCell>
                        <DnsCell label="TTL">
                          <span className="font-mono text-[13px] text-fg">3600</span>
                        </DnsCell>
                      </div>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <Button variant="ghost" onClick={cancel}>
                        Cancel
                      </Button>
                      <Button variant="secondary" className="sm:ml-auto" onClick={() => setDraft({ draftStep: 0 })}>
                        Back
                      </Button>
                      <Button variant="primary" onClick={() => setDraft({ draftStep: 2 })}>
                        I&apos;ve added the record
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-3.5">
                      <span className="relative mt-0.5 grid size-9 shrink-0 place-items-center">
                        <span className="absolute inset-0 animate-ping rounded-full bg-warning/25" />
                        <span className="relative grid size-9 place-items-center rounded-full bg-warning-soft text-warning-fg">
                          <RefreshCw className={cn("size-4", checking && "animate-spin")} />
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-fg">Waiting for DNS</div>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                          Looking for a CNAME on <span className="break-all font-mono text-fg">{draftHost}</span> pointing to{" "}
                          <span className="break-all font-mono text-fg">{domain.target}</span>. We check every 10 minutes and email Northwind&apos;s admins when it&apos;s live.
                        </p>
                      </div>
                    </div>
                    <ul className="grid grid-cols-1 gap-1.5 rounded-[10px] border border-line bg-raised p-3 font-mono text-[12px] text-muted">
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-warning" />
                        {checking ? "Querying public resolvers…" : checks ? "Last check: record not found yet" : "Queued: first check in under a minute"}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-neutral" />
                        TLS certificate: issued after DNS resolves
                      </li>
                    </ul>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <Button variant="ghost" onClick={cancel} disabled={checking}>
                        Cancel
                      </Button>
                      <Button variant="secondary" className="sm:ml-auto" onClick={() => setDraft({ draftStep: 1 })} disabled={checking}>
                        View record
                      </Button>
                      <Button variant="primary" onClick={checkNow} loading={checking}>
                        Check now
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-3.5">
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success-fg"
                      >
                        <BadgeCheck className="size-[18px]" />
                      </motion.span>
                      <div className="min-w-0">
                        <div className="break-all text-[14px] font-semibold text-fg">{domain.host} is live</div>
                        <p className="mt-0.5 text-[13px] text-muted">DNS verified and TLS certificate issued. It renews automatically.</p>
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-warning/30 bg-warning-soft px-3.5 py-3 text-[13px] text-warning-fg">
                      The package JSON URL now uses this domain. Regenerate the JSON so agencies&apos; systems pick up the new address.
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button asChild variant="secondary">
                        <Link href="/admin/machine-readable">Open machine-readable</Link>
                      </Button>
                      <Button variant="primary" onClick={cancel}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

function DnsCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
      <span className="w-14 shrink-0 text-[12px] text-muted sm:hidden">{label}</span>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
    </div>
  );
}

/* ───────── Security ───────── */

function SecuritySection() {
  const sec = useTrust((s) => s.security);
  const setSecurity = useTrust((s) => s.setSecurity);
  return (
    <Section id="security" title="Security" description="Sign-in and download rules for admins and reviewers.">
      <div className="divide-y divide-line">
        <SettingRow title="Require MFA for admins" body="Required for every admin account on SecureKnots Trust. Admins set it up on first sign-in.">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">
              <LockKeyhole />
              Always on
            </Badge>
            <Switch checked={sec.mfaRequired} disabled aria-label="Require MFA for admins" />
          </div>
        </SettingRow>
        <SettingRow title="Admin session timeout" body="Admins are signed out after this much inactivity.">
          <Select
            ariaLabel="Admin session timeout"
            className="w-[150px]"
            size="sm"
            value={String(sec.sessionTimeout)}
            onValueChange={(v) => {
              setSecurity({ sessionTimeout: Number(v) });
              toast.success(`Session timeout set to ${v} minutes`);
            }}
            options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))}
          />
        </SettingRow>
        <SettingRow title="Reviewer sign-in link expiry" body="How long the emailed sign-in link works before the reviewer needs a new one.">
          <Select
            ariaLabel="Reviewer sign-in link expiry"
            className="w-[150px]"
            size="sm"
            value={String(sec.linkExpiry)}
            onValueChange={(v) => {
              setSecurity({ linkExpiry: Number(v) });
              toast.success(`Sign-in links now expire after ${v} minutes`);
            }}
            options={[10, 15, 30].map((m) => ({ value: String(m), label: `${m} minutes` }))}
          />
        </SettingRow>
        <SettingRow title="Require NDA for restricted documents" body="Reviewers accept Northwind's non-disclosure terms when they request access.">
          <Switch
            checked={sec.ndaRequired}
            aria-label="Require NDA for restricted documents"
            onCheckedChange={(v) => {
              setSecurity({ ndaRequired: v });
              toast.success(v ? "NDA now required for access requests" : "NDA no longer required");
            }}
          />
        </SettingRow>
        <SettingRow title="Watermark downloads" body="Restricted files carry the reviewer's name, agency and download date on every page.">
          <Switch
            checked={sec.watermark}
            aria-label="Watermark downloads"
            onCheckedChange={(v) => {
              setSecurity({ watermark: v });
              toast.success(v ? "Downloads are watermarked" : "Watermarks turned off");
            }}
          />
        </SettingRow>
      </div>
    </Section>
  );
}

function SettingRow({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-fg">{title}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ───────── Client admins ───────── */

const ROLE_TONE = { Owner: "brand", Admin: "info", Editor: "review", Viewer: "neutral" } as const;
type Role = ClientAdmin["role"];
const ROLES: Role[] = ["Viewer", "Editor", "Admin", "Owner"];
const ASSIGNABLE: Role[] = ["Admin", "Editor", "Viewer"];
const ROLE_DESC: Record<Role, string> = {
  Viewer: "Reads documents, logs and analytics. Can't change anything.",
  Editor: "Publishes documents, notices and answers. Can't approve access.",
  Admin: "Everything an Editor can do, plus access decisions, keys and settings.",
  Owner: "Full control, including other admins and billing. One per trust center.",
};
const CAPABILITIES: { label: string; detail: string; roles: Role[] }[] = [
  { label: "Publish documents", detail: "Upload, new versions, visibility", roles: ["Editor", "Admin", "Owner"] },
  { label: "Approve access", detail: "Approve, deny, extend and revoke reviewers", roles: ["Admin", "Owner"] },
  { label: "Manage rules", detail: "Domain allowlist and automatic approval", roles: ["Admin", "Owner"] },
  { label: "Manage API keys and webhooks", detail: "Create, rotate and revoke", roles: ["Admin", "Owner"] },
  { label: "Edit branding and domain", detail: "Logo, accent color, custom domain", roles: ["Admin", "Owner"] },
  { label: "View logs and analytics", detail: "Access logs, audit trail, analytics", roles: ["Viewer", "Editor", "Admin", "Owner"] },
  { label: "Export data", detail: "CSV exports and full client data export", roles: ["Admin", "Owner"] },
  { label: "Manage admins", detail: "Invite, change roles and remove", roles: ["Owner"] },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AdminsSection() {
  const admins = useTrust((s) => s.admins);
  const removeAdmin = useTrust((s) => s.removeAdmin);
  const patch = useTrust((s) => s.patch);
  const addAudit = useTrust((s) => s.addAudit);

  const changeRole = (a: ClientAdmin, role: ClientAdmin["role"]) => {
    if (role === a.role || a.role === "Owner") return;
    const prev = useTrust.getState().admins;
    patch({ admins: prev.map((x) => (x.id === a.id ? { ...x, role } : x)) });
    addAudit({ action: "Changed admin role", target: a.email, detail: `${a.role} to ${role}`, category: "settings" });
    toast.success(`${a.name} is now ${role === "Admin" ? "an" : "a"} ${role}`, {
      description: ROLE_DESC[role],
      action: { label: "Undo", onClick: () => patch({ admins: prev }) },
    });
  };
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<ClientAdmin | null>(null);

  const doRemove = () => {
    if (!confirm) return;
    const prev = useTrust.getState().admins;
    const who = confirm;
    removeAdmin(who.id);
    setConfirm(null);
    toast.success(`Removed ${who.name}`, {
      description: "Their admin access ended immediately.",
      action: { label: "Undo", onClick: () => patch({ admins: prev }) },
    });
  };

  return (
    <Section
      id="admins"
      title="Client admins"
      description="People who can publish documents and approve reviewers for Northwind Cloud."
      action={
        <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
          <UserPlus />
          Invite admin
        </Button>
      }
    >
      <ul className="-my-1">
        <AnimatePresence initial={false}>
          {admins.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3 last:border-0"
            >
              <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                <Avatar name={a.name} size={34} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium text-fg">{a.name}</span>
                    {a.invited && <Badge tone="info">Invited</Badge>}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">
                    {a.email} · {a.org}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[46px] sm:pl-0">
                {a.role === "Owner" ? (
                  <Tooltip content="The owner's role can't be changed here">
                    <span>
                      <Badge tone={ROLE_TONE[a.role]}>{a.role}</Badge>
                    </span>
                  </Tooltip>
                ) : (
                  <Select
                    size="sm"
                    ariaLabel={`Role for ${a.name}`}
                    className="w-[112px]"
                    value={a.role}
                    onValueChange={(v) => changeRole(a, v as ClientAdmin["role"])}
                    options={ASSIGNABLE.map((r) => ({ value: r, label: r, hint: ROLE_DESC[r] }))}
                  />
                )}
                {a.mfa ? (
                  <Badge tone="success">
                    <ShieldCheck />
                    MFA on
                  </Badge>
                ) : (
                  <Badge tone="warning">MFA on first sign-in</Badge>
                )}
                <span className="w-28 text-[12px] text-muted">{a.lastActiveAt ? `Active ${fmt.ago(a.lastActiveAt)}` : "Invite sent"}</span>
                <Button
                  size="icon-sm"
                  variant="danger-ghost"
                  aria-label={`Remove ${a.name}`}
                  disabled={a.role === "Owner"}
                  title={a.role === "Owner" ? "The owner can't be removed" : undefined}
                  onClick={() => setConfirm(a)}
                >
                  <Trash2 />
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent size="sm">
          <DialogHeader title={`Remove ${confirm?.name ?? ""}?`} description="They lose admin access to Northwind's trust center immediately. Documents and logs they created stay." />
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doRemove}>
              Remove admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const admins = useTrust((s) => s.admins);
  const invite = useTrust((s) => s.inviteAdmin);
  const [form, setForm] = React.useState({ name: "", email: "", role: "Admin" as ClientAdmin["role"] });
  const [touched, setTouched] = React.useState(false);

  const email = form.email.trim().toLowerCase();
  const errors = {
    name: form.name.trim().length < 2 ? "Enter their full name." : "",
    email: !EMAIL_RE.test(email) ? "Enter a valid email." : admins.some((a) => a.email.toLowerCase() === email) ? "This person is already an admin." : "",
  };
  const valid = !errors.name && !errors.email;

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v)
      setTimeout(() => {
        setForm({ name: "", email: "", role: "Admin" });
        setTouched(false);
      }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!valid) return;
            invite({ name: form.name.trim(), email, role: form.role });
            toast.success(`Invite sent to ${email}`, { description: "They set up MFA when they first sign in." });
            close(false);
          }}
        >
          <DialogHeader title="Invite an admin" description="Pick the narrowest role that lets them do their job. You can change it later." />
          <DialogBody className="grid grid-cols-1 gap-4">
            <Field label="Full name" htmlFor="inv-name" error={touched ? errors.name : undefined}>
              <Input id="inv-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={touched && !!errors.name} />
            </Field>
            <Field label="Work email" htmlFor="inv-email" error={touched ? errors.email : undefined}>
              <Input id="inv-email" type="email" placeholder="name@northwindcloud.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} aria-invalid={touched && !!errors.email} />
            </Field>
            <Field label="Role" hint={ROLE_DESC[form.role]}>
              <Select
                ariaLabel="Role"
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as ClientAdmin["role"] }))}
                options={ASSIGNABLE.map((r) => ({ value: r, label: r }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Roles and permissions ───────── */

function RolesSection() {
  const admins = useTrust((s) => s.admins);
  const counts = React.useMemo(() => Object.fromEntries(ROLES.map((r) => [r, admins.filter((a) => a.role === r).length])) as Record<Role, number>, [admins]);
  return (
    <Section id="roles" title="Roles and permissions" description="What each client admin role can do. Every role change is recorded in the audit trail.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-[10px] border border-line bg-raised p-3 dark:bg-transparent">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={ROLE_TONE[r]}>{r}</Badge>
              <span className="text-[12px] text-muted">
                {counts[r]} {counts[r] === 1 ? "person" : "people"}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{ROLE_DESC[r]}</p>
          </div>
        ))}
      </div>
      <div className="scroll-thin mt-4 overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-line bg-raised text-left text-[12px] text-muted dark:bg-transparent">
              <th className="px-4 py-2.5 font-medium">Capability</th>
              {ROLES.map((r) => (
                <th key={r} className="w-[84px] px-2 py-2.5 text-center font-medium">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => (
              <tr key={c.label} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-fg">{c.label}</div>
                  <div className="text-[12px] text-muted">{c.detail}</div>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2.5 text-center">
                    {c.roles.includes(r) ? (
                      <Check className="mx-auto size-4 text-success-fg" aria-label={`${r}: allowed`} />
                    ) : (
                      <Minus className="mx-auto size-4 text-faint" aria-label={`${r}: not allowed`} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">SecureKnots staff manage each trust center as its Owner. MFA is required for every role.</p>
    </Section>
  );
}
