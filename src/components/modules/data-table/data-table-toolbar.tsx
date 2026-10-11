"use client";

import type {Table} from "@tanstack/react-table";
import {DataTableViewOptions} from "./data-table-view-options";
import {DataTableDensity} from "./data-table-density";
import {DataTableExport} from "./data-table-export";
import type {DensityState} from "./data-table-types";

type Props<TData> = {
  table: Table<TData>;
  enableColumnVisibility?: boolean;
  enableDensityToggle?: boolean;
  enableExport?: boolean;
  density: DensityState;
  onDensityChange: (density: DensityState) => void;
  onColumnOrderChange?: (order: string[]) => void;
};

export function DataTableToolbar<TData>({
  table, enableColumnVisibility = true, enableDensityToggle = true,
  enableExport = false, density, onDensityChange, onColumnOrderChange
}: Props<TData>) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {enableDensityToggle && <DataTableDensity density={density} onDensityChange={onDensityChange} />}
      {enableExport && <DataTableExport table={table} />}
      {enableColumnVisibility && <DataTableViewOptions table={table} onColumnOrderChange={onColumnOrderChange} />}
    </div>
  );
}
