"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cardSurface, tableHeadRow, tableRow } from "./surface";
import { EmptyState } from "./empty-state";
import { TableSkeleton } from "./skeleton";
import type { ChipTone } from "./surface";

/**
 * The one table component every admin list page should reach for.
 *
 * Wraps the card, the search/filter strip, the table itself, the empty
 * state, the loading skeleton and the pagination footer — the same ~150
 * lines that used to be hand-copied into every page, kept in one place so
 * a fix here fixes every list at once.
 */

export interface DataTableColumn<T> {
  /** Unique key for this column (used as the React key). */
  key: string;
  header: React.ReactNode;
  /** Tailwind width fragment, e.g. "w-[38%]" or "w-12" for a checkbox column. */
  width?: string;
  align?: "left" | "right";
  headClassName?: string;
  cellClassName?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTablePagination {
  page: number;
  totalPages: number;
  totalItems: number;
  /** Singular noun for the footer count, e.g. "event" → "3 events". */
  itemLabel: string;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  skeletonRows?: number;
  /** Rendered as the bordered strip at the top of the card — search box, filters, bulk actions. */
  toolbar?: React.ReactNode;
  empty: {
    icon: LucideIcon;
    title: string;
    description?: string;
    tone?: ChipTone;
    action?: React.ReactNode;
  };
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  pagination?: DataTablePagination;
  className?: string;
  /**
   * Minimum pixel width for the table before it scrolls horizontally
   * instead of shrinking. `table-fixed` divides that width by each
   * column's `w-[N%]`, so below this a percentage-width column still
   * gets real room for its content rather than being crushed to
   * illegibility on a phone. Defaults to a per-column allowance —
   * override for tables with especially wide cells (avatars + long
   * text, badges + icon buttons, etc).
   */
  minWidth?: number;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  skeletonRows = 6,
  toolbar,
  empty,
  onRowClick,
  rowClassName,
  pagination,
  className,
  minWidth,
}: DataTableProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={skeletonRows} />;
  }

  const tableMinWidth = minWidth ?? Math.max(640, columns.length * 130);

  return (
    <div className={cn(cardSurface, "overflow-hidden", className)}>
      {toolbar && (
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          {toolbar}
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          tone={empty.tone}
          action={empty.action}
        />
      ) : (
        <Table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
          <TableHeader>
            <TableRow className={tableHeadRow}>
              {columns.map((col, i) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "h-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75",
                    col.width,
                    i === 0 && "pl-6",
                    i === columns.length - 1 && "pr-6",
                    col.align === "right" && "text-right",
                    col.headClassName
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={keyExtractor(row)}
                className={cn(tableRow, onRowClick && "cursor-pointer", rowClassName?.(row))}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col, i) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "min-w-0 py-4",
                      i === 0 && "pl-6",
                      i === columns.length - 1 && "pr-6",
                      col.align === "right" && "text-right",
                      col.cellClassName
                    )}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pagination && data.length > 0 && <PaginationFooter {...pagination} />}
    </div>
  );
}

export function PaginationFooter({
  page,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
}: DataTablePagination) {
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 sm:px-6">
      <p className="text-xs text-muted-foreground tabular-nums">
        {totalItems} {itemLabel}
        {totalItems === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          {page} / {totalPages || 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages || totalPages === 0}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
