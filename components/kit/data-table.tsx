"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Rows2, Rows4, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/menu";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    align?: "left" | "right";
    hideBelow?: "sm" | "md" | "lg";
  }
}

const hideCls = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

export function DataTable<T>({
  data,
  columns,
  getRowId,
  search,
  onSearch,
  searchPlaceholder = "Search",
  filters,
  toolbarRight,
  selectable,
  bulkActions,
  empty,
  onRowClick,
  initialSorting = [],
  pageSize,
  maxHeight = 640,
  className,
  minWidth = 760,
  rowClassName,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  selectable?: boolean;
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  initialSorting?: SortingState;
  pageSize?: number;
  maxHeight?: number;
  className?: string;
  minWidth?: number;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: "_select",
        size: 36,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} onClick={(e) => e.stopPropagation()} />
        ),
        meta: { className: "w-10 pr-0" },
      },
      ...columns,
    ];
  }, [columns, selectable]);

  // TanStack Table returns non-memoizable functions; the React Compiler lint rule is expected here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, rowSelection: selection, globalFilter: search ?? "" },
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    enableRowSelection: !!selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize, pageIndex: 0 } } } : {}),
    globalFilterFn: "includesString",
    autoResetPageIndex: true,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const clear = () => setSelection({});
  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className={cn("card overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="relative border-b border-line">
        <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center">
          {onSearch && (
            <div className="relative w-full lg:max-w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 w-full rounded-[8px] border border-line-strong bg-surface pl-8 pr-7 text-[13px] text-fg outline-none placeholder:text-faint focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--ring)] dark:bg-raised"
              />
              {search && (
                <button aria-label="Clear search" onClick={() => onSearch("")} className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-faint hover:text-fg">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {filters && <div className="scroll-thin -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-0.5 lg:pb-0">{filters}</div>}
          <div className="flex items-center gap-1.5 lg:ml-auto">
            {toolbarRight}
            <Tooltip content={density === "comfortable" ? "Compact rows" : "Comfortable rows"}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle row density"
                onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))}
              >
                {density === "comfortable" ? <Rows4 /> : <Rows2 />}
              </Button>
            </Tooltip>
          </div>
        </div>
        <AnimatePresence>
          {selectable && selectedRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-10 flex items-center gap-2 overflow-x-auto bg-fg px-3 text-surface sm:px-4"
            >
              <span className="whitespace-nowrap text-[13px] font-medium">{selectedRows.length} selected</span>
              <div className="ml-2 flex items-center gap-1.5 [&_button]:border-white/15 [&_button]:bg-white/10 [&_button]:text-surface [&_button:hover]:bg-white/20 dark:[&_button]:border-black/15 dark:[&_button]:bg-black/10 dark:[&_button:hover]:bg-black/20">
                {bulkActions?.(selectedRows, clear)}
              </div>
              <button onClick={clear} className="ml-auto inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[12.5px] opacity-80 hover:opacity-100">
                <X className="size-3.5" />
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="scroll-thin overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        "sticky top-0 z-[1] h-9 whitespace-nowrap border-b border-line bg-raised px-3 text-left text-[12px] font-medium text-muted first:pl-4 last:pr-4 dark:bg-[color-mix(in_oklab,var(--surface),var(--raised))]",
                        meta?.align === "right" && "text-right",
                        meta?.hideBelow && hideCls[meta.hideBelow],
                        meta?.className,
                      )}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                    >
                      {h.isPlaceholder ? null : sortable ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("group inline-flex items-center gap-1 rounded hover:text-fg", meta?.align === "right" && "flex-row-reverse")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === "asc" ? (
                            <ArrowUp className="size-3 text-fg" />
                          ) : dir === "desc" ? (
                            <ArrowDown className="size-3 text-fg" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                data-selected={row.getIsSelected() || undefined}
                className={cn(
                  "group/row transition-colors duration-100 hover:bg-raised data-[selected]:bg-brand-soft/60 dark:hover:bg-raised/70",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "border-b border-line px-3 align-middle text-fg first:pl-4 last:pr-4",
                        density === "comfortable" ? "h-[52px] py-2" : "h-9 py-1",
                        meta?.align === "right" && "text-right",
                        meta?.hideBelow && hideCls[meta.hideBelow],
                        meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="border-t border-line">{empty}</div>}
      </div>

      {pageSize && filteredCount > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
          <span>
            {table.getState().pagination.pageIndex * pageSize + 1}–{Math.min(filteredCount, (table.getState().pagination.pageIndex + 1) * pageSize)} of{" "}
            {filteredCount.toLocaleString("en-US")}
          </span>
          <div className="flex items-center gap-1">
            <Button size="icon-xs" variant="secondary" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              <ChevronLeft />
            </Button>
            <span className="px-1.5">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button size="icon-xs" variant="secondary" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
