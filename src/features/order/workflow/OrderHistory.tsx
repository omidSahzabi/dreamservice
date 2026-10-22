"use client";
import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslations, useFormatter} from "next-intl";
import {z} from "zod";
import {useAuth} from "@/hooks/useAuth";
import {ApiError, fetchJson, localizeApiError} from "@/lib/api/errors";
import {historyResponseSchema} from "@/schemas/orderWorkflow";
import {Button} from "@/components/ui/button";
import {OrderStatusBadge} from "@/features/order/review-orders/components/order-status-badge";
import {OrderSummary} from "./OrderSummary";

export function OrderHistory({orderId, showDetails = false}: {orderId: number; showDetails?: boolean}) {
  const {user} = useAuth();
  const t = useTranslations("OrderWorkflow");
  const panel = useTranslations("CustomerPanel");
  const errors = useTranslations("Errors");
  const format = useFormatter();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["order-history", user?.id, user?.permission, orderId], enabled: Boolean(user),
    queryFn: async ({signal}) => {
      const result = historyResponseSchema.safeParse(await fetchJson(`/api/order/${orderId}/history`, "ORDER_LOAD_FAILED", {signal, credentials: "include"}));
      if (!result.success) throw new ApiError("ORDER_LOAD_FAILED");
      return result.data;
    }, retry: false, refetchInterval: 10000,
  });
  const retry = useMutation({
    mutationFn: async (id: string) => {
      const result = z.object({success: z.literal(true)}).safeParse(await fetchJson(`/api/order/notifications/${id}/retry`, "UNKNOWN", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"}));
      if (!result.success) throw new ApiError("UNKNOWN");
    },
    onSettled: () => client.invalidateQueries({queryKey: ["order-history"]}),
  });
  const latest = query.data?.history[0];
  return <section className="min-w-0 space-y-5 rounded-2xl border border-border-soft bg-card p-4 shadow-soft text-text-primary sm:p-6" aria-labelledby={`order-history-${orderId}`} aria-busy={query.isFetching}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={`order-history-${orderId}`} className="font-semibold">{showDetails ? panel("details") : t("history")}</h3>
      {query.data && !query.isError && <OrderStatusBadge status={query.data.order.status} />}
    </div>
    {query.isPending && <p role="status">{t("loading")}</p>}
    {query.isError && <div role="alert" className="space-y-3"><p>{localizeApiError(query.error, errors)}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>}
    {retry.isError && <p role="alert">{localizeApiError(retry.error, errors)}</p>}
    {!query.isError && query.data && <>
    {showDetails && <OrderSummary order={query.data.order} />}
    <div className="space-y-2 rounded-lg bg-secondary/70 p-4">
      <h4 className="font-semibold">{t("latestMessage")}</h4>
      {latest ? <><p className="whitespace-pre-wrap break-words"><bdi>{latest.message}</bdi></p><p className="text-sm text-text-secondary">{panel("lastDecision")} <time dateTime={latest.createdAt}>{format.dateTime(new Date(latest.createdAt), {dateStyle: "medium", timeStyle: "short"})}</time></p></> : <p className="text-sm text-text-secondary">{panel("awaitingDecision")}</p>}
    </div>
    {query.data.history.length === 0 ? <p className="text-sm text-text-secondary">{t("noHistory")}</p> : <details className="group rounded-lg border border-border-soft p-4">
    <summary className="cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-primary">{t("history")}</summary>
    <ol className="mt-4 space-y-4">
      {query.data.history.map(entry => <li key={entry.id} className="space-y-2 border-s-2 border-border-soft ps-4">
        <div className="flex flex-wrap items-center gap-2"><OrderStatusBadge status={entry.previousStatus} /><span aria-hidden className="inline-block rtl:rotate-180">→</span><OrderStatusBadge status={entry.newStatus} /></div>
        <p className="whitespace-pre-wrap break-words"><bdi>{entry.message}</bdi></p>
        <time dateTime={entry.createdAt}>{format.dateTime(new Date(entry.createdAt), {dateStyle: "medium", timeStyle: "short"})}</time>
        {entry.notificationState && <p className="text-sm">{t("delivery", {state: t(`notification.${entry.notificationState}`)})}</p>}
        {(entry.notificationState === "FAILED" || entry.notificationState === "PENDING") && (entry.notificationAttempts ?? 3) < 3 && <Button disabled={retry.isPending || Date.parse(entry.notificationNextAttemptAt ?? "") > query.dataUpdatedAt} onClick={() => retry.mutate(entry.id)}>{t("retryNotification")}</Button>}
      </li>)}
    </ol></details>}
    </>}
  </section>;
}
