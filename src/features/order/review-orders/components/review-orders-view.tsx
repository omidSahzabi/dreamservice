"use client"

import { useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import {
  AlertCircle,
  ClipboardList,
  Inbox,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/modules/data-table/data-table"
import { useReviewOrdersState } from "../hooks/use-review-orders-state"
import { reviewOrdersFilters } from "../config/review-orders-filters"
import { reviewOrdersColumns } from "./review-orders-columns"

export function ReviewOrdersView() {
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
            columns={reviewOrdersColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            filterForm={reviewOrdersFilters}
            filterValues={filters}
            onFilterChange={updateFilters}
            enableSearch={false}
            enablePagination
            manualPagination
            pageCount={totalPages}
            rowCount={totalOrders}
            pagination={pagination}
            onPaginationChange={setPagination}
            enableColumnOrdering
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
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ClipboardList className="size-5" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-white sm:text-xl">
            مدیریت و بررسی سفارش‌ها
          </h1>
          <p className="text-xs text-white/60">
            مشاهده و مدیریت درخواست‌های ثبت‌شده در سامانه
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        {hasPagination && (
          <div className="rounded-lg border border-white/10 bg-[#0C1633] px-3 py-1.5 text-xs text-white/80">
            مجموع:{" "}
            <span className="font-bold text-primary">{totalOrders}</span>{" "}
            سفارش
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
          <span>بروزرسانی</span>
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
  const message =
    error instanceof Error
      ? error.message
      : "مشکلی در برقراری ارتباط با سرور رخ داد"

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
        <AlertCircle className="size-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white">
          خطا در دریافت اطلاعات
        </h3>
        <p className="text-xs text-white/60">{message}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-2 gap-2 border-white/10 bg-[#101C44] text-xs text-white/90 hover:bg-[#152352]] hover:text-white"
      >
        <RefreshCw class="size-3.5" />
        <span>تلاش مجدد</span>
      </Button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-[#0C1633]/50 py-14 text-center">
      <Inbox className="size-8 text-white/40" />
      <p className="text-sm font-medium text-white/80">
        هنوز سفارشی ثبت نشده است
      </p>
      <p className="text-xs text-white/40">
        با ثبت اولین سفارش، در این جدول نمایش داده می‌شود
      </p>
    </div>
  )
}
