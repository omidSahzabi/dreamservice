





export type DataTableDensity =
  | "compact"
  | "default"
  | "comfortable";

export type DensityState = DataTableDensity;

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

export type {DataTableProps} from "./data-table";
