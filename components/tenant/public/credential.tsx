"use client";

import * as React from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { CopyButton } from "@/components/kit/bits";
import { useTrust } from "@/lib/store";
import { fakeHash, fmt, nowMs } from "@/lib/utils";

/* Guilloche line work, the fine engraved pattern used on certificates and banknotes.
   Hypotrochoid curves, computed once at module load so render stays pure. */
function hypotrochoid(R: number, r: number, d: number, cx: number, cy: number, steps = 1400) {
  const k = (R - r) / r;
  const turns = r / gcd(Math.round(R), Math.round(r));
  let p = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    p += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return p;
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
const ROSETTES = [
  hypotrochoid(150, 6, 52, 210, 210),
  hypotrochoid(150, 10, 70, 210, 210),
  hypotrochoid(140, 7, 40, 210, 210),
  hypotrochoid(120, 15, 62, 210, 210),
];

export function Guilloche({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 420" className={className} aria-hidden>
      {ROSETTES.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.45} opacity={0.55 - i * 0.08} />
      ))}
      <circle cx="210" cy="210" r="196" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
      <circle cx="210" cy="210" r="190" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 3" opacity="0.5" />
    </svg>
  );
}

function Seal() {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className="size-[84px] shrink-0 text-tenant" aria-hidden>
      <defs>
        <path id={`seal-${id}`} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 2.5" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <text fontSize="7.6" letterSpacing="2.4" fill="currentColor" fontFamily="var(--font-geist-mono)">
        <textPath href={`#seal-${id}`}>NORTHWIND CLOUD · TRUST CENTER · FEDRAMP 20X ·</textPath>
      </text>
      <g transform="translate(44 44)">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M10.5 23V10.5L21.5 23V9" fill="none" stroke="var(--tenant-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.3 11.8 21.5 8.6l3.2 3.2" fill="none" stroke="var(--tenant-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function Credential({ onVerify }: { onVerify: () => void }) {
  const f = useTrust((s) => s.profile.fedramp);
  const pkgId = useTrust((s) => s.profile.packageId);
  const published = useTrust((s) => s.pkg.published);
  const fingerprint = React.useMemo(() => fakeHash(published), [published]);
  const start = new Date(f.lastAssessment).getTime();
  const end = new Date(f.nextAssessment).getTime();
  const pct = Math.max(0, Math.min(100, ((nowMs() - start) / (end - start)) * 100));
  const daysLeft = Math.round((end - nowMs()) / 86400000);

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[14px] border border-line-strong bg-surface shadow-md [box-shadow:var(--shadow-md),var(--inset)]">
        {/* engraved band */}
        <div className="relative overflow-hidden border-b border-line px-6 pb-6 pt-6">
          <Guilloche className="pointer-events-none absolute -right-28 -top-24 size-[420px] text-tenant opacity-[0.28] dark:opacity-[0.22]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">FedRAMP status</div>
              <div className="mt-3 text-[15px] font-medium text-fg">{f.program}</div>
              <div className="font-serif text-[56px] leading-[0.95] tracking-[-0.02em] text-fg">{f.cls}</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[12.5px] font-medium text-success-fg">
                <BadgeCheck className="size-3.5" />
                {f.status} since {fmt.date(f.certifiedOn)}
              </div>
            </div>
            <Seal />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-line">
          {[
            { k: "Package ID", v: <span className="font-mono text-[12.5px]">{pkgId}</span> },
            { k: "Independent assessor", v: f.assessor },
            { k: "Continuous monitoring", v: `${f.conmonCadence}, last ${fmt.short(f.conmonLast)}` },
            { k: "Last annual assessment", v: fmt.date(f.lastAssessment) },
          ].map((r) => (
            <div key={r.k} className="bg-surface px-6 py-3.5">
              <dt className="text-[11.5px] text-muted">{r.k}</dt>
              <dd className="mt-0.5 truncate text-[13.5px] font-medium text-fg">{r.v}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-line px-6 py-4">
          <div className="flex items-baseline justify-between text-[12px] text-muted">
            <span>Next annual assessment due {fmt.date(f.nextAssessment)}</span>
            <span>{daysLeft} days</span>
          </div>
          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-subtle">
            <div className="absolute inset-y-0 left-0 rounded-full bg-tenant" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-raised px-6 py-3.5 dark:bg-[color-mix(in_oklab,var(--surface),var(--raised))]">
          <ShieldCheck className="size-4 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] text-muted">Package JSON fingerprint (SHA-256)</div>
            <div className="truncate font-mono text-[12px] text-fg" title={fingerprint}>
              {fingerprint.slice(0, 16)}…{fingerprint.slice(-8)}
            </div>
          </div>
          <CopyButton value={fingerprint} iconOnly label="Copy fingerprint" toastText="Fingerprint copied" />
          <button onClick={onVerify} className="rounded-[7px] px-2 py-1 text-[12.5px] font-medium text-fg underline-offset-4 hover:underline">
            Verify
          </button>
        </div>
      </div>
      <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
        FedRAMP sets this status. The page mirrors it and links to the evidence below.
      </p>
    </div>
  );
}
