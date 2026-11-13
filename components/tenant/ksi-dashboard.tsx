"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ChevronDown, Download, LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/menu";
import { KSI_CHECKS, PRACTICES } from "@/lib/mock/catalog";
import { useTrust } from "@/lib/store";
import type { KsiMetric, TrustDocument } from "@/lib/types";
import { cn, fmt, sleep } from "@/lib/utils";

/** 30-day pass-rate trend: thin bars, full height = 100%. */
function TrendBars({ values }: { values: number[] }) {
  return (
    <div className="flex h-7 items-end gap-[2px]" role="img" aria-label={`Pass rate, last ${values.length} days`}>
      {values.map((v, i) => (
        <Tooltip key={i} content={`${values.length - 1 - i === 0 ? "Today" : `${values.length - 1 - i} days ago`}: ${v}% passing`}>
          <span className={cn("min-w-[2px] flex-1 rounded-[1.5px]", v === 100 ? "bg-success/70" : "bg-warning")} style={{ height: `${Math.max(18, ((v - 70) / 30) * 100)}%` }} />
        </Tooltip>
      ))}
    </div>
  );
}

function AutomationMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-2">
        <div className="h-full rounded-full bg-fg/70" style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[12px] font-medium text-fg">{value}%</span>
    </div>
  );
}

export function KsiSummary({ ksi }: { ksi: KsiMetric[] }) {
  const checks = ksi.reduce((a, k) => a + k.checks, 0);
  const passing = ksi.reduce((a, k) => a + k.passing, 0);
  const automated = Math.round(ksi.reduce((a, k) => a + k.automation * k.checks, 0) / Math.max(1, checks));
  const last = ksi.map((k) => k.lastValidated).sort().at(-1);
  const families = ksi.filter((k) => k.passing === k.checks).length;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-4">
      {[
        { k: "Themes passing", v: `${families} of ${ksi.length}` },
        { k: "Checks passing", v: `${passing} of ${checks}` },
        { k: "Validated automatically", v: `${automated}%` },
        { k: "Last validation run", v: last ? fmt.day(last) : "Not run" },
      ].map((x) => (
        <div key={x.k} className="bg-surface px-4 py-3.5">
          <dt className="text-[12px] text-muted">{x.k}</dt>
          <dd className="mt-1 text-[17px] font-semibold tracking-[-0.015em] text-fg">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KsiDashboard({
  onOpenDoc,
  canRevalidate,
  compact,
}: {
  onOpenDoc?: (d: TrustDocument) => void;
  /** Admin-only demo action: run the validation now. */
  canRevalidate?: boolean;
  compact?: boolean;
}) {
  const ksi = useTrust((s) => s.ksi);
  const docs = useTrust((s) => s.documents);
  const revalidate = useTrust((s) => s.revalidateKsi);
  const [open, setOpen] = React.useState<string | null>(compact ? null : "KSI-MLA");
  const [running, setRunning] = React.useState(false);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <KsiSummary ksi={ksi} />
        </div>
      </div>
      {canRevalidate && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            loading={running}
            onClick={async () => {
              setRunning(true);
              await sleep(1400);
              revalidate();
              setRunning(false);
            }}
          >
            <RefreshCw /> Run validation now
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-[12px] border border-line">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_minmax(0,1.1fr)_28px] items-center gap-4 border-b border-line bg-raised px-4 py-2 text-[11.5px] font-medium text-muted md:grid dark:bg-[color-mix(in_oklab,var(--surface),var(--raised))]">
          <span>Theme</span>
          <span>Checks</span>
          <span>Automated</span>
          <span>Last 30 days</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {ksi.map((k) => {
            const p = PRACTICES.find((x) => x.id === k.id)!;
            const isOpen = open === k.id;
            const ok = k.passing === k.checks;
            const covering = docs.filter((d) => d.practices.includes(k.id));
            const dipped = k.trend.some((v) => v < 100);
            return (
              <li key={k.id} className="bg-surface">
                <button
                  onClick={() => setOpen(isOpen ? null : k.id)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-1 gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-raised/70 md:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_minmax(0,1.1fr)_28px] md:items-center md:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", ok ? "bg-success-soft text-success-fg" : "bg-warning-soft text-warning-fg")}>
                      <BadgeCheck className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-fg">{p.name}</span>
                      <span className="block font-mono text-[11px] text-faint">{k.id}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 md:block">
                    <span className="text-[13px] font-medium text-fg">
                      {k.passing}/{k.checks}
                    </span>
                    <span className="text-[11.5px] text-muted md:block">{ok ? "Passing" : "Failing checks"}</span>
                  </span>
                  <AutomationMeter value={k.automation} />
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <TrendBars values={k.trend} />
                    </span>
                    {dipped && <Badge tone="warning" className="hidden lg:inline-flex">Recovered</Badge>}
                  </span>
                  <ChevronDown className={cn("hidden size-4 text-faint transition-transform md:block", isOpen && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <div className="grid grid-cols-1 gap-5 border-t border-line bg-raised/50 px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] dark:bg-transparent">
                        <div className="text-[13px] leading-relaxed">
                          <p className="text-fg/85">{KSI_CHECKS[k.id]!.note}.</p>
                          {k.note && <p className="mt-2 text-muted">{k.note}</p>}
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
                            <div>
                              <dt className="text-muted">Last automated validation</dt>
                              <dd className="font-medium text-fg">{fmt.dateTime(k.lastValidated)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">Manual evidence review</dt>
                              <dd className="font-medium text-fg">{k.lastManualReview ? fmt.date(k.lastManualReview) : "Fully automated"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted">Automated checks</dt>
                              <dd className="font-medium text-fg">
                                {Math.round((k.automation / 100) * k.checks)} of {k.checks}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted">30-day pass rate</dt>
                              <dd className="font-medium text-fg">{(k.trend.reduce((a, b) => a + b, 0) / k.trend.length).toFixed(1)}%</dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <div className="text-[12px] font-medium text-muted">Evidence ({covering.length})</div>
                          <ul className="mt-1.5 grid gap-0.5">
                            {covering.slice(0, 6).map((d) => (
                              <li key={d.id}>
                                <button
                                  onClick={() => onOpenDoc?.(d)}
                                  disabled={!onOpenDoc}
                                  className="flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1 text-left text-[12.5px] text-fg enabled:hover:bg-subtle"
                                >
                                  {d.visibility === "public" ? <Download className="size-3.5 shrink-0 text-muted" /> : <LockKeyhole className="size-3.5 shrink-0 text-faint" />}
                                  <span className="truncate">{d.title}</span>
                                </button>
                              </li>
                            ))}
                            {covering.length > 6 && <li className="px-1.5 text-[12px] text-faint">and {covering.length - 6} more</li>}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[12px] text-muted">
        Persistent validation means the check runs automatically every day against live configuration. The rest are confirmed by reviewing evidence on a schedule.
      </p>
    </div>
  );
}
