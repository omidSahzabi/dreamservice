"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableSkeleton } from "./data-table-skeleton"
import { DataTableToolbar } from "./data-table-toolbar"
import type { DataTableProps } from "./data-table-types"

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  filterForm,
  filterValues = {},
  onFilterChange,
  enableColumnVisibility = true,
  enableColumnResizing = false,
  enablePinning = false,
  enableColumnPinning = false,
  enablePagination = true,
  manualPagination = false,
  pageCount,
  rowCount,
  pagination,
  onPaginationChange,
  onColumnOrderChange,
  emptyMessage = "موردی برای نمایش یافت نشد.",
  initialState,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  )
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<TData, unknown>[],
    manualPagination,
    pageCount: manualPagination ? pageCount : undefined,
    rowCount: manualPagination ? rowCount : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(pagination ? { pagination } : {}),
    },
    enablePinning: enablePinning || enableColumnPinning,
    enableColumnResizing,
    enableSorting: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1)
  const pageSize = table.getState().pagination?.pageSize || 5
  const skeletonRowCount = Math.min(Math.max(pageSize, 5), 10)

  return (
    <div className="w-full space-y-4">
      <DataTableToolbar
        table={table}
        filterForm={filterForm}
        filterValues={filterValues}
        onFilterChange={onFilterChange}
        enableColumnVisibility={enableColumnVisibility}
        onColumnOrderChange={onColumnOrderChange}
      />

      <div
        className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C1633]"
        aria-busy={isLoading}
      >
        <Table>
          <TableHeader className="bg-[#101C44]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-white/[0.08] hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-12 px-4 text-xs font-bold text-white/80"
                    style={{
                      width:
                        header.getSize() !== 150
                          ? header.getSize()
                          : undefined,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="bg-[#0C1633]">
            {isLoading ? (
              <DataTableSkeleton
                rows={skeletonRowCount}
                columns={visibleColumnCount}
              />
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-white/[0.06] bg-transparent transition-colors hover:bg-[#101C44]/70 data-[state=selected]:bg-[#101C44]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-3 text-xs text-white/80"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-32 text-center text-xs text-white/50"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && <DataTablePagination table={table} />}
    </div>
  )
}
