import type { Table } from "@tanstack/react-table";
import type {
  DataTableDensity,
  DataTableStorage,
} from "./data-table-types";

export function getColumnLabel(column: any): string {
  const meta = column.columnDef?.meta;

  if (meta?.label) {
    return meta.label;
  }

  if (typeof column.columnDef?.header === "string") {
    return column.columnDef.header;
  }

  return column.id;
}

export function getInitialColumnOrder(
  table: Table<any>,
): string[] {
  return table.getAllLeafColumns().map(
    (column) => column.id,
  );
}

export function getDensityClass(
  density: DataTableDensity,
): string {
  switch (density) {
    case "compact":
      return "h-8 py-1";

    case "comfortable":
      return "h-14 py-4";

    default:
      return "h-10 py-2";
  }
}

export function downloadCSV<TData>(
  table: Table<TData>,
  filename = "export.csv",
) {
  const rows = table.getFilteredRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  const headers = columns.map((column) =>
    getColumnLabel(column),
  );

  const data = rows.map((row) =>
    columns.map((column) => {
      const value = row.getValue(column.id);

      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "object") {
        return JSON.stringify(value);
      }

      return String(value);
    }),
  );

  const csv = [
    headers,
    ...data,
  ]
    .map((row) =>
      row
        .map((value) => {
          const escaped = String(value)
            .replace(/"/g, '""');

          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;",
    },
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function loadTableStorage(
  storageKey: string,
): Partial<DataTableStorage> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value =
      localStorage.getItem(storageKey);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function saveTableStorage(
  storageKey: string,
  state: DataTableStorage,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(state),
    );
  } catch {
    // Ignore localStorage errors.
  }
}