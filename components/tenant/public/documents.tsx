"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Download, FileArchive, LayoutGrid, List, LockKeyhole, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/dialog";
import { EmptyState, FileIcon, VisibilityBadge } from "@/components/kit/bits";
import { DocPreview } from "@/components/kit/widgets";
import { CATEGORY_LABEL, PRACTICES } from "@/lib/mock/catalog";
import { useTrust } from "@/lib/store";
import type { DocCategory, TrustDocument } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";
import { Section } from "./layout";

type Filter = "all" | DocCategory;
const GROUPS: DocCategory[] = ["package", "reports", "policies"];

export function useDownloadPublic() {
  const logEvent = useTrust((s) => s.logEvent);
  return React.useCallback(
    (d: TrustDocument) => {
      const v = d.versions[0]!;
      logEvent({ actor: "Public visitor", handle: "anonymous", actorKind: "person", agencyId: "other", docId: d.id, target: d.title, action: "download", channel: "web" });
      toast.success(`Downloading ${d.title}`, { description: `${d.kind.toUpperCase()} · ${fmt.size(v.sizeKb)} · version ${v.version}. Demo files are placeholders.` });
    },
    [logEvent],
  );
}

export function Documents({
  basket,
  setBasket,
  onRequest,
  onOpenDoc,
}: {
  basket: string[];
  setBasket: (ids: string[]) => void;
  onRequest: (ids: string[]) => void;
  onOpenDoc: (d: TrustDocument) => void;
}) {
  const docs = useTrust((s) => s.documents);
  const download = useDownloadPublic();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [expanded, setExpanded] = React.useState<DocCategory[]>([]);

  const counts = React.useMemo(() => {
    const c = { all: docs.length, package: 0, reports: 0, policies: 0 } as Record<Filter, number>;
    docs.forEach((d) => (c[d.category] += 1));
    return c;
  }, [docs]);
  const shown = docs.filter(
    (d) => (filter === "all" || d.category === filter) && (!q || `${d.title} ${d.summary} ${d.practices.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const publicDocs = docs.filter((d) => d.visibility === "public");
  const toggle = (id: string) => setBasket(basket.includes(id) ? basket.filter((b) => b !== id) : [...basket, id]);

  return (
    <Section
      id="documents"
      title="Documents"
      lead={
        <>
          {docs.length} documents. Public ones download directly. Select restricted ones and request them together; Northwind sees exactly what you need.
        </>
      }
      aside={
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            toast.success(`Downloading ${publicDocs.length} public documents`, {
              description: `northwind-public-documents.zip, ${fmt.size(publicDocs.reduce((a, d) => a + d.versions[0]!.sizeKb, 0))}. Demo files are placeholders.`,
            })
          }
        >
          <FileArchive /> All public documents (ZIP)
        </Button>
      }
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, summary or KSI"
            aria-label="Search documents"
            className="h-10 w-full rounded-[9px] border border-line-strong bg-surface pl-9 pr-8 text-[13.5px] text-fg outline-none placeholder:text-faint focus-visible:border-fg/40 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmented
            layoutId="pub-doc-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "package", label: "Package", count: counts.package },
              { value: "reports", label: "Reports", count: counts.reports },
              { value: "policies", label: "Policies", count: counts.policies },
            ]}
          />
        </div>
        <div className="hidden md:ml-auto md:block">
          <Segmented
            size="sm"
            layoutId="pub-doc-view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: <span className="sr-only">List</span>, icon: <List /> },
              { value: "grid", label: <span className="sr-only">Grid</span>, icon: <LayoutGrid /> },
            ]}
          />
        </div>
      </div>

      <div className="mt-5">
        {shown.length === 0 ? (
          <div className="rounded-[12px] border border-line">
            <EmptyState compact title="No matching documents" body="Try another word, or clear the search." action={<Button size="sm" onClick={() => { setQ(""); setFilter("all"); }}>Clear</Button>} />
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((d) => (
              <DocCard key={d.id} doc={d} selected={basket.includes(d.id)} onToggle={() => toggle(d.id)} onDownload={() => download(d)} onOpen={() => onOpenDoc(d)} />
            ))}
          </div>
        ) : (
          GROUPS.filter((g) => filter === "all" || g === filter).map((g) => {
            const all = shown.filter((d) => d.category === g);
            if (!all.length) return null;
            const collapsed = !q && filter === "all" && !expanded.includes(g) && all.length > 5;
            const items = collapsed ? all.slice(0, 5) : all;
            return (
              <div key={g} className="mb-6 last:mb-0">
                <div className="mb-1 flex items-baseline justify-between border-b border-line-strong pb-2">
                  <span className="text-[13px] font-semibold text-fg">{CATEGORY_LABEL[g]}</span>
                  <span className="text-[12px] text-faint">{all.length}</span>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((d) => (
                    <DocRow key={d.id} doc={d} selected={basket.includes(d.id)} onToggle={() => toggle(d.id)} onDownload={() => download(d)} onOpen={() => onOpenDoc(d)} />
                  ))}
                </ul>
                {collapsed && (
                  <button onClick={() => setExpanded([...expanded, g])} className="mt-2 text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
                    Show all {all.length} {CATEGORY_LABEL[g].toLowerCase()}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {basket.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="sticky bottom-20 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-line-strong bg-surface px-4 py-3 shadow-lg"
          >
            <span className="grid size-8 place-items-center rounded-full bg-tenant text-[13px] font-semibold text-tenant-fg">{basket.length}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-fg">
                {basket.length} restricted {basket.length === 1 ? "document" : "documents"} selected
              </div>
              <div className="truncate text-[12px] text-muted">{basket.map((id) => docs.find((d) => d.id === id)?.title).join(", ")}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setBasket([])}>
              Clear
            </Button>
            <Button size="sm" variant="tenant" onClick={() => onRequest(basket)}>
              Request these documents
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

function SelectToggle({ selected, onToggle, title }: { selected: boolean; onToggle: () => void; title: string }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={selected ? `Remove ${title} from request` : `Add ${title} to request`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors",
        selected ? "border-tenant bg-tenant-soft text-fg" : "border-line-strong text-muted hover:bg-subtle hover:text-fg",
      )}
    >
      {selected ? <Check className="size-3.5 text-tenant" /> : <Plus className="size-3.5" />}
      <span className="hidden sm:inline">{selected ? "Added" : "Add to request"}</span>
    </button>
  );
}

function DocRow({ doc, selected, onToggle, onDownload, onOpen }: { doc: TrustDocument; selected: boolean; onToggle: () => void; onDownload: () => void; onOpen: () => void }) {
  const v = doc.versions[0]!;
  return (
    <li className={cn("group -mx-3 flex items-start gap-3.5 rounded-[10px] px-3 py-3.5 transition-colors sm:items-center", selected ? "bg-tenant-soft/50" : "hover:bg-raised")}>
      <FileIcon kind={doc.kind} size={30} className="mt-0.5 sm:mt-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button onClick={onOpen} className="text-left text-[14px] font-medium text-fg underline-offset-4 hover:underline">
            {doc.title}
          </button>
          {doc.visibility === "restricted" && <LockKeyhole className="size-3 text-faint" aria-label="Restricted" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-faint">
          <span>v{v.version}</span>
          <span aria-hidden>·</span>
          <span>{fmt.date(v.publishedAt)}</span>
          {doc.practices.length > 0 && (
            <>
              <span aria-hidden className="hidden md:inline">·</span>
              <span className="hidden font-mono text-[11px] md:inline">{doc.practices.slice(0, 3).join("  ")}{doc.practices.length > 3 ? `  +${doc.practices.length - 3}` : ""}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {doc.visibility === "public" ? (
          <Button size="sm" variant="ghost" onClick={onDownload} aria-label={`Download ${doc.title}`}>
            <Download />
            <span className="hidden sm:inline">Download</span>
          </Button>
        ) : (
          <SelectToggle selected={selected} onToggle={onToggle} title={doc.title} />
        )}
      </div>
    </li>
  );
}

function DocCard({ doc, selected, onToggle, onDownload, onOpen }: { doc: TrustDocument; selected: boolean; onToggle: () => void; onDownload: () => void; onOpen: () => void }) {
  const v = doc.versions[0]!;
  return (
    <div className={cn("flex flex-col rounded-[12px] border bg-surface p-4 transition-colors", selected ? "border-tenant" : "border-line hover:border-line-strong")}>
      <div className="flex items-start justify-between gap-3">
        <FileIcon kind={doc.kind} size={34} />
        <VisibilityBadge value={doc.visibility} />
      </div>
      <button onClick={onOpen} className="mt-4 text-left text-[14px] font-medium leading-snug text-fg underline-offset-4 hover:underline">
        {doc.title}
      </button>
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{doc.summary}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="text-[12px] text-faint">
          v{v.version} · {fmt.short(v.publishedAt)}
        </span>
        {doc.visibility === "public" ? (
          <Button size="xs" variant="secondary" onClick={onDownload}>
            <Download /> Download
          </Button>
        ) : (
          <SelectToggle selected={selected} onToggle={onToggle} title={doc.title} />
        )}
      </div>
    </div>
  );
}

/* ───────── Document sheet ───────── */
export function DocSheet({
  doc,
  onClose,
  inBasket,
  onToggleBasket,
}: {
  doc: TrustDocument | null;
  onClose: () => void;
  inBasket: boolean;
  onToggleBasket: (id: string) => void;
}) {
  const download = useDownloadPublic();
  return (
    <Sheet open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width={560}>
        {doc && (
          <>
            <SheetHeader title={doc.title} description={`${CATEGORY_LABEL[doc.category]} · version ${doc.versions[0]!.version} · ${fmt.date(doc.versions[0]!.publishedAt)}`}>
              <div className="mt-2">
                <VisibilityBadge value={doc.visibility} />
              </div>
            </SheetHeader>
            <SheetBody className="grid grid-cols-1 content-start gap-5">
              <p className="text-[13.5px] leading-relaxed text-fg">{doc.summary}</p>
              <div className="relative rounded-[10px] bg-subtle/70 px-6 py-6">
                <DocPreview doc={doc} />
                {doc.visibility === "restricted" && (
                  <div className="absolute inset-0 grid place-items-center rounded-[10px] bg-canvas/70 backdrop-blur-[3px]">
                    <div className="max-w-[260px] text-center">
                      <LockKeyhole className="mx-auto size-5 text-muted" />
                      <div className="mt-2 text-[13.5px] font-medium text-fg">Restricted document</div>
                      <p className="mt-1 text-[12.5px] text-muted">Approved reviewers can preview and download it from the reviewer portal.</p>
                    </div>
                  </div>
                )}
              </div>
              {doc.practices.length > 0 && (
                <div>
                  <div className="text-[12px] font-medium text-muted">Key Security Indicators</div>
                  <ul className="mt-2 grid gap-1.5">
                    {doc.practices.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-[13px]">
                        <span className="w-[62px] font-mono text-[11.5px] text-muted">{p}</span>
                        <span className="text-fg">{PRACTICES.find((x) => x.id === p)?.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="text-[12px] font-medium text-muted">Version history</div>
                <ul className="mt-2 divide-y divide-line">
                  {doc.versions.slice(0, 5).map((v) => (
                    <li key={v.version} className="flex items-baseline justify-between gap-4 py-2 text-[13px]">
                      <span className="font-mono text-[12px] text-fg">v{v.version}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{v.note}</span>
                      <span className="shrink-0 text-[12px] text-faint">{fmt.date(v.publishedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {doc.visibility === "public" ? (
                <Button variant="tenant" onClick={() => download(doc)}>
                  <Download /> Download
                </Button>
              ) : (
                <Button variant={inBasket ? "secondary" : "tenant"} onClick={() => onToggleBasket(doc.id)}>
                  {inBasket ? <Check /> : <Plus />}
                  {inBasket ? "Added to request" : "Add to request"}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
