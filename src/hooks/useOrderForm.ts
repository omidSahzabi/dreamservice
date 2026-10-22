import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useLocale} from "next-intl";
import type {OrderFormConfig, OrderFormData} from "@/types/order";
import {orderFormConfigSchema} from "@/schemas/orderFormConfig";
import {ApiError, fetchJson} from "@/lib/api/errors";
import {z} from "zod";
import {useOrderStore} from "@/store/orderStore";
import {canonicalJson} from "@/lib/order/canonical";

export function useOrderFormConfig(requestedLocale?: string) {
  const activeLocale = useLocale();
  const locale = requestedLocale ?? activeLocale;
  return useQuery<OrderFormConfig>({
    queryKey: ["order-form-config", locale],
    queryFn: async ({signal}) => {
      const result = orderFormConfigSchema.safeParse(await fetchJson(
        "/api/order/order-form-config?locale=" + encodeURIComponent(locale), "FORM_LOAD_FAILED", {signal}
      ));
      if (!result.success) throw new ApiError("FORM_LOAD_FAILED");
      return result.data;
    },
    staleTime: 1000 * 60 * 30
  });
}

export function useSubmitOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {formKey: string; data: OrderFormData}) => {
      const fingerprint = canonicalJson({formKey: payload.formKey, data: Object.fromEntries(Object.entries(payload.data).filter(([,value]) => value !== undefined))});
      const store = useOrderStore.getState();
      if (!store.submission || store.submission.fingerprint !== fingerprint) store.setSubmission({fingerprint, key: crypto.randomUUID()});
      const submission = useOrderStore.getState().submission;
      if (!submission) throw new ApiError("ORDER_SUBMIT_FAILED");
      const result = z.object({success: z.literal(true), order_id: z.number().int().positive()}).safeParse(
        await fetchJson("/api/order/submit-order", "ORDER_SUBMIT_FAILED", {
          method: "POST", headers: {"Content-Type": "application/json", "Idempotency-Key": submission.key}, body: JSON.stringify(payload)
        })
      );
      if (!result.success) throw new ApiError("ORDER_SUBMIT_FAILED");
      return result.data;
    },
    onSuccess: () => {void client.invalidateQueries({queryKey: ["orders"]});},
  });
}
