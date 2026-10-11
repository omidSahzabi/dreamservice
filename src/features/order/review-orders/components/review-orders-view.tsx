"use client"

import {useTranslations} from "next-intl"
import {localizeApiError} from "@/lib/api/errors"
import {DataTableFilterForm} from "@/components/modules/data-table/data-table-filter-form"
import {
  AlertCircle,
  ClipboardList,
  Inbox,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/modules/data-table/data-table"
import { useReviewOrdersState } from "../hooks/use-review-orders-state"
import { getReviewOrdersFilters } from "../config/review-orders-filters"
import { useReviewOrdersColumns } from "./review-orders-columns"

export function ReviewOrdersView() {
  const t = useTranslations("ReviewOrders")
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
  } = useReviewOrdersState()

  const totalOrders = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="space-y-5 pb-16">
      <ReviewOrdersHeader
        totalOrders={totalOrders}
        hasPagination={Boolean(data?.pagination)}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1633] shadow-lg shadow-black/20">
        <div className="max-w-full overflow-x-auto p-4 sm:p-5">
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            filterForm={<DataTableFilterForm fields={fields} values={filters} onChange={updateFilters} />}
            filterValues={filters}
            onFilterChange={updateFilters}
            enablePagination
            manualPagination
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

      {!isLoading && data?.data?.length === 0 && <EmptyState />}
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
          <h1 className="text-lg font-bold text-white sm:text-xl">
            {t("title")}
          </h1>
          <p className="text-xs text-white/60">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        {hasPagination && (
          <div className="rounded-lg border border-white/10 bg-[#0C1633] px-3 py-1.5 text-xs text-white/80">
            {t("totalCount", {count: totalOrders})}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={onRefresh}
          className="h-9 gap-1.5 rounded-lg border-white/10 bg-[#0C1633] px-3 text-xs text-white/80 hover:bg-[#101C44] hover:text-white"
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

type ErrorStateProps = {
  error: unknown
  onRetry: () => void
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  const t = useTranslations("ReviewOrders")
  const errors = useTranslations("Errors")
  const message = localizeApiError(error, errors)

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
        <AlertCircle className="size-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white">
          {t("errorTitle")}
        </h3>
        <p className="text-xs text-white/60">{message}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-2 gap-2 border-white/10 bg-[#101C44] text-xs text-white/90 hover:bg-[#152352]] hover:text-white"
      >
        <RefreshCw className="size-3.5" />
        <span>{t("retry")}</span>
      </Button>
    </div>
  )
}

function EmptyState() {
  const t = useTranslations("ReviewOrders")
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-[#0C1633]/50 py-14 text-center">
      <Inbox className="size-8 text-white/40" />
      <p className="text-sm font-medium text-white/80">
        {t("emptyTitle")}
      </p>
      <p className="text-xs text-white/40">
        {t("emptyDescription")}
      </p>
    </div>
  )
}
