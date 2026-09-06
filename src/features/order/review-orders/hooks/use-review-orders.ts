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

  const response = await fetch(url, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("خطا در دریافت سفارش‌ها")
  }

  return response.json()
}

export function useReviewOrders(params: OrdersQueryParams) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => fetchOrders(params),
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData,
  })
}
