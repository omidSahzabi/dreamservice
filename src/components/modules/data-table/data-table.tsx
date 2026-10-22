"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  OnChangeFn,
  ColumnOrderState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableFilterBar } from "./data-table-filter-bar";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTableSkeleton } from "./data-table-skeleton";
import type {DataTableFilterValues} from "./data-table-filter-types";
import { DensityState } from "./data-table-types";
import { densityRowClasses, densityCellClasses } from "./data-table-density";

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  manualFiltering?: boolean;
  filterForm?: React.ReactNode;
  filterValues?: DataTableFilterValues;
  onFilterChange?: (values: DataTableFilterValues) => void;
  enableColumnVisibility?: boolean;
  enableColumnResizing?: boolean;
  enablePinning?: boolean;
  enableDensityToggle?: boolean;
  enableExport?: boolean;
  enablePagination?: boolean;
  manualPagination?: boolean;
  pageCount?: number;
  rowCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  onColumnOrderChange?: (columnOrder: string[]) => void;
  initialState?: {
    density?: DensityState;
    columnVisibility?: VisibilityState;
  };
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  isLoading = false,
  errorMessage,
  onRetry,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
  manualFiltering = false,
  filterForm,
  filterValues,
  onFilterChange,
  enableColumnVisibility = true,
  enableDensityToggle = true,
  enableExport = false,
  enablePagination = true,
  manualPagination = false,
  pageCount,
  rowCount,
  pagination,
  onPaginationChange,
  onColumnOrderChange,
  initialState,
  emptyMessage,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("DataTable");
  const resolvedEmptyMessage = emptyMessage ?? t("empty");

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  );
  const [density, setDensity] = React.useState<DensityState>(
    initialState?.density ?? "default"
  );
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const currentPagination = pagination ?? internalPagination;
  const handlePaginationChange = onPaginationChange ?? setInternalPagination;

  const table = useReactTable({
    data,
    getRowId,
    columns,
    state: {
      sorting: controlledSorting ?? sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      pagination: currentPagination,
    },
    pageCount: manualPagination ? pageCount : undefined,
    manualPagination,
    onSortingChange: onSortingChange ?? setSorting,
    manualSorting,
    manualFiltering,
    onColumnFiltersChange: setColumnFilters,
    rowCount: manualPagination ? rowCount : undefined,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: updater => handlePaginationChange(typeof updater === "function" ? updater(currentPagination) : updater),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full space-y-4" aria-busy={isLoading}>
      {errorMessage && <div role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
        <p>{errorMessage}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-2 underline">{t("retry")}</button>}
      </div>}
      <DataTableToolbar
        table={table}
        enableColumnVisibility={enableColumnVisibility}
        enableDensityToggle={enableDensityToggle}
        enableExport={enableExport}
        density={density}
        onDensityChange={setDensity}
        onColumnOrderChange={order => {setColumnOrder(order); onColumnOrderChange?.(order);}}
      />

      {filterForm && (
        <DataTableFilterBar
          filterValues={filterValues}
          onClearFilters={() => onFilterChange?.({})}
        >
          {filterForm}
        </DataTableFilterBar>
      )}

      <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-start" aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {errorMessage ? null : isLoading ? (
              <DataTableSkeleton columns={columns.length} rows={5} />
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={densityRowClasses[density]}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={densityCellClasses[density]}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-start text-muted-foreground lg:text-center">
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && !errorMessage && <DataTablePagination table={table} rowCount={manualPagination ? rowCount : undefined} />}
    </div>
  );
}
