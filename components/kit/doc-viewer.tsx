"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/menu";
import type { TrustDocument } from "@/lib/types";
import { cn, fmt, mulberry32, nowMs } from "@/lib/utils";

const MAX_THUMBS = 24;
type Zoom = "fit" | "100" | "150";

function seedFor(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Block = { kind: "heading"; w: number } | { kind: "line"; w: number } | { kind: "gap" } | { kind: "table"; rows: number } | { kind: "figure"; h: number };

/** Deterministic body layout for a page, so thumbnails and the main view always match. */
function layoutFor(docId: string, page: number): Block[] {
  const r = mulberry32(seedFor(`${docId}#${page}`));
  const blocks: Block[] = [];
  let budget = 30;
  while (budget > 0) {
    const roll = r();
    if (roll < 0.12 && budget > 8) {
      blocks.push({ kind: "gap" }, { kind: "heading", w: 28 + Math.round(r() * 26) });
      budget -= 3;
    } else if (roll < 0.2 && budget > 10) {
      blocks.push({ kind: "table", rows: 3 + Math.floor(r() * 3) });
      budget -= 8;
    } else if (roll < 0.25 && budget > 10) {
      blocks.push({ kind: "figure", h: 14 + Math.round(r() * 10) });
      budget -= 9;
    } else {
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) blocks.push({ kind: "line", w: i === n - 1 ? 40 + Math.round(r() * 40) : 86 + Math.round(r() * 12) });
      blocks.push({ kind: "gap" });
      budget -= n + 1;
    }
  }
  return blocks;
}

function Watermark({ text, thumb }: { text: string; thumb?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-hidden>
      <div className={cn("-rotate-[30deg] whitespace-nowrap text-center font-medium text-[#1c2436]/[0.12]", thumb ? "text-[3.2cqw]" : "text-[3.1cqw]")}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="py-[5.5cqw]">
            {text} · {text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One paper page. Sizes are container-relative so the same page works as a thumbnail and full size. */
export function PaperPage({
  doc,
  version,
  page,
  total,
  watermark,
  tenantName = "Northwind Cloud",
  thumb,
  className,
}: {
  doc: TrustDocument;
  version: string;
  page: number;
  total: number;
  watermark?: string;
  tenantName?: string;
  thumb?: boolean;
  className?: string;
}) {
  const v = doc.versions.find((x) => x.version === version) ?? doc.versions[0]!;
  const blocks = React.useMemo(() => (page === 1 ? [] : layoutFor(doc.id, page)), [doc.id, page]);
  const lineH = thumb ? "h-[1.6cqw]" : "h-[1.15cqw] min-h-[3px]";
  return (
    <div className={cn("@container relative aspect-[8.5/11] w-full overflow-hidden rounded-[3px] paper", className)}>
      <div className="absolute inset-0 flex flex-col p-[8%] text-[#1c2436]">
        <div className="flex items-center justify-between border-b border-[#1c2436]/15 pb-[2.5cqw] text-[1.9cqw]">
          <span className="font-semibold tracking-wide">{tenantName.toUpperCase()}</span>
          <span className="font-mono text-[#1c2436]/60">
            v{v.version} · {fmt.iso(v.publishedAt)}
          </span>
        </div>

        {page === 1 ? (
          <>
            <div className="mt-[7cqw] font-serif text-[5.4cqw] leading-[1.08]">{doc.title}</div>
            <div className="mt-[2.5cqw] text-[2.1cqw] leading-snug text-[#1c2436]/70">{doc.summary}</div>
            <div className="mt-[5cqw] grid grid-cols-3 gap-[3cqw] border-y border-[#1c2436]/12 py-[2.5cqw] text-[1.8cqw]">
              <div>
                <div className="text-[#1c2436]/50">Classification</div>
                <div className="font-medium">{doc.visibility === "public" ? "Public" : "Controlled"}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[#1c2436]/50">Owner</div>
                <div className="truncate font-medium">{v.author}</div>
              </div>
              <div>
                <div className="text-[#1c2436]/50">Pages</div>
                <div className="font-medium">{total}</div>
              </div>
            </div>
            <div className="mt-[5cqw] space-y-[2.2cqw]">
              <div className={cn("w-[38%] rounded-sm bg-[#1c2436]/70", thumb ? "h-[2cqw]" : "h-[1.6cqw] min-h-[5px]")} />
              {[96, 88, 92, 70, 0, 94, 86, 90, 62].map((w, i) =>
                w === 0 ? <div key={i} className="h-[1.2cqw]" /> : <div key={i} className={cn("rounded-sm bg-[#1c2436]/14", lineH)} style={{ width: `${w}%` }} />,
              )}
            </div>
          </>
        ) : (
          <div className="mt-[5cqw] space-y-[2cqw]">
            {blocks.map((b, i) => {
              if (b.kind === "gap") return <div key={i} className="h-[1.4cqw]" />;
              if (b.kind === "heading") return <div key={i} className={cn("rounded-sm bg-[#1c2436]/65", thumb ? "h-[2cqw]" : "h-[1.5cqw] min-h-[4px]")} style={{ width: `${b.w}%` }} />;
              if (b.kind === "line") return <div key={i} className={cn("rounded-sm bg-[#1c2436]/14", lineH)} style={{ width: `${b.w}%` }} />;
              if (b.kind === "figure")
                return (
                  <div key={i} className="grid place-items-center rounded-[2px] border border-[#1c2436]/15 bg-[#1c2436]/[0.03]" style={{ height: `${b.h}cqw` }}>
                    <div className="h-[40%] w-[60%] rounded-[2px] border border-dashed border-[#1c2436]/20" />
                  </div>
                );
              return (
                <div key={i} className="overflow-hidden rounded-[2px] border border-[#1c2436]/15">
                  {Array.from({ length: b.rows }).map((_, k) => (
                    <div key={k} className={cn("grid grid-cols-[1.2fr_2fr_1fr] gap-[2cqw] px-[2cqw] py-[1.4cqw]", k === 0 ? "bg-[#1c2436]/[0.07]" : "border-t border-[#1c2436]/10")}>
                      <div className={cn("rounded-sm", k === 0 ? "bg-[#1c2436]/40" : "bg-[#1c2436]/14", lineH)} />
                      <div className={cn("rounded-sm", k === 0 ? "bg-[#1c2436]/40" : "bg-[#1c2436]/14", lineH)} />
                      <div className={cn("w-[70%] rounded-sm", k === 0 ? "bg-[#1c2436]/40" : "bg-[#1c2436]/14", lineH)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex justify-between pt-[3cqw] text-[1.6cqw] text-[#1c2436]/45">
          <span className="truncate pr-2">{doc.visibility === "public" ? "Public document" : "Restricted. Shared through SecureKnots Trust."}</span>
          <span className="shrink-0">
            {page} / {total}
          </span>
        </div>
      </div>
      {watermark && <Watermark text={watermark} thumb={thumb} />}
    </div>
  );
}

export function DocViewer({
  doc,
  version,
  viewer,
  watermarkDefault = true,
  watermarkLabel = "Watermark preview",
  tenantName,
  className,
}: {
  doc: TrustDocument;
  version?: string;
  /** Who the watermark names. */
  viewer: { name: string; organization: string };
  watermarkDefault?: boolean;
  watermarkLabel?: string;
  tenantName?: string;
  className?: string;
}) {
  const v = doc.versions.find((x) => x.version === version) ?? doc.versions[0]!;
  const total = Math.max(1, v.pages);
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState<Zoom>("fit");
  const [wmOn, setWmOn] = React.useState(watermarkDefault);
  const [openedAt] = React.useState(() => new Date(nowMs()).toISOString());
  const mainRef = React.useRef<HTMLDivElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  // Reset when another document or version is shown.
  const key = `${doc.id}@${v.version}`;
  const [lastKey, setLastKey] = React.useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPage(1);
  }

  const go = React.useCallback((p: number) => setPage(Math.min(total, Math.max(1, p))), [total]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.getAttribute("role") === "combobox")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPage((p) => Math.min(total, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      } else if (e.key === "Home") setPage(1);
      else if (e.key === "End") setPage(total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    railRef.current?.querySelector<HTMLElement>(`[data-thumb="${Math.min(page, MAX_THUMBS + 1)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);

  const watermark = wmOn ? `${viewer.name} · ${viewer.organization} · ${fmt.dateTime(openedAt)}` : undefined;
  const thumbs = Math.min(total, MAX_THUMBS);
  const more = total - thumbs;
  const pageWidth = zoom === "fit" ? "w-full max-w-[560px]" : zoom === "100" ? "w-[640px] max-w-none" : "w-[960px] max-w-none";

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-surface", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1">
          <Tooltip content="Previous page" shortcut="←">
            <Button size="icon-xs" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}>
              <ChevronLeft />
            </Button>
          </Tooltip>
          <span className="min-w-[92px] text-center text-[12.5px] text-muted" aria-live="polite">
            Page <span className="font-medium text-fg">{page}</span> of {total}
          </span>
          <Tooltip content="Next page" shortcut="→">
            <Button size="icon-xs" variant="ghost" aria-label="Next page" disabled={page >= total} onClick={() => go(page + 1)}>
              <ChevronRight />
            </Button>
          </Tooltip>
        </div>
        <Segmented
          size="sm"
          layoutId={`dv-zoom-${doc.id}`}
          value={zoom}
          onChange={setZoom}
          options={[
            { value: "fit", label: "Fit" },
            { value: "100", label: "100%" },
            { value: "150", label: "150%" },
          ]}
        />
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-fg">
          <Switch checked={wmOn} onCheckedChange={setWmOn} aria-label={watermarkLabel} />
          {watermarkLabel}
        </label>
      </div>

      {/* Body: rail + page */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          ref={railRef}
          className="scroll-thin flex shrink-0 gap-2.5 overflow-x-auto border-b border-line bg-raised p-2.5 md:w-[112px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r dark:bg-[color-mix(in_oklab,var(--surface),var(--raised))]"
          aria-label="Pages"
        >
          {Array.from({ length: thumbs }).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return (
              <button
                key={p}
                data-thumb={p}
                onClick={() => go(p)}
                aria-label={`Page ${p}`}
                aria-current={active ? "page" : undefined}
                className="group flex w-[58px] shrink-0 flex-col items-center gap-1 md:w-full"
              >
                <span className={cn("block w-full rounded-[4px] p-[2px] transition-colors", active ? "bg-fg" : "bg-transparent group-hover:bg-line-strong")}>
                  <PaperPage doc={doc} version={v.version} page={p} total={total} thumb watermark={watermark} tenantName={tenantName} />
                </span>
                <span className={cn("text-[11px]", active ? "font-medium text-fg" : "text-faint")}>{p}</span>
              </button>
            );
          })}
          {more > 0 && (
            <button
              data-thumb={MAX_THUMBS + 1}
              onClick={() => go(page > MAX_THUMBS ? page : MAX_THUMBS + 1)}
              className={cn(
                "grid w-[58px] shrink-0 place-items-center rounded-[4px] border border-dashed py-4 text-[11.5px] font-medium md:w-full",
                page > MAX_THUMBS ? "border-fg text-fg" : "border-line-strong text-muted hover:text-fg",
              )}
            >
              +{more} more
            </button>
          )}
        </div>

        <div ref={mainRef} className="scroll-thin min-h-[320px] min-w-0 flex-1 overflow-auto bg-subtle/70 p-4 sm:p-6">
          <div className={cn("mx-auto transition-[width] duration-200", pageWidth)}>
            <PaperPage doc={doc} version={v.version} page={page} total={total} watermark={watermark} tenantName={tenantName} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-[12px] text-muted">
        <ShieldCheck className="size-3.5 shrink-0" />
        {wmOn ? (
          <span>Downloads carry this watermark and are logged.</span>
        ) : (
          <span>Watermark hidden in this preview. Downloads still carry it and are logged.</span>
        )}
        <span className="ml-auto hidden text-faint sm:inline">Use ← and → to turn pages</span>
      </div>
    </div>
  );
}
