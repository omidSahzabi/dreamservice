"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
} from "lucide-react";

import type {
  Column,
} from "@tanstack/react-table";

import {
  Button,
} from "@/components/ui/button";

interface Props<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<
  TData,
  TValue,
>({
  column,
  title,
}: Props<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className="font-medium">
        {title}
      </div>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        column.toggleSorting()
      }
      className="-ml-3 h-8"
    >
      {title}

      {sorted === "asc" && (
        <ArrowUp className="ml-2 h-4 w-4" />
      )}

      {sorted === "desc" && (
        <ArrowDown className="ml-2 h-4 w-4" />
      )}

      {!sorted && (
        <ChevronsUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}