"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/modules/data-table/data-table-column-header";
import type { Order } from "@/types/order";

export const columns: ColumnDef<Order>[] = [
    
  {
    accessorKey: "order_id",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Order ID"
      />
    ),
  },

  {
    accessorKey: "client_id",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Client"
      />
    ),
  },

  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Type"
      />
    ),
  },

  {
    accessorKey: "page_count",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Pages"
      />
    ),
  },

  {
    accessorKey: "budget_range",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Budget"
      />
    ),
  },

  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Status"
      />
    ),
  },

  {
    accessorKey: "cr",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Created"
      />
    ),
  },
];