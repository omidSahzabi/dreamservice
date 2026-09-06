import type {
  RowData,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";


import type {
  DataTableFilterField,
  DataTableFilterValues,
} from "./data-table-filter-types"


export type DataTableDensity =
  | "compact"
  | "default"
  | "comfortable";

export interface DataTableMeta {
  label?: string;
  draggable?: boolean;
  hideable?: boolean;
  pinned?: "left" | "right" | false;
}

/**
 * Supported filter field types.
 *
 * More types can be added later without changing DataTable itself.
 */
export type DataTableFilterType =
  | "text"
  | "select"
  | "number";

export interface DataTableFilterOption {
  label: string;
  value: string;
}

export interface DataTableFilterConfig {
  /**
   * Query/API key.
   *
   * Example:
   * status
   * type
   * budget_range
   */
  key: string;

  /**
   * Label shown to the user.
   */
  label: string;

  /**
   * Type of filter input.
   */
  type: DataTableFilterType;

  /**
   * Options for select filters.
   */
  options?: DataTableFilterOption[];

  /**
   * Placeholder for text/number inputs.
   */
  placeholder?: string;
}

export type DataTableFilters = Record<
  string,
  string | number | undefined
>;

export interface DataTableStorage {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnPinning: {
    left?: string[];
    right?: string[];
  };
  density: DataTableDensity;
}

export interface DataTableProps<
  TData extends RowData,
  TValue = unknown,
> {
  columns: any[];
  data: TData[];

  storageKey?: string;
  tableId?: string;

  

  isLoading?: boolean;

  /**
   * Server-side filters.
   *
   * When supplied, the filter button is displayed.
   */
  filterForm?: DataTableFilterConfig[];  
  filterValues?: DataTableFilterValues
  onFilterChange?: (values: DataTableFilterValues) => void

  /**
   * Current filters.
   */
  filters?: DataTableFilters;

  /**
   * Called whenever filters change.
   *
   * The parent should use these values
   * to make a new API request.
   */
  onFiltersChange?: (
    filters: DataTableFilters,
  ) => void;

  enableColumnVisibility?: boolean;
  enableColumnOrdering?: boolean;
  enableColumnResizing?: boolean;
  enableColumnPinning?: boolean;
  enablePinning?: boolean;

  enableRowSelection?: boolean;

  enablePagination?: boolean;

  enableExport?: boolean;

  manualPagination?: boolean;

  pageCount?: number;
  rowCount?: number;

  pagination?: PaginationState;

  onPaginationChange?: OnChangeFn<PaginationState>;

  emptyMessage?: string;

  pageSize?: number;

  initialState?: Record<string, any>;
}