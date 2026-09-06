"use client"

import { useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import type { DataTableFilterValues } from "@/components/modules/data-table"
import { useReviewOrders } from "./use-review-orders"

export function useReviewOrdersState() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filters, setFilters] = useState<DataTableFilterValues>({})

  const query = useReviewOrders({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: filters.search,
    status: filters.status as never,
    type: filters.type,
    budget_range: filters.budget_range,
    client_id: filters.client_id,
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
  }
}
