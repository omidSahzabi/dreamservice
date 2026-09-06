"use client"

import type { Table } from "@tanstack/react-table"
import { DataTableFilterBar } from "./data-table-filter-bar"
import { DataTableViewOptions } from "./data-table-view-options"
import type {
  DataTableFilterField,
  DataTableFilterValues,
} from "./data-table-filter-types"

type Props<TData> = {
  table: Table<TData>
  filterForm?: DataTableFilterField[]
  filterValues?: DataTableFilterValues
  onFilterChange?: (values: DataTableFilterValues) => void
  enableColumnVisibility?: boolean
  onColumnOrderChange?: (order: string[]) => void
}

export function DataTableToolbar<TData>({
  table,
  filterForm,
  filterValues = {},
  onFilterChange,
  enableColumnVisibility = true,
  onColumnOrderChange,
}: Props<TData>) {
  const hasFilters = Boolean(filterForm?.length)

  if (!hasFilters && !enableColumnVisibility) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {hasFilters ? (
          <DataTableFilterBar
            fields={filterForm!}
            values={filterValues}
            onChange={onFilterChange ?? (() => undefined)}
          />
        ) : (
          <div />
        )}

        {enableColumnVisibility && (
          <DataTableViewOptions
            table={table}
            onColumnOrderChange={onColumnOrderChange}
          />
        )}
      </div>
    </div>
  )
}
