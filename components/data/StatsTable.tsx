"use client";

import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatsTableRow = Record<string, unknown>;

export interface StatsTableColumn {
  key: string;
  label: string;
  format?: (value: unknown, row: StatsTableRow) => string | React.ReactNode;
  className?: string;
  /** When set, header is clickable and rows are ordered by this column */
  sortable?: boolean;
  /** Direction used on first click for this column */
  sortDefault?: "asc" | "desc";
  /** Custom value for ordering (e.g. combine team + manager) */
  sortValue?: (row: object) => string | number;
}

interface StatsTableProps<T extends object = object> {
  title: string;
  data: T[];
  columns: StatsTableColumn[];
  className?: string;
  /** If set, use this field on each row as React `key` when present */
  rowKeyField?: keyof T & string;
}

function rowRecord(row: object): StatsTableRow {
  return row as StatsTableRow;
}

function defaultCellContent(raw: unknown): React.ReactNode {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  if (React.isValidElement(raw)) {
    return raw;
  }
  return String(raw);
}

function compareSortValues(
  a: string | number,
  b: string | number,
  direction: "asc" | "desc",
): number {
  if (typeof a === "number" && typeof b === "number") {
    const cmp = a - b;
    return direction === "asc" ? cmp : -cmp;
  }
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

function getCellSortValue(column: StatsTableColumn, row: object): string | number {
  if (column.sortValue) {
    return column.sortValue(row);
  }
  const raw = rowRecord(row)[column.key];
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw == null) {
    return "";
  }
  return String(raw);
}

export function StatsTable<T extends object = object>({
  title,
  data,
  columns,
  className = "",
  rowKeyField,
}: StatsTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    if (sortKey === null) {
      return data;
    }
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortable) {
      return data;
    }
    const copy = [...data];
    copy.sort((left, right) =>
      compareSortValues(
        getCellSortValue(column, left),
        getCellSortValue(column, right),
        sortDirection,
      ),
    );
    return copy;
  }, [columns, data, sortDirection, sortKey]);

  const handleSortClick = (column: StatsTableColumn) => {
    if (!column.sortable) {
      return;
    }
    const defaultDir = column.sortDefault ?? "asc";
    if (sortKey === column.key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection(defaultDir);
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const isActive = sortKey === column.key;
                const ariaSort =
                  column.sortable && isActive
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : column.sortable
                      ? "none"
                      : undefined;

                const headerAlign = column.className?.includes("text-center")
                  ? "flex w-full justify-center"
                  : column.className?.includes("text-right")
                    ? "flex w-full justify-end"
                    : "inline-flex";

                return (
                  <TableHead
                    key={column.key}
                    className={column.className}
                    aria-sort={ariaSort}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className={cn(
                          headerAlign,
                          "items-center gap-1 rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                        onClick={() => handleSortClick(column)}
                      >
                        <span>{column.label}</span>
                        {isActive ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown
                            className="h-3.5 w-3.5 shrink-0 opacity-40"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, rowIndex) => {
                const rec = rowRecord(row);
                const keyFromField =
                  rowKeyField && rec[rowKeyField] != null
                    ? String(rec[rowKeyField])
                    : null;
                return (
                  <TableRow key={keyFromField ?? rowIndex}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.format && rec[column.key] !== undefined
                          ? column.format(rec[column.key], rec)
                          : defaultCellContent(rec[column.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
