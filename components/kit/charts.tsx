"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/utils";

type Series = { key: string; label: string; color: string };

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number | string }[];
};

function ChartTooltip({ active, payload, label, series, unit }: TipProps & { series: Series[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + Number(p.value ?? 0), 0);
  return (
    <div className="min-w-[160px] rounded-[9px] border border-line bg-surface px-3 py-2.5 text-[12.5px] shadow-md dark:bg-raised">
      <div className="mb-1.5 font-medium text-fg">{label}</div>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <div key={s.key} className="flex items-center justify-between gap-4 py-0.5 text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-medium text-fg">{fmt.num(Number(p?.value ?? 0))}</span>
          </div>
        );
      })}
      {series.length > 1 && (
        <div className="mt-1 flex justify-between border-t border-line pt-1 text-muted">
          <span>Total {unit}</span>
          <span className="font-medium text-fg">{fmt.num(total)}</span>
        </div>
      )}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Stacked columns with a 2px surface gap between segments and rounded data-ends. */
export function StackedBars({
  data,
  series,
  xKey,
  height = 240,
  unit = "events",
  tickEvery,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  xKey: string;
  height?: number;
  unit?: string;
  tickEvery?: number;
}) {
  const interval = tickEvery ?? Math.max(0, Math.ceil(data.length / 7) - 1);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval={interval} tick={{ fill: "var(--muted)", fontSize: 11.5 }} dy={6} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11.5 }} width={44} />
          <Tooltip
            cursor={{ fill: "var(--subtle)", opacity: 0.7 }}
            content={(p) => <ChartTooltip {...(p as unknown as TipProps)} series={series} unit={unit} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              maxBarSize={24}
              stroke="var(--surface)"
              strokeWidth={series.length > 1 ? 1 : 0}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive
              animationDuration={500}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Inline horizontal meter for ranked lists (top documents, per-agency totals). */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <div className={className}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-soft">
        <div className="h-full rounded-full bg-[var(--chart-1)] transition-[width] duration-500" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
