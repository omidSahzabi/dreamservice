"use client";
import {useState} from "react";
import {useLocale, useTranslations, useFormatter} from "next-intl";
import {useReviewOrders} from "@/features/order/review-orders/hooks/use-review-orders";
import {localizeApiError} from "@/lib/api/errors";
import {Button} from "@/components/ui/button";
import {OrderHistory} from "./OrderHistory";
import {OrderSummary} from "./OrderSummary";
import {OrderStatusBadge} from "@/features/order/review-orders/components/order-status-badge";
import {Link} from "@/lib/i18n/navigation";
import {CustomerOrdersEmpty} from "./CustomerOrdersEmpty";

export function CustomerOrders({orderId, invalidOrderId = false}: {orderId?: number; invalidOrderId?: boolean}) {
  const t = useTranslations("CustomerPanel");
  const workflow = useTranslations("OrderWorkflow");
  const locale = useLocale();
  if (invalidOrderId || orderId !== undefined) return <section dir={locale === "fa" ? "rtl" : "ltr"} className="space-y-5 text-text-primary" aria-labelledby="tracking-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="tracking-title" className="text-xl font-bold">{orderId ? workflow("order", {id: orderId}) : t("tracking")}</h2>
      <Button asChild variant="outline"><Link href="/order">{t("backToOrders")}</Link></Button>
    </div>
    {invalidOrderId ? <p role="alert" className="rounded-xl border border-border-soft bg-bg-primary p-5">{t("invalidOrder")}</p> : orderId && <OrderHistory key={orderId} orderId={orderId} showDetails />}
  </section>;
  return <CustomerOrderList />;
}

function CustomerOrderList() {
  const t = useTranslations("OrderWorkflow");
  const panel = useTranslations("CustomerPanel");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const query = useReviewOrders({page, limit: 10}, "CUSTOMER");
  return <section dir={locale === "fa" ? "rtl" : "ltr"} className="space-y-5 text-text-primary" aria-labelledby="customer-orders-title" aria-busy={query.isFetching}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="customer-orders-title" className="text-xl font-bold">{t("myOrders")}</h2>
      <Button variant="outline" disabled={query.isFetching} onClick={() => {if (page === 1) void query.refetch(); else setPage(1);}}>{panel("refresh")}</Button>
    </div>
    {query.isPending && <p role="status" className="rounded-xl border border-border-soft bg-bg-primary p-6">{t("loading")}</p>}
    {query.isError && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-bg-primary p-5"><p>{localizeApiError(query.error, errors)}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>}
    {!query.isPending && !query.isError && query.data?.data.length === 0 && <CustomerOrdersEmpty />}
    {!query.isError && <div className="grid min-w-0 gap-4">
      {query.data?.data.map(order => <article key={order.order_id} className="min-w-0 space-y-4 rounded-2xl border border-border-soft bg-card p-4 shadow-soft sm:p-6" aria-labelledby={`order-${order.order_id}-title`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 id={`order-${order.order_id}-title`} className="font-semibold"><Link className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={`/order?orderId=${order.order_id}`}>{t("order", {id: order.order_id})}</Link></h3><OrderStatusBadge status={order.status} /></div>
        <OrderSummary order={order} compact />
        <div className="space-y-2 rounded-lg bg-secondary/70 p-4 text-sm">
          <h4 className="font-semibold">{t("latestMessage")}</h4>
          {order.latestDecision ? <><p className="line-clamp-3 whitespace-pre-wrap break-words"><bdi>{order.latestDecision.message}</bdi></p><p className="text-text-secondary">{panel("lastDecision")} <time dateTime={order.latestDecision.createdAt}>{format.dateTime(new Date(order.latestDecision.createdAt), {dateStyle: "medium", timeStyle: "short"})}</time></p></> : <p className="text-text-secondary">{panel("awaitingDecision")}</p>}
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto"><Link href={`/order?orderId=${order.order_id}`} aria-label={panel("viewOrder", {id: order.order_id})}>{panel("viewDetails")}</Link></Button>
      </article>)}
    </div>}
    {!query.isError && query.data && query.data.pagination.total > 0 && <nav aria-label={panel("pagination")} className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" disabled={!query.data.pagination.hasPrevPage || query.isFetching} onClick={() => setPage(value => value - 1)}>{t("previous")}</Button>
      <p className="text-sm text-text-secondary" aria-live="polite">{panel("page", {page, total: query.data.pagination.totalPages})}</p>
      <Button variant="outline" disabled={!query.data.pagination.hasNextPage || query.isFetching} onClick={() => setPage(value => value + 1)}>{t("next")}</Button>
    </nav>}
  </section>;
}
