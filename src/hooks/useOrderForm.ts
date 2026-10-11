import {useMutation, useQuery} from "@tanstack/react-query";
import {useLocale} from "next-intl";
import type {OrderFormConfig, OrderFormData} from "@/types/order";
import {orderFormConfigSchema} from "@/schemas/orderFormConfig";
import {ApiError, fetchJson} from "@/lib/api/errors";
import {z} from "zod";

export function useOrderFormConfig(requestedLocale?: string) {
  const activeLocale = useLocale();
  const locale = requestedLocale ?? activeLocale;
  return useQuery<OrderFormConfig>({
    queryKey: ["order-form-config", locale],
    queryFn: async () => {
      const result = orderFormConfigSchema.safeParse(await fetchJson(
        "/api/order/order-form-config?locale=" + encodeURIComponent(locale), "FORM_LOAD_FAILED"
      ));
      if (!result.success) throw new ApiError("FORM_LOAD_FAILED");
      return result.data;
    },
    staleTime: 1000 * 60 * 30
  });
}

export function useSubmitOrder() {
  return useMutation({
    mutationFn: async (payload: {formKey: string; data: OrderFormData}) => {
      const result = z.object({success: z.literal(true), order_id: z.number()}).safeParse(
        await fetchJson("/api/order/submit-order", "ORDER_SUBMIT_FAILED", {
          method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
        })
      );
      if (!result.success) throw new ApiError("ORDER_SUBMIT_FAILED");
      return result.data;
    }
  });
}
