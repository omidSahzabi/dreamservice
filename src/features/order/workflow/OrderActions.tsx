"use client";
import {useRef, useState, useId} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useTranslations} from "next-intl";
import {z} from "zod";
import {MoreHorizontal} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {ApiError, fetchJson, localizeApiError} from "@/lib/api/errors";
import {allowedOrderActions, transitionSchema} from "@/schemas/orderWorkflow";
import type {OrderItem} from "@/features/order/review-orders/types";
import {OrderStatusBadge} from "@/features/order/review-orders/components/order-status-badge";
import {OrderHistory} from "./OrderHistory";

export function OrderActions({order}: {order: OrderItem}) {
  const t = useTranslations("OrderWorkflow");
  const errors = useTranslations("Errors");
  const [action, setAction] = useState<string | null>(null);
  const [expectedStatus, setExpectedStatus] = useState(order.status);
  const [details, setDetails] = useState(false);
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);
  const lock = useRef(false);
  const messageId = useId();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const input = transitionSchema.safeParse({expectedStatus, newStatus: action, message});
      if (!input.success) throw new ApiError("INVALID_INPUT");
      const result = z.object({success: z.literal(true), historyId: z.string().uuid()}).safeParse(await fetchJson(`/api/order/${order.order_id}/status`, "UNKNOWN", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(input.data)}));
      if (!result.success) throw new ApiError("UNKNOWN");
    },
    onSuccess: () => {toast.success(t("success"));},
    onSettled: async () => {
      await Promise.all([client.invalidateQueries({queryKey: ["orders"]}), client.invalidateQueries({queryKey: ["order-history"]})]);
      lock.current = false;
    },
  });
  function choose(value: string) {mutation.reset(); setMessage(""); setInvalid(false); setExpectedStatus(order.status); setAction(value);}
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("actions")}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDetails(true)}>{t("details")}</DropdownMenuItem>
        {allowedOrderActions(order.status).map(value => <DropdownMenuItem key={value} onSelect={() => choose(value)}>{t(`action.${value}`)}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent><DialogTitle>{t("order", {id: order.order_id})}</DialogTitle><DialogDescription>{t("details")}</DialogDescription><p className="whitespace-pre-wrap break-words"><bdi>{order.description}</bdi></p><OrderHistory orderId={order.order_id} /></DialogContent></Dialog>
    <Dialog open={action !== null} onOpenChange={open => {if (!open && !lock.current) setAction(null);}}><DialogContent>
      <DialogTitle>{action ? t(`action.${action}`) : t("actions")}</DialogTitle>
      <DialogDescription>{t("confirmDescription", {id: order.order_id})}</DialogDescription>
      <div className="flex flex-wrap gap-2"><OrderStatusBadge status={expectedStatus} /><span aria-hidden>→</span><OrderStatusBadge status={action} /></div>
      {mutation.isSuccess ? <p role="status">{t("success")}</p> : <form onSubmit={event => {
        event.preventDefault();
        if (lock.current) return;
        if (!transitionSchema.safeParse({expectedStatus, newStatus: action, message}).success) {setInvalid(true); return;}
        lock.current = true; mutation.mutate();
      }} className="space-y-3">
        <Label htmlFor={messageId}>{t("message")}</Label>
        <textarea id={messageId} required maxLength={2000} disabled={mutation.isPending} value={message} onChange={event => {setMessage(event.target.value);setInvalid(false);}} aria-invalid={invalid} aria-describedby={invalid ? `${messageId}-error` : undefined} className="min-h-28 w-full rounded border border-border-soft bg-surface-1 p-3" />
        {invalid && <p id={`${messageId}-error`} role="alert">{t("messageRequired")}</p>}
        {mutation.isError && <p role="alert">{localizeApiError(mutation.error, errors)}</p>}
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t("saving") : t("confirm")}</Button>
      </form>}
      <Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>{mutation.isSuccess ? t("close") : t("cancel")}</Button>
    </DialogContent></Dialog>
  </>;
}
