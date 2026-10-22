"use client"

import {useTranslations} from "next-intl"
import {localizeApiError} from "@/lib/api/errors"
import {DataTableFilterForm} from "@/components/modules/data-table/data-table-filter-form"
import {
  ClipboardList,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/modules/data-table/data-table"
import { useReviewOrdersState } from "../hooks/use-review-orders-state"
import { getReviewOrdersFilters } from "../config/review-orders-filters"
import { useReviewOrdersColumns } from "./review-orders-columns"

export function ReviewOrdersView() {
  const t = useTranslations("ReviewOrders")
  const errors = useTranslations("Errors")
  const status = useTranslations("OrderStatus")
  const columns = useReviewOrdersColumns()
  const fields = getReviewOrdersFilters(t, status)
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    pagination,
    setPagination,
    filters,
    updateFilters,
    sorting,
    updateSorting,
  } = useReviewOrdersState()

  const totalOrders = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1


  return (
    <div className="space-y-5 pb-16">
      <ReviewOrdersHeader
        totalOrders={totalOrders}
        hasPagination={Boolean(data?.pagination)}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="max-w-full overflow-x-auto p-4 sm:p-5">
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            getRowId={order => String(order.order_id)}
            isLoading={isLoading}
            errorMessage={isError ? localizeApiError(error, errors) : undefined}
            onRetry={() => void refetch()}
            emptyMessage={t("emptyTitle")}
            filterForm={<DataTableFilterForm fields={fields} values={filters} onChange={updateFilters} />}
            filterValues={filters}
            onFilterChange={updateFilters}
            enablePagination
            manualPagination
            manualSorting
            manualFiltering
            sorting={sorting}
            onSortingChange={updateSorting}
            pageCount={totalPages}
            rowCount={totalOrders}
            pagination={pagination}
            onPaginationChange={setPagination}
            enableColumnResizing
            enablePinning
            initialState={{
              columnVisibility: {
                description: false,
              },
            }}
          />
        </div>
      </div>


    </div>
  )
}

type HeaderProps = {
  totalOrders: number
  hasPagination: boolean
  isFetching: boolean
  onRefresh: () => void
}

function ReviewOrdersHeader({
  totalOrders,
  hasPagination,
  isFetching,
  onRefresh,
}: HeaderProps) {
  const t = useTranslations("ReviewOrders")
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ClipboardList className="size-5" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">
            {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        {hasPagination && (
          <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-text-secondary">
            {t("totalCount", {count: totalOrders})}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={onRefresh}
          className="h-9 gap-1.5 rounded-lg border-border bg-card px-3 text-xs text-text-secondary hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw
            className={`size-3.5 ${
              isFetching ? "animate-spin text-primary" : ""
            }`}
          />
          <span>{t("refresh")}</span>
        </Button>
      </div>
    </div>
  )
}
