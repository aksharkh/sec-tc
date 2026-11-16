"use client";

/* Trust center health in seven chart styles, the same set as Workspace's readiness chart.
   Each design has a default style; the menu on the card overrides it. */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/display";
import { Menu, MenuCheckboxItem, MenuContent, MenuLabel, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { CHARTS, useDesign, type ChartKind } from "@/lib/designs";
import type { HealthRow as Row } from "@/lib/completeness";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

/* ───────── 3D isometric towers ───────── */
function Iso({ rows }: { rows: Row[] }) {
  const id = React.useId().replace(/:/g, "");
  const a = 26;
  const b = a * 0.5;
  const H = 150;
  const step = 76;
  const w = 40 + rows.length * step;
  return (
    <svg viewBox={`0 0 ${w} 250`} className="h-[250px] w-full" role="img" aria-label="Trust center health, 3D towers">
      <defs>
        {rows.map((r) => (
          <linearGradient key={r.id} id={`iso-${id}-${r.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`hsl(${r.hue} 70% 68%)`} />
            <stop offset="1" stopColor={`hsl(${r.hue} 60% 46%)`} />
          </linearGradient>
        ))}
      </defs>
      {rows.map((r, i) => {
        const cx = 46 + i * step;
        const cy = 214;
        const h = (H * r.pct) / 100;
        const pts = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
        const top = (hh: number) => pts([[cx, cy - hh - b], [cx + a, cy - hh], [cx, cy - hh + b], [cx - a, cy - hh]]);
        return (
          <Tooltip key={r.id} content={`${r.label} · ${r.sub}: ${r.pct}%`}>
            <g className="cursor-pointer">
              <polygon points={top(H)} fill="none" stroke="var(--line-strong)" strokeDasharray="3 3" />
              <line x1={cx - a} y1={cy - H} x2={cx - a} y2={cy} stroke="var(--line)" strokeDasharray="3 3" />
              <line x1={cx + a} y1={cy - H} x2={cx + a} y2={cy} stroke="var(--line)" strokeDasharray="3 3" />
              <polygon points={pts([[cx, cy - b], [cx + a, cy], [cx, cy + b], [cx - a, cy]])} fill="var(--subtle-2)" />
              {/* motion treats x/y on SVG as transforms, so grow the tower with scaleY on a group. */}
              <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: 0.08 * i, duration: 0.9, ease }} style={{ originX: 0.5, originY: 1 }}>
                <polygon points={pts([[cx - a, cy - h], [cx, cy - h + b], [cx, cy + b], [cx - a, cy]])} fill={`hsl(${r.hue} 55% 42%)`} />
                <polygon points={pts([[cx, cy - h + b], [cx + a, cy - h], [cx + a, cy], [cx, cy + b]])} fill={`hsl(${r.hue} 55% 32%)`} />
                <polygon points={top(h)} fill={`url(#iso-${id}-${r.id})`} />
              </motion.g>
              <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + 0.08 * i }} x={cx} y={cy - h - b - 8} textAnchor="middle" className="tnum fill-fg text-[12px] font-semibold">
                {r.pct}%
              </motion.text>
              <text x={cx} y={cy + b + 16} textAnchor="middle" className="fill-muted text-[10px]">
                {r.short}
              </text>
            </g>
          </Tooltip>
        );
      })}
    </svg>
  );
}

/* ───────── Concentric rings ───────── */
function Rings({ rows }: { rows: Row[] }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <svg viewBox="0 0 220 220" className="size-[200px] shrink-0 -rotate-90 sm:size-[220px]" role="img" aria-label="Trust center health rings">
        <defs>
          <linearGradient id={`rg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="0.55" stopColor="#db2777" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
        {rows.map((r, i) => {
          const rad = 98 - i * 13;
          const c = 2 * Math.PI * rad;
          return (
            <g key={r.id}>
              <circle cx="110" cy="110" r={rad} fill="none" stroke="var(--subtle-2)" strokeWidth="9" />
              <motion.circle
                cx="110"
                cy="110"
                r={rad}
                fill="none"
                stroke={`url(#rg${id})`}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c - (c * r.pct) / 100 }}
                transition={{ delay: i * 0.1, duration: 1.1, ease }}
                opacity={1 - i * 0.09}
              />
            </g>
          );
        })}
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full bg-[linear-gradient(120deg,#7c3aed,#db2777,#f97316)]" style={{ opacity: 1 - i * 0.09 }} />
            <span className="min-w-0 flex-1 truncate text-fg">
              {r.label} <span className="text-muted">· {r.sub}</span>
            </span>
            <span className="tnum font-semibold text-fg">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Neon bars ───────── */
function Neon({ rows }: { rows: Row[] }) {
  const id = React.useId().replace(/:/g, "");
  const W = rows.length * 64 + 20;
  return (
    <svg viewBox={`0 0 ${W} 230`} className="h-[230px] w-full" role="img" aria-label="Trust center health, neon bars">
      <defs>
        <linearGradient id={`ng${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.15" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
        <filter id={`glow${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0, 25, 50, 75, 100].map((t) => (
        <line key={t} x1="10" x2={W - 10} y1={190 - t * 1.6} y2={190 - t * 1.6} stroke="var(--line)" strokeDasharray="2 4" />
      ))}
      {rows.map((r, i) => {
        const x = 26 + i * 64;
        const h = r.pct * 1.6;
        return (
          <Tooltip key={r.id} content={`${r.label} · ${r.sub}: ${r.pct}%`}>
            <g>
              <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: i * 0.08, duration: 1, ease }} style={{ originX: 0.5, originY: 1 }}>
                <rect x={x} y={190 - h} width="18" height={Math.max(h, 1)} rx="9" fill={`url(#ng${id})`} filter={`url(#glow${id})`} />
                <circle cx={x + 9} cy={190 - h} r="4" fill="var(--brand)" filter={`url(#glow${id})`} />
              </motion.g>
              <text x={x + 9} y="212" textAnchor="middle" className="fill-muted text-[10px]">
                {r.short}
              </text>
              <text x={x + 9} y={180 - h} textAnchor="middle" className="tnum fill-fg text-[11px] font-semibold">
                {r.pct}
              </text>
            </g>
          </Tooltip>
        );
      })}
    </svg>
  );
}

/* ───────── Brutal blocks ───────── */
function Blocks({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="mb-1 flex justify-between gap-2 text-[12.5px] font-semibold text-fg">
            <span className="truncate">
              {r.label} · {r.sub}
            </span>
            <span className="tnum">{r.pct}%</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, k) => (
              <motion.span
                key={k}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + k * 0.025 }}
                className={cn("h-5 flex-1 rounded-[3px] border-2 border-fg", k < Math.round(r.pct / 10) ? "bg-[#c6f432] shadow-[2px_2px_0_var(--fg)]" : "bg-surface")}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ───────── Dot matrix ───────── */
function Dots({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[170px_minmax(0,1fr)_40px]">
          <span className="truncate text-[12.5px] text-fg-2">
            {r.label} <span className="text-faint">{r.sub}</span>
          </span>
          <span className="order-3 col-span-2 flex flex-wrap gap-[3px] sm:order-none sm:col-span-1">
            {Array.from({ length: 25 }).map((_, k) => (
              <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.04 + k * 0.012 }} className={cn("size-[7px] rounded-full", k < Math.round(r.pct / 4) ? "bg-fg" : "bg-subtle-2")} />
            ))}
          </span>
          <span className="tnum text-right text-[12.5px] font-medium text-fg">{r.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────── Classic labeled bars ───────── */
function Classic({ rows }: { rows: Row[] }) {
  return (
    <div>
      <div className="relative ml-[118px] mr-10 flex justify-between text-[11px] text-muted sm:ml-[178px]">
        {[0, 25, 50, 75, 100].map((t) => (
          <span key={t} className="tnum">
            {t}%
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[108px_minmax(0,1fr)_36px] items-center gap-2.5 sm:grid-cols-[168px_minmax(0,1fr)_36px]">
            <span className="truncate text-[13px] font-medium text-fg">
              {r.label}
              <span className="block truncate text-[11.5px] font-normal text-muted">{r.sub}</span>
            </span>
            <span className="relative h-5 rounded-[3px] bg-[repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_25%)]">
              <motion.span className="absolute inset-y-0 left-0 rounded-[3px] bg-brand" initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ delay: i * 0.06, duration: 0.8, ease }} />
            </span>
            <span className="tnum text-right text-[13px] font-semibold text-fg">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Editorial ───────── */
function Editorial({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      {rows.map((r, i) => (
        <li key={r.id} className="min-w-0">
          <p className="tnum font-serif text-[40px] leading-none text-fg">
            {r.pct}
            <span className="text-[22px] text-muted">%</span>
          </p>
          <div className="relative mt-2 h-[2px] bg-line">
            <motion.span className="absolute inset-y-0 left-0 bg-brand" initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ delay: i * 0.07, duration: 0.9, ease }} />
            <motion.span className="absolute -top-[3px] size-2 rounded-full bg-brand" initial={{ left: 0 }} animate={{ left: `calc(${r.pct}% - 4px)` }} transition={{ delay: i * 0.07, duration: 0.9, ease }} />
          </div>
          <p className="mt-2 truncate text-[12.5px] font-medium text-fg">{r.label}</p>
          <p className="truncate text-[11.5px] text-muted">{r.sub}</p>
        </li>
      ))}
    </ul>
  );
}

const RENDER: Record<ChartKind, (p: { rows: Row[] }) => React.ReactNode> = { iso: Iso, rings: Rings, neon: Neon, blocks: Blocks, dots: Dots, classic: Classic, editorial: Editorial };

export function TrustViz({ rows }: { rows: Row[] }) {
  const design = useDesign();
  const [kind, setKind] = React.useState<ChartKind | "auto">("auto");
  const k = kind === "auto" ? design.chart : kind;
  const R = RENDER[k];
  const label = CHARTS.find((c) => c.id === k)?.label;
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-start gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Trust center health</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">Computed from your documents, KSIs, answers, requests and NDAs. Nothing entered by hand.</p>
        </div>
        <Menu>
          <MenuTrigger className="flex h-7 shrink-0 items-center gap-1 rounded-[7px] border border-line px-2 text-[12px] font-medium text-fg-2 outline-none hover:bg-subtle">
            {kind === "auto" ? (
              <>
                <span className="hidden sm:inline">Auto ·&nbsp;</span>
                {label}
              </>
            ) : (
              label
            )}
            <ChevronDown className="size-3.5 text-faint" />
          </MenuTrigger>
          <MenuContent align="end" className="w-52">
            <MenuLabel>Chart style</MenuLabel>
            <MenuCheckboxItem checked={kind === "auto"} onCheckedChange={() => setKind("auto")}>
              Match the design
            </MenuCheckboxItem>
            {CHARTS.map((c) => (
              <MenuCheckboxItem key={c.id} checked={kind === c.id} onCheckedChange={() => setKind(c.id)}>
                {c.label}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
      <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-4 pt-2 sm:px-5">
        <R rows={rows} />
      </motion.div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 sm:px-5">
        {rows
          .filter((r) => r.pct < 100)
          .map((r) => (
            <Link key={r.id} href={r.href} className="text-[11.5px] text-muted hover:text-fg">
              {r.label}: {r.sub} →
            </Link>
          ))}
        {rows.every((r) => r.pct === 100) && <span className="text-[11.5px] text-muted">Everything is at 100%.</span>}
      </div>
    </Card>
  );
}
