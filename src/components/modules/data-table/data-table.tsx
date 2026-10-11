"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
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
import { DensityState } from "./data-table-types";
import { densityRowClasses, densityCellClasses } from "./data-table-density";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  filterForm?: React.ReactNode;
  filterValues?: Record<string, unknown>;
  onFilterChange?: (values: Record<string, unknown>) => void;
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
  onPaginationChange?: (pagination: PaginationState) => void;
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
  isLoading = false,
  filterForm,
  filterValues,
  onFilterChange,
  enableColumnVisibility = true,
  enablePinning = false,
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
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: currentPagination,
    },
    pageCount: manualPagination ? pageCount : undefined,
    manualPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full space-y-4">
      <DataTableToolbar
        table={table}
        enableColumnVisibility={enableColumnVisibility}
        enableDensityToggle={enableDensityToggle}
        enableExport={enableExport}
        density={density}
        onDensityChange={setDensity}
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
                  <TableHead key={header.id} className="text-start">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
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
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && <DataTablePagination table={table} />}
    </div>
  );
}
