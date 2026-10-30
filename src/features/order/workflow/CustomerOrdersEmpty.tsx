"use client";

import {useTranslations} from "next-intl";
import {Plus} from "lucide-react";
import {StateIllustration} from "@/components/illustrations/StateIllustration";
import {Button} from "@/components/ui/button";
import {Link} from "@/lib/i18n/navigation";

export function CustomerOrdersEmpty() {
  const t = useTranslations("CustomerPanel");
  const workflow = useTranslations("OrderWorkflow");
  return <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center shadow-soft sm:px-8 sm:py-10" aria-labelledby="empty-orders-title">
    <StateIllustration kind="empty-orders" className="mx-auto max-w-[15rem] sm:max-w-[18rem]" />
    <h3 id="empty-orders-title" className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{workflow("noOrders")}</h3>
    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">{t("emptyDescription")}</p>
    <Button asChild className="mt-6"><Link href="/order/order-form"><Plus aria-hidden="true" />{t("newOrder")}</Link></Button>
  </div>;
}
