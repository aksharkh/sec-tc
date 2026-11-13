"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Ellipsis, ExternalLink, Globe2, LockKeyhole, RefreshCw, Upload } from "lucide-react";
import { PageHeader, EmptyState, FileIcon, VisibilityBadge } from "@/components/kit/bits";
import { DataTable } from "@/components/kit/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { CATEGORY_LABEL, PRACTICES } from "@/lib/mock/catalog";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import { useUi } from "@/lib/ui";
import type { DocCategory, TrustDocument, Visibility } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";
import { PageSkeleton } from "./common";
import { UploadDrawer } from "./upload";

export function AdminDocuments() {
  const ready = useReady();
  const [fresh, setFresh] = React.useState<string | null>(null);
  return (
    <>
      {ready ? <DocumentsBody fresh={fresh} /> : <PageSkeleton stats={0} />}
      <UploadDrawer onPublished={setFresh} />
    </>
  );
}

function StaleBanner() {
  const pkg = useTrust((s) => s.pkg);
  if (pkg.status !== "stale") return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-col gap-3 rounded-[10px] border border-warning/30 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center"
    >
      <RefreshCw className="hidden size-4 shrink-0 text-warning-fg sm:block" />
      <p className="flex-1 text-[13px] text-warning-fg">
        Documents changed since package JSON revision {pkg.revision}. Agencies reading the JSON won&apos;t see the change until you regenerate it.
      </p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/admin/machine-readable">
          Regenerate & validate
          <ArrowRight />
        </Link>
      </Button>
    </motion.div>
  );
}

function DocumentsBody({ fresh }: { fresh: string | null }) {
  const router = useRouter();
  const docs = useTrust((s) => s.documents);
  const setVisibility = useTrust((s) => s.setVisibility);
  const patch = useTrust((s) => s.patch);
  const setUi = useUi((s) => s.set);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | DocCategory>("all");
  const [vis, setVis] = React.useState<"all" | Visibility>("all");

  const changeVisibility = React.useCallback(
    (ids: string[], v: Visibility) => {
      const prev = useTrust.getState().documents;
      const prevPkg = useTrust.getState().pkg;
      setVisibility(ids, v);
      toast.success(`${ids.length === 1 ? "Document" : `${ids.length} documents`} now ${v}`, {
        description: v === "public" ? "Anyone can download from the trust page." : "Only approved reviewers can open.",
        action: { label: "Undo", onClick: () => patch({ documents: prev, pkg: prevPkg }) },
      });
    },
    [setVisibility, patch],
  );

  const data = React.useMemo(() => docs.filter((d) => (cat === "all" || d.category === cat) && (vis === "all" || d.visibility === vis)), [docs, cat, vis]);

  const columns = React.useMemo<ColumnDef<TrustDocument, unknown>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        accessorFn: (d) => `${d.title} ${d.summary} ${d.practices.join(" ")}`,
        sortingFn: (a, b) => a.original.title.localeCompare(b.original.title),
        cell: ({ row }) => {
          const d = row.original;
          return (
            <Link href={`/admin/documents/${d.id}`} className="group flex min-w-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <FileIcon kind={d.kind} size={28} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-fg group-hover:text-brand-ink">{d.title}</span>
                <span className="block truncate text-[12px] text-muted">
                  {CATEGORY_LABEL[d.category]}
                  {d.source === "upload" && " · Uploaded here"}
                </span>
              </span>
            </Link>
          );
        },
        meta: { className: "max-w-[340px]" },
      },
      { id: "kind", header: "Type", accessorFn: (d) => d.kind, cell: ({ getValue }) => <span className="font-mono text-[12px] uppercase text-muted">{String(getValue())}</span>, meta: { hideBelow: "md" } },
      { id: "version", header: "Version", accessorFn: (d) => d.versions[0]!.version, cell: ({ getValue }) => <span className="font-mono text-[12px]">v{String(getValue())}</span> },
      {
        id: "updated",
        header: "Last updated",
        accessorFn: (d) => d.versions[0]!.publishedAt,
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted">{fmt.date(String(getValue()))}</span>,
      },
      { id: "visibility", header: "Visibility", accessorFn: (d) => d.visibility, cell: ({ row }) => <VisibilityBadge value={row.original.visibility} /> },
      {
        id: "words",
        header: "Words",
        accessorFn: (d) => d.versions[0]!.words,
        cell: ({ getValue }) => <span className="text-muted">{fmt.num(Number(getValue()))}</span>,
        meta: { align: "right", hideBelow: "lg" },
      },
      {
        id: "practices",
        header: "FedRAMP practices",
        enableSorting: false,
        accessorFn: (d) => d.practices.join(" "),
        cell: ({ row }) => {
          const p = row.original.practices;
          if (!p.length) return <span className="text-faint">None</span>;
          return (
            <div className="flex items-center gap-1">
              {p.slice(0, 2).map((id) => (
                <Tooltip key={id} content={PRACTICES.find((x) => x.id === id)?.name}>
                  <span className="rounded-[5px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">{id}</span>
                </Tooltip>
              ))}
              {p.length > 2 && (
                <Tooltip content={p.slice(2).join(", ")}>
                  <span className="rounded-[5px] px-1 font-mono text-[11px] text-faint">+{p.length - 2}</span>
                </Tooltip>
              )}
            </div>
          );
        },
        meta: { hideBelow: "lg" },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const d = row.original;
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${d.title}`} onClick={(e) => e.stopPropagation()}>
                  <Ellipsis />
                </Button>
              </MenuTrigger>
              <MenuContent onClick={(e) => e.stopPropagation()}>
                <MenuItem onSelect={() => router.push(`/admin/documents/${d.id}`)}>
                  <ArrowRight /> Open details and versions
                </MenuItem>
                <MenuItem onSelect={() => changeVisibility([d.id], d.visibility === "public" ? "restricted" : "public")}>
                  {d.visibility === "public" ? <LockKeyhole /> : <Globe2 />}
                  Make {d.visibility === "public" ? "restricted" : "public"}
                </MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={() => router.push("/t/northwind#documents")}>
                  <ExternalLink /> View on trust page
                </MenuItem>
              </MenuContent>
            </Menu>
          );
        },
        meta: { className: "w-10 text-right" },
      },
    ],
    [router, changeVisibility],
  );

  const counts = {
    package: docs.filter((d) => d.category === "package").length,
    reports: docs.filter((d) => d.category === "reports").length,
    policies: docs.filter((d) => d.category === "policies").length,
  };
  const restricted = docs.filter((d) => d.visibility === "restricted").length;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
      <PageHeader
        title="Documents"
        description={`${docs.length} documents on the trust page: ${docs.length - restricted} public, ${restricted} restricted. Approved files arrive from SecureKnots Workspace; you can also upload here.`}
        actions={
          <Button variant="primary" onClick={() => setUi({ uploadOpen: true })}>
            <Upload />
            Upload document
          </Button>
        }
      />
      <StaleBanner />
      <DataTable
        data={data}
        columns={columns}
        getRowId={(d) => d.id}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search title, summary or KSI"
        selectable
        initialSorting={[{ id: "updated", desc: true }]}
        onRowClick={(d) => router.push(`/admin/documents/${d.id}`)}
        rowClassName={(d) => cn(d.id === fresh && "bg-brand-soft/50")}
        filters={
          <>
            <Chip active={cat === "all"} onClick={() => setCat("all")}>
              All sections
            </Chip>
            <Chip active={cat === "package"} onClick={() => setCat("package")}>
              Certification package <span className="opacity-60">{counts.package}</span>
            </Chip>
            <Chip active={cat === "reports"} onClick={() => setCat("reports")}>
              Reports <span className="opacity-60">{counts.reports}</span>
            </Chip>
            <Chip active={cat === "policies"} onClick={() => setCat("policies")}>
              Policies <span className="opacity-60">{counts.policies}</span>
            </Chip>
            <span className="mx-1 h-4 w-px shrink-0 bg-line-strong" />
            <Chip active={vis === "public"} onClick={() => setVis(vis === "public" ? "all" : "public")}>
              <Globe2 /> Public
            </Chip>
            <Chip active={vis === "restricted"} onClick={() => setVis(vis === "restricted" ? "all" : "restricted")}>
              <LockKeyhole /> Restricted
            </Chip>
          </>
        }
        bulkActions={(rows, clear) => (
          <>
            <Button size="xs" onClick={() => { changeVisibility(rows.map((r) => r.id), "public"); clear(); }}>
              <Globe2 /> Make public
            </Button>
            <Button size="xs" onClick={() => { changeVisibility(rows.map((r) => r.id), "restricted"); clear(); }}>
              <LockKeyhole /> Make restricted
            </Button>
          </>
        )}
        empty={
          <EmptyState
            compact
            title="No documents match"
            body="Change the filters or search, or upload a new document."
            action={
              <Button size="sm" onClick={() => { setQ(""); setCat("all"); setVis("all"); }}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </motion.div>
  );
}
