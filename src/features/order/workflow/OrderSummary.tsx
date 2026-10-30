"use client";
import {useFormatter, useTranslations} from "next-intl";
import {useOrderFormConfig} from "@/hooks/useOrderForm";

export function OrderSummary({order, compact = false}: {order: {type?: string | null; budget_range?: string | null; page_count?: number | null; description?: string | null}; compact?: boolean}) {
  const t = useTranslations("CustomerPanel");
  const common = useTranslations("Common");
  const format = useFormatter();
  const {data: config} = useOrderFormConfig();
  const optionLabel = (keys: string[], value: string | null | undefined) => config?.form.steps.flatMap(step => step.fields).find(field => keys.includes(field.id))?.options?.find(option => option.value === value)?.label ?? common("unknown");
  return <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-3">
    <div className="min-w-0"><dt className="text-text-secondary">{t("service")}</dt><dd className="mt-1 break-words font-medium text-text-primary"><bdi>{optionLabel(["service_type", "type"], order.type)}</bdi></dd></div>
    <div className="min-w-0"><dt className="text-text-secondary">{t("budget")}</dt><dd className="mt-1 break-words font-medium text-text-primary"><bdi>{optionLabel(["budget_range"], order.budget_range)}</bdi></dd></div>
    {order.page_count != null && <div><dt className="text-text-secondary">{t("pages")}</dt><dd className="mt-1 font-medium text-text-primary">{format.number(order.page_count)}</dd></div>}
    {!compact && <div className="min-w-0 sm:col-span-3"><dt className="text-text-secondary">{t("description")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-text-primary"><bdi>{order.description?.trim() ? order.description : t("noDescription")}</bdi></dd></div>}
  </dl>;
}
