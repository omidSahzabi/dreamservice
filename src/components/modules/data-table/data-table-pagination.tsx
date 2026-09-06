"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: Props<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;

  const total =
    table.options.rowCount ?? table.getFilteredRowModel().rows.length;

  const pageCount = table.getPageCount();

  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex flex-col gap-4 px-2 py-3 sm:flex-row sm:items-center sm:justify-between text-zinc-300">
      <div className="text-xs sm:text-sm text-zinc-400">
        نمایش <span className="font-semibold text-zinc-200">{from}</span> تا{" "}
        <span className="font-semibold text-zinc-200">{to}</span> از{" "}
        <span className="font-semibold text-primary">{total}</span> مورد
      </div>

      <div className="flex items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs sm:text-sm text-zinc-400">
            تعداد در صفحه:
          </span>

          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[72px] bg-zinc-900 border-zinc-700 text-zinc-200 focus:ring-1 focus:ring-primary">
              <SelectValue />
            </SelectTrigger>

            <SelectContent 
              position="popper"
              className="z-[9999] min-w-[72px] rounded-lg border border-zinc-800 bg-[#09090b] text-zinc-100 shadow-2xl"
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <SelectItem
                  key={size}
                  value={String(size)}
                  className="cursor-pointer text-xs focus:bg-zinc-800 focus:text-zinc-100"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs sm:text-sm font-medium text-zinc-300">
          صفحه {pageIndex + 1} از {Math.max(pageCount, 1)}
        </div>

        <div className="flex items-center gap-1" dir="ltr">
          <Button
            variant="outline"
            size="icon"
            className="hidden h-8 w-8 sm:flex bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="hidden h-8 w-8 sm:flex bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
