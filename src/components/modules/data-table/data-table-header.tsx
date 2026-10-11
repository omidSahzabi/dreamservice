"use client"

import type {Table} from "@tanstack/react-table";
import {DataTableFilterForm} from "./data-table-filter-form";
import { DataTableFilterBar } from "./data-table-filter-bar"
import { DataTableViewOptions } from "./data-table-view-options"
import type {
  DataTableFilterField,
  DataTableFilterValues,
} from "./data-table-filter-types"

type Props<TData> = {
  filterForm?: DataTableFilterField[]
  filterValues: DataTableFilterValues
  onFilterChange?: (values: DataTableFilterValues) => void
  enableColumnVisibility?: boolean
  table: Table<TData>
  onColumnOrderChange?: (order: string[]) => void
}

export function DataTableHeader<TData>({
  filterForm,
  filterValues,
  onFilterChange,
  enableColumnVisibility,
  table,
  onColumnOrderChange,
}: Props<TData>) {
  if (!filterForm?.length && !enableColumnVisibility) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {filterForm?.length ? (
        <DataTableFilterBar filterValues={filterValues} onClearFilters={() => onFilterChange?.({})}>
          <DataTableFilterForm fields={filterForm} values={filterValues} onChange={onFilterChange ?? (() => undefined)} />
        </DataTableFilterBar>
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
  )
}
