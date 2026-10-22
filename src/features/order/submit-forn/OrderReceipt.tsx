"use client";
import {useLocale, useTranslations} from "next-intl";
import {Check} from "lucide-react";
import {Link} from "@/lib/i18n/navigation";
import {Button} from "@/components/ui/button";

export function OrderReceipt({orderId}: {orderId: number}) {
  const t = useTranslations("OrderForm");
  const locale = useLocale();
  return <main dir={locale === "fa" ? "rtl" : "ltr"} className="flex min-h-[60vh] items-center justify-center bg-bg-primary p-4">
    <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border-soft bg-bg-primary p-8 text-center shadow-xl">
      <Check aria-hidden="true" className="size-12 text-primary" />
      <div role="status" className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">{t("successTitle")}</h1>
        <p className="text-sm text-text-secondary">{t("successDescription")}</p>
        <p className="font-semibold">{t("orderReference", {id: orderId})}</p>
      </div>
      <Button asChild><Link href={`/order?orderId=${orderId}`}>{t("trackOrder")}</Link></Button>
    </div>
  </main>;
}
