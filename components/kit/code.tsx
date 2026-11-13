"use client";

import * as React from "react";
import type { DiffLine } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CopyButton } from "./bits";

/** Light JSON syntax colors that work on both themes. */
function highlightJsonLine(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) {
      if (m[2]) {
        out.push(
          <span key={i++} className="text-[#1f3fae] dark:text-[#e5e5e5]">
            {m[1]}
          </span>,
          <span key={i++} className="text-muted">
            {m[2]}
          </span>,
        );
      } else {
        out.push(
          <span key={i++} className="text-[#0f7a5a] dark:text-[#a7d8b8]">
            {m[1]}
          </span>,
        );
      }
    } else if (m[3]) {
      out.push(
        <span key={i++} className="text-[#a3420f] dark:text-[#e8b98f]">
          {m[3]}
        </span>,
      );
    } else if (m[4]) {
      out.push(
        <span key={i++} className="text-[#a3420f] dark:text-[#e8b98f]">
          {m[4]}
        </span>,
      );
    } else if (m[5]) {
      out.push(
        <span key={i++} className="text-faint">
          {m[5]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeViewer({
  code,
  language = "json",
  title,
  className,
  maxHeight = 460,
  copy = true,
  wrap,
  actions,
}: {
  code: string;
  language?: "json" | "shell" | "text";
  title?: React.ReactNode;
  className?: string;
  maxHeight?: number | "none";
  copy?: boolean;
  wrap?: boolean;
  actions?: React.ReactNode;
}) {
  const lines = code.split("\n");
  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-line bg-raised", className)}>
      {(title || copy || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 dark:bg-[color-mix(in_oklab,var(--surface),var(--raised))]">
          <div className="min-w-0 truncate font-mono text-[12px] text-muted">{title}</div>
          <div className="flex items-center gap-1.5">
            {actions}
            {copy && <CopyButton value={code} toastText={language === "json" ? "JSON copied" : "Copied to clipboard"} />}
          </div>
        </div>
      )}
      <div className="scroll-thin overflow-auto" style={{ maxHeight: maxHeight === "none" ? undefined : maxHeight }}>
        <pre className={cn("py-3 font-mono text-[12px] leading-[1.7]", wrap && "whitespace-pre-wrap break-all")}>
          {lines.map((l, idx) => (
            <div key={idx} className="flex hover:bg-subtle/60">
              {language === "json" && (
                <span className="sticky left-0 w-10 shrink-0 select-none bg-raised pr-3 text-right text-faint/70">{idx + 1}</span>
              )}
              <span className={cn("pr-4", language !== "json" && "pl-4")}>
                {language === "json" ? highlightJsonLine(l) : language === "shell" ? highlightShell(l) : l}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function highlightShell(line: string): React.ReactNode {
  if (line.trimStart().startsWith("#")) return <span className="text-faint">{line}</span>;
  const parts = line.split(/(\s-[A-Za-z]+\b|"[^"]*"|https?:\/\/\S+)/g);
  return parts.map((p, i) => {
    if (/^\s-[A-Za-z]+$/.test(p)) return <span key={i} className="text-[#a3420f] dark:text-[#e8b98f]">{p}</span>;
    if (/^"/.test(p)) return <span key={i} className="text-[#0f7a5a] dark:text-[#a7d8b8]">{p}</span>;
    if (/^https?:/.test(p)) return <span key={i} className="text-[#1f3fae] dark:text-[#e5e5e5]">{p}</span>;
    if (i === 0 && p.startsWith("curl")) return <span key={i} className="font-semibold">{p}</span>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

/** Unified diff with context folding. */
export function DiffViewer({ lines, className, context = 3 }: { lines: DiffLine[]; className?: string; context?: number }) {
  const changed = lines.map((l) => l.kind !== "same");
  const keep = lines.map((_, i) => {
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) if (changed[k]) return true;
    return false;
  });
  const rows: ({ type: "line"; line: DiffLine } | { type: "gap"; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap) rows.push({ type: "gap", count: gap });
      gap = 0;
      rows.push({ type: "line", line: l });
    } else gap++;
  });
  if (gap) rows.push({ type: "gap", count: gap });
  return (
    <div className={cn("scroll-thin overflow-auto rounded-[10px] border border-line bg-raised", className)}>
      <pre className="min-w-max py-2 font-mono text-[12px] leading-[1.7]">
        {rows.map((r, i) =>
          r.type === "gap" ? (
            <div key={i} className="my-1 bg-subtle px-3 py-0.5 text-[11.5px] text-faint">
              {r.count} unchanged lines
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "flex",
                r.line.kind === "add" && "bg-success-soft text-success-fg",
                r.line.kind === "del" && "bg-danger-soft text-danger-fg",
              )}
            >
              <span className="w-9 shrink-0 select-none pr-1 text-right text-faint/70">{r.line.a ?? ""}</span>
              <span className="w-9 shrink-0 select-none pr-1 text-right text-faint/70">{r.line.b ?? ""}</span>
              <span className="w-5 shrink-0 select-none text-center">{r.line.kind === "add" ? "+" : r.line.kind === "del" ? "−" : ""}</span>
              <span className="pr-4">{r.line.kind === "same" ? highlightJsonLine(r.line.text) : r.line.text}</span>
            </div>
          ),
        )}
      </pre>
    </div>
  );
}
