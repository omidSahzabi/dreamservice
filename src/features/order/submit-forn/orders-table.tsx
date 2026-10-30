"use client";

import type { Order } from "@/types/order";

import { DataTable } from "@/components/modules/data-table/data-table";

import { columns } from "./getOrdersColoumns";

interface OrdersTableProps {
  orders: Order[];
}

export function OrdersTable({
  orders,
}: OrdersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={orders}
    />
  );
}
