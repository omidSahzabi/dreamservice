import { useMutation, useQuery } from "@tanstack/react-query";
import type { OrderFormConfig, OrderFormData } from "@/types/order";

export function useOrderFormConfig(locale: string = "fa") {
  return useQuery<OrderFormConfig>({
    queryKey: ["order-form-config", locale],
    queryFn: async () => {
      const response = await fetch(`/api/order/order-form-config?locale=${locale}`);
      if (!response.ok) {
        throw new Error("خطا در بارگذاری پیکربندی فرم سفارش");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useSubmitOrder() {
  return useMutation({
    mutationFn: async (payload: { formKey: string; data: OrderFormData }) => {
      const response = await fetch("/api/order/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || "خطا در پردازش و ثبت سفارش");
      }

      return response.json();
    },
  });
}
