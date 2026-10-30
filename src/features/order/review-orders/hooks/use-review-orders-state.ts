"use client"

import { useState } from "react"
import type { PaginationState, SortingState, Updater } from "@tanstack/react-table"
import type { DataTableFilterValues } from "@/components/modules/data-table"
import { useReviewOrders } from "./use-review-orders"

export function useReviewOrdersState() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filters, setFilters] = useState<DataTableFilterValues>({})
  const [sorting, setSorting] = useState<SortingState>([{id: "order_id", desc: true}])
  const sort = sorting[0]
  const sortBy = ["order_id", "type", "status", "page_count", "cr"].find((value): value is "order_id" | "type" | "status" | "page_count" | "cr" => value === sort?.id) ?? "order_id"

  const query = useReviewOrders({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    type: filters.type,
    budget_range: filters.budget_range,
    client_id: filters.client_id,
    sortBy,
    sortOrder: sort?.desc === false ? "asc" : "desc",
  })

  const updateFilters = (values: DataTableFilterValues) => {
    setFilters(values)
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  return {
    ...query,
    pagination,
    setPagination,
    filters,
    updateFilters,
    sorting,
    updateSorting: (updater: Updater<SortingState>) => {
      setSorting(current => typeof updater === "function" ? updater(current) : updater)
      setPagination(current => ({...current, pageIndex: 0}))
    },
  }
}
