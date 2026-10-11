import {z} from "zod"
import {ApiError, fetchJson} from "@/lib/api/errors"
import { useQuery } from "@tanstack/react-query"
import type {
  OrdersApiResponse,
  OrdersQueryParams,
} from "../types"

const FILTER_KEYS = [
  "search",
  "status",
  "type",
  "budget_range",
  "client_id",
] as const

function buildQuery(params: OrdersQueryParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.page) {
    searchParams.set("page", String(params.page))
  }

  if (params.limit) {
    searchParams.set("limit", String(params.limit))
  }

  for (const key of FILTER_KEYS) {
    const value = params[key]

    if (value) {
      searchParams.set(key, String(value))
    }
  }

  return searchParams.toString()
}

async function fetchOrders(
  params: OrdersQueryParams,
): Promise<OrdersApiResponse> {
  const query = buildQuery(params)
  const url = `/api/order/load-orders${query ? `?${query}` : ""}`

  const result = z.object({
    success: z.literal(true),
    data: z.array(z.object({
      order_id: z.number(), client_id: z.string(), type: z.string().nullable(),
      page_count: z.number().nullable(), budget_range: z.string().nullable(),
      description: z.string().nullable(), status: z.string().nullable(), cr: z.string().nullable(),
      meta: z.object({full_name: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), company: z.string().optional()}).nullable()
    })),
    pagination: z.object({page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(), hasNextPage: z.boolean(), hasPrevPage: z.boolean()})
  }).safeParse(await fetchJson(url, "ORDER_LOAD_FAILED", {credentials: "include"}))
  if (!result.success) throw new ApiError("ORDER_LOAD_FAILED")
  return result.data
}

export function useReviewOrders(params: OrdersQueryParams) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => fetchOrders(params),
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData,
  })
}
