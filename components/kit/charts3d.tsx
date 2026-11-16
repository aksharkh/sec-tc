"use client";

import * as React from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── 3D bar landscape (isometric, rotatable) ─────────
   Rows × columns of bars drawn in SVG with a painter's sort.
   Drag sideways or use the buttons to turn it. Hover a bar to read it. */

type Pt = [number, number];

export function Bars3D({
  rows,
  cols,
  values,
  unit = "events",
  height = 340,
  className,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  unit?: string;
  height?: number;
  className?: string;
}) {
  const [angle, setAngle] = React.useState(-28);
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null);
  const drag = React.useRef<{ x: number; a: number } | null>(null);
  const max = Math.max(1, ...values.flat());
  const R = rows.length;
  const C = cols.length;
  const cell = 1;
  const gap = 0.22;
  const H = 3.2;
  const th = (angle * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const ISO_X = Math.cos(Math.PI / 6);
  const ISO_Y = Math.sin(Math.PI / 6);
  const cx = C / 2;
  const cy = R / 2;

  const project = (x: number, y: number, z: number): Pt => {
    const dx = x - cx;
    const dy = y - cy;
    const xr = dx * cos - dy * sin;
    const yr = dx * sin + dy * cos;
    return [(xr - yr) * ISO_X, (xr + yr) * ISO_Y - z];
  };
  const depth = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * cos - dy * sin + (dx * sin + dy * cos);
  };

  type Face = { pts: Pt[]; shade: number; key: string; r: number; c: number; d: number; top?: boolean };
  const faces: Face[] = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const v = values[r]?.[c] ?? 0;
      const h = Math.max(0.04, (v / max) * H);
      const x0 = c + gap / 2;
      const x1 = c + cell - gap / 2;
      const y0 = r + gap / 2;
      const y1 = r + cell - gap / 2;
      const d = depth(c + 0.5, r + 0.5);
      const sides: { a: [number, number]; b: [number, number]; n: [number, number]; s: number }[] = [
        { a: [x1, y0], b: [x1, y1], n: [1, 0], s: 0.72 },
        { a: [x0, y1], b: [x0, y0], n: [-1, 0], s: 0.72 },
        { a: [x1, y1], b: [x0, y1], n: [0, 1], s: 0.55 },
        { a: [x0, y0], b: [x1, y0], n: [0, -1], s: 0.55 },
      ];
      for (const f of sides) {
        const nx = f.n[0] * cos - f.n[1] * sin;
        const ny = f.n[0] * sin + f.n[1] * cos;
        if (nx + ny <= 0) continue;
        faces.push({
          pts: [project(f.a[0], f.a[1], 0), project(f.b[0], f.b[1], 0), project(f.b[0], f.b[1], h), project(f.a[0], f.a[1], h)],
          shade: f.s,
          key: `${r}-${c}-${f.n.join("")}`,
          r,
          c,
          d,
        });
      }
      faces.push({
        pts: [project(x0, y0, h), project(x1, y0, h), project(x1, y1, h), project(x0, y1, h)],
        shade: 1,
        key: `${r}-${c}-top`,
        r,
        c,
        d: d + 0.001,
        top: true,
      });
    }
  }
  faces.sort((a, b) => a.d - b.d);

  // Floor outline and labels
  const floor = [project(0, 0, 0), project(C, 0, 0), project(C, R, 0), project(0, R, 0)];
  const all = faces.flatMap((f) => f.pts).concat(floor);
  const minX = Math.min(...all.map((p) => p[0])) - 1.6;
  const maxX = Math.max(...all.map((p) => p[0])) + 1.6;
  const minY = Math.min(...all.map((p) => p[1])) - 0.6;
  const maxY = Math.max(...all.map((p) => p[1])) + 1.2;
  const rowLabel = (r: number) => project(-0.35, r + 0.5, 0);
  const colLabel = (c: number) => project(c + 0.5, R + 0.45, 0);
  const pct = (v: number) => v / max;
  const hv = hover ? values[hover.r]?.[hover.c] ?? 0 : 0;

  const rotate = (deg: number) => setAngle((a) => a + deg);

  return (
    <div className={cn("relative select-none", className)}>
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        style={{ height, touchAction: "pan-y" }}
        className="w-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, a: angle };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setAngle(drag.current.a + (e.clientX - drag.current.x) * 0.4);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        role="img"
        aria-label={`3D chart of ${unit} by ${rows.length} rows and ${cols.length} columns. Drag to rotate.`}
      >
        <polygon points={floor.map((p) => p.join(",")).join(" ")} fill="var(--subtle)" opacity={0.6} stroke="var(--line-strong)" strokeWidth={0.02} />
        {faces.map((f) => {
          const t = pct(values[f.r]?.[f.c] ?? 0);
          const isHover = hover?.r === f.r && hover?.c === f.c;
          const base = `color-mix(in oklab, var(--chart-1) ${Math.round(35 + t * 65)}%, var(--surface))`;
          const fill = f.top ? base : `color-mix(in oklab, ${base} ${Math.round(f.shade * 100)}%, black)`;
          return (
            <polygon
              key={f.key}
              points={f.pts.map((p) => p.join(",")).join(" ")}
              fill={isHover ? (f.top ? "var(--chart-2)" : `color-mix(in oklab, var(--chart-2) ${Math.round(f.shade * 100)}%, black)`) : fill}
              stroke="var(--surface)"
              strokeWidth={0.025}
              strokeLinejoin="round"
              onPointerEnter={() => setHover({ r: f.r, c: f.c })}
              onPointerLeave={() => setHover(null)}
            />
          );
        })}
        {rows.map((label, r) => {
          const [x, y] = rowLabel(r);
          return (
            <text key={label} x={x} y={y} fontSize={0.32} textAnchor="end" dominantBaseline="middle" fill="var(--muted)" style={{ fontFamily: "var(--font-geist)" }}>
              {label}
            </text>
          );
        })}
        {cols.map((label, c) => {
          const [x, y] = colLabel(c);
          return (
            <text key={label} x={x} y={y + 0.2} fontSize={0.3} textAnchor="middle" fill="var(--faint)" style={{ fontFamily: "var(--font-geist)" }}>
              {label}
            </text>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-2 min-h-[38px] text-[12px]">
        {hover ? (
          <div className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 shadow-md">
            <span className="font-medium text-fg">{rows[hover.r]}</span>
            <span className="text-muted">, {cols[hover.c]}: </span>
            <span className="font-semibold text-fg">
              {hv} {unit}
            </span>
          </div>
        ) : (
          <span className="text-faint">Drag to rotate · hover a bar</span>
        )}
      </div>
      <div className="absolute right-2 top-1.5 flex gap-1">
        <button aria-label="Rotate left" onClick={() => rotate(-30)} className="grid size-7 place-items-center rounded-[7px] border border-line bg-surface text-muted hover:text-fg">
          <RotateCcw className="size-3.5" />
        </button>
        <button aria-label="Rotate right" onClick={() => rotate(30)} className="grid size-7 place-items-center rounded-[7px] border border-line bg-surface text-muted hover:text-fg">
          <RotateCw className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ───────── Radial bars (polar) ─────────
   One wedge per item, length = value (0–100). Centre shows the overall figure. */
export function RadialBars({
  items,
  center,
  caption,
  size = 240,
}: {
  items: { id: string; label: string; value: number }[];
  center: string;
  caption: string;
  size?: number;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const n = items.length;
  const r0 = 34;
  const L = 74;
  const c = 120;
  const arc = (i: number, v: number) => {
    const span = (Math.PI * 2) / n;
    const a0 = -Math.PI / 2 + i * span + span * 0.08;
    const a1 = a0 + span * 0.84;
    const r1 = r0 + (L * v) / 100;
    const p = (a: number, r: number) => `${(c + Math.cos(a) * r).toFixed(2)},${(c + Math.sin(a) * r).toFixed(2)}`;
    return `M${p(a0, r0)} L${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)} Z`;
  };
  const h = items.find((x) => x.id === hover);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 240 240" className="size-full" role="img" aria-label={caption}>
        {[25, 50, 75, 100].map((g) => (
          <circle key={g} cx={c} cy={c} r={r0 + (L * g) / 100} fill="none" stroke="var(--line)" strokeWidth={0.8} />
        ))}
        {items.map((it, i) => (
          <g key={it.id} onPointerEnter={() => setHover(it.id)} onPointerLeave={() => setHover(null)}>
            <path d={arc(i, 100)} fill="var(--subtle)" opacity={0.6} />
            <path
              d={arc(i, it.value)}
              fill={hover === it.id ? "var(--chart-2)" : `color-mix(in oklab, var(--chart-1) ${Math.round(40 + it.value * 0.6)}%, var(--surface))`}
              stroke="var(--surface)"
              strokeWidth={1.5}
              style={{ transition: "fill 150ms" }}
            />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-fg">{h ? `${h.value}%` : center}</div>
          <div className="mt-1 max-w-[70px] text-[10.5px] leading-tight text-muted">{h ? h.label : caption}</div>
        </div>
      </div>
    </div>
  );
}
