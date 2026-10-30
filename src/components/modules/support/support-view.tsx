"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { ApiError, fetchJson, localizeApiError } from "@/lib/api/errors";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { DataTable } from "@/components/modules/data-table/data-table";
import { DataTableLoading } from "@/components/modules/data-table/data-table-loading";
import { DataTableFilterForm } from "@/components/modules/data-table/data-table-filter-form";
import type { DataTableFilterValues } from "@/components/modules/data-table/data-table-filter-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { notificationsResponseSchema, ownedOrdersResponseSchema, ticketChangeSchema, ticketCreateSchema, ticketDetailSchema,
  ticketListResponseSchema, ticketPriorities, ticketReplySchema, ticketStatuses, type TicketRow } from "@/schemas/support";

const subscribe = () => () => {};
const selectClass = "w-full rounded-lg border border-input bg-background p-2 text-foreground";
function parsed<T>(schema: z.ZodType<T>, value: unknown) { const result = schema.safeParse(value);if (!result.success) throw new ApiError("UNKNOWN");return result.data; }
function useTicketError() { const t = useTranslations("Errors");return (error: unknown) => localizeApiError(error, t); }
function TicketBadges({ ticket }: { ticket: Pick<TicketRow, "status" | "priority"> }) {
  const t = useTranslations("Support");
  return <span className="inline-flex flex-wrap gap-2"><Badge variant={ticket.status === "CLOSED" ? "outline" : "secondary"}>{t("statuses." + ticket.status)}</Badge><Badge variant={ticket.priority === "HIGH" ? "destructive" : "outline"}>{t("priorities." + ticket.priority)}</Badge></span>;
}
export function SupportClient({ actorId, admin = false, ticketId, create = false, orderId }: { actorId: string; admin?: boolean; ticketId?: string; create?: boolean; orderId?: number }) {
  const auth = useAuth();const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (!hydrated || auth.isLoading) return <DataTableLoading columns={5} />;
  if (auth.isError || auth.user?.id !== actorId || (admin && auth.user.permission !== "ADMIN")) return <AccessRequired embedded forbidden={Boolean(auth.user)} />;
  if (create) return <NewTicket actorId={actorId} orderId={orderId} />;
  if (ticketId) return <TicketConversation actorId={actorId} admin={admin} ticketId={ticketId} />;
  return <TicketList actorId={actorId} admin={admin} />;
}
function TicketList({ actorId, admin }: { actorId: string; admin: boolean }) {
  const t = useTranslations("Support");const locale = useLocale();const format = useFormatter();const errorText = useTicketError();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [filters, setFilters] = useState<DataTableFilterValues>({});const [noticePage, setNoticePage] = useState(1);
  const base = admin ? "/admin/tickets" : "/support";
  const api = admin ? "/api/admin/tickets" : "/api/support/tickets";
  const query = useQuery({ queryKey: ["support-tickets", actorId, locale, admin, pagination, filters], retry: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      params.set("page", String(pagination.pageIndex + 1));params.set("limit", String(pagination.pageSize));
      return parsed(ticketListResponseSchema, await fetchJson(api + "?" + params, "UNKNOWN", { signal, cache: "no-store" }));
    } });
  const notices = useQuery({ queryKey: ["support-notifications", actorId, locale, admin, noticePage], retry: false,
    queryFn: async ({ signal }) => parsed(notificationsResponseSchema, await fetchJson((admin ? "/api/admin/tickets/notifications" : "/api/support/notifications") + "?limit=5&page=" + noticePage, "UNKNOWN", { signal, cache: "no-store" })) });
  const updateFilters = (values: DataTableFilterValues) => { setFilters(values);setPagination(previous => ({ ...previous, pageIndex: 0 })); };
  const columns: ColumnDef<TicketRow>[] = [
    { id: "subject", header: t("subject"), cell: ({ row }) => <Link className="block max-w-sm whitespace-normal break-words font-medium text-primary hover:underline" href={base + "/" + row.original.id}><bdi>{t("number", { number: row.original.number })} · {row.original.subject}</bdi></Link> },
    ...(admin ? [{ id: "customer", header: t("customer"), cell: ({ row }: { row: { original: TicketRow } }) => <bdi>{[row.original.customer.fname, row.original.customer.lname].filter(Boolean).join(" ") || t("customer")}</bdi> }] : []),
    { id: "status", header: t("status"), cell: ({ row }) => <TicketBadges ticket={row.original} /> },
    { id: "activity", header: t("activity"), cell: ({ row }) => <time dateTime={row.original.lastMessageAt}>{format.dateTime(new Date(row.original.lastMessageAt), { dateStyle: "medium", timeStyle: "short" })}</time> },
    { id: "order", header: t("order"), cell: ({ row }) => row.original.order ? <bdi>{row.original.order.order_id}</bdi> : t("independent") },
  ];
  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{t(admin ? "adminTitle" : "title")}</h1><p className="mt-2 text-muted-foreground">{t("subtitle")}</p></div>{!admin && <Button asChild><Link href="/support/new">{t("create")}</Link></Button>}</header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{ticketStatuses.map(status => <button type="button" key={status} onClick={() => updateFilters({ ...filters, status })} className="rounded-xl border border-border bg-card p-4 text-start hover:border-primary"><span className="block text-sm text-muted-foreground">{t("statuses." + status)}</span><strong className="text-2xl tabular-nums">{format.number(query.data?.summary[status] ?? 0)}</strong></button>)}</div>
    <Button variant="outline" pending={query.isFetching || notices.isFetching} pendingLabel={t("loading")} onClick={() => { void query.refetch();void notices.refetch(); }}>{t("refresh")}</Button>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4"><DataTable columns={columns} data={query.data?.data ?? []} getRowId={row => row.id}
      isLoading={query.isPending} errorMessage={query.isError ? errorText(query.error) : undefined} onRetry={() => void query.refetch()} emptyMessage={t("empty")}
      manualFiltering manualSorting manualPagination pageSizeOptions={[10, 20, 30, 50]} pagination={pagination} onPaginationChange={setPagination} rowCount={query.data?.total ?? 0} pageCount={Math.ceil((query.data?.total ?? 0) / pagination.pageSize)}
      filterValues={filters} onFilterChange={updateFilters} filterForm={<DataTableFilterForm values={filters} onChange={updateFilters} fields={[
        { id: "search", type: "text", label: t("search"), placeholder: t(admin ? "adminSearch" : "searchHint") },
        { id: "status", type: "select", label: t("status"), options: ticketStatuses.map(value => ({ value, label: t("statuses." + value) })) },
        ...(admin ? [{ id: "priority", type: "select" as const, label: t("priority"), options: ticketPriorities.map(value => ({ value, label: t("priorities." + value) })) }] : []),
      ]} />} /></div>
    <aside className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label={t("notifications")}><h2 className="font-semibold">{t("notifications")}</h2><p className="text-sm text-muted-foreground">{t("notificationHint")}</p>
      {notices.isError && <p role="alert">{errorText(notices.error)}</p>}{notices.isPending && <ContentSkeleton layout="cards" label={t("loading")} />}
      {notices.data?.data.length === 0 && <p className="text-muted-foreground">{t("noNotifications")}</p>}
      <ul className="space-y-2">{notices.data?.data.map(notice => <li key={notice.id}><Link className="block break-words text-primary hover:underline" href={base + "/" + notice.ticket.id}><bdi>{t("number", { number: notice.ticket.number })} · {notice.ticket.subject}</bdi></Link><time className="text-xs text-muted-foreground" dateTime={notice.createdAt}>{format.dateTime(new Date(notice.createdAt), { dateStyle: "medium", timeStyle: "short" })}</time></li>)}</ul>
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={noticePage === 1} onClick={() => setNoticePage(page => page - 1)}>{t("newer")}</Button><Button size="sm" variant="outline" disabled={noticePage * 5 >= (notices.data?.total ?? 0)} onClick={() => setNoticePage(page => page + 1)}>{t("older")}</Button></div>
    </aside>
  </section>;
}
function NewTicket({ actorId, orderId: initialOrderId }: { actorId: string; orderId?: number }) {
  const t = useTranslations("Support");const locale = useLocale();const router = useRouter();const client = useQueryClient();const errorText = useTicketError();
  const [subject, setSubject] = useState("");const [body, setBody] = useState("");const [orderId, setOrderId] = useState<number | null>(initialOrderId ?? null);const [page, setPage] = useState(1);
  const key = useRef<{ payload: string; key: string } | null>(null);
  const orders = useQuery({ queryKey: ["support-orders", actorId, locale, page, orderId], retry: false,
    queryFn: async ({ signal }) => parsed(ownedOrdersResponseSchema, await fetchJson("/api/support/orders?limit=10&page=" + page + (orderId ? "&selected=" + orderId : ""), "UNKNOWN", { signal, cache: "no-store" })) });
  const mutation = useMutation({ mutationFn: async () => {
    const payload = JSON.stringify({ subject, body, orderId });
    if (key.current?.payload !== payload) key.current = { payload, key: crypto.randomUUID() };
    const input = ticketCreateSchema.safeParse({ subject, body, orderId, requestKey: key.current.key });
    if (!input.success) throw new ApiError("INVALID_INPUT");
    return parsed(z.object({ id: z.string().uuid() }), await fetchJson("/api/support/tickets", "UNKNOWN", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) }));
  }, onSuccess: async result => { await client.invalidateQueries({ queryKey: ["support-tickets"] });toast.success(t("created"));router.push("/support/" + result.id); } });
  const choices = orders.data ? [...(orders.data.selected && !orders.data.data.some(row => row.order_id === orders.data.selected?.order_id) ? [orders.data.selected] : []), ...orders.data.data] : [];
  return <section className="mx-auto max-w-3xl space-y-5"><h1 className="text-2xl font-bold">{t("create")}</h1><Button asChild variant="outline"><Link href="/support">{t("back")}</Link></Button>
    <form className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8" onSubmit={event => { event.preventDefault();mutation.mutate(); }}>
      <div><label htmlFor="ticket-subject">{t("subject")}</label><Input id="ticket-subject" dir="auto" required maxLength={200} value={subject} disabled={mutation.isPending} onChange={event => setSubject(event.target.value)} /></div>
      <div><label htmlFor="ticket-body">{t("initialMessage")}</label><Textarea id="ticket-body" dir="auto" required maxLength={8000} rows={7} value={body} disabled={mutation.isPending} onChange={event => setBody(event.target.value)} /></div>
      <div><label htmlFor="ticket-order">{t("orderOptional")}</label><select id="ticket-order" className={selectClass} value={orderId ?? ""} disabled={mutation.isPending} onChange={event => setOrderId(event.target.value ? Number(event.target.value) : null)}><option value="">{t("independent")}</option>{orderId && !choices.some(row => row.order_id === orderId) && <option value={orderId}>{t("orderNumber", { number: orderId })}</option>}{choices.map(order => <option key={order.order_id} value={order.order_id}>{t("orderNumber", { number: order.order_id })}{order.type ? " · " + order.type : ""}</option>)}</select><p className="mt-2 text-sm text-muted-foreground">{t("orderHint")}</p></div>
      {orders.isError && <p role="alert">{errorText(orders.error)}</p>}
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={page === 1 || orders.isFetching} onClick={() => setPage(value => value - 1)}>{t("previousOrders")}</Button><Button type="button" variant="outline" disabled={page * 10 >= (orders.data?.total ?? 0) || orders.isFetching} onClick={() => setPage(value => value + 1)}>{t("nextOrders")}</Button></div>
      {mutation.isError && <p role="alert" className="text-destructive">{errorText(mutation.error)}</p>}
      <Button type="submit" pending={mutation.isPending} pendingLabel={t("saving")}>{t("submit")}</Button>
    </form></section>;
}
function TicketConversation({ actorId, admin, ticketId }: { actorId: string; admin: boolean; ticketId: string }) {
  const t = useTranslations("Support");const locale = useLocale();const format = useFormatter();const client = useQueryClient();const errorText = useTicketError();
  const [page, setPage] = useState(1);const [body, setBody] = useState("");const scrollTo = useRef<string | null>(null);
  const key = useRef<{ payload: string; key: string } | null>(null);
  const base = admin ? "/api/admin/tickets/" : "/api/support/tickets/";
  const query = useQuery({ queryKey: ["support-ticket", actorId, locale, admin, ticketId, page], retry: false,
    queryFn: async ({ signal }) => parsed(ticketDetailSchema, await fetchJson(base + ticketId + "?limit=20&page=" + page, "UNKNOWN", { signal, cache: "no-store" })) });
  useEffect(() => { if (scrollTo.current && query.data?.messages.some(message => message.id === scrollTo.current)) { document.getElementById("message-" + scrollTo.current)?.scrollIntoView({ block: "nearest", behavior: "auto" });scrollTo.current = null; } }, [query.data]);
  const mutation = useMutation({ mutationFn: async (change: z.infer<typeof ticketChangeSchema> | null) => {
    if (change) return fetchJson(base + ticketId, "UNKNOWN", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    if (key.current?.payload !== body) key.current = { payload: body, key: crypto.randomUUID() };
    const input = ticketReplySchema.safeParse({ body, requestKey: key.current.key });if (!input.success) throw new ApiError("INVALID_INPUT");
    return parsed(z.object({ id: z.string().uuid() }), await fetchJson(base + ticketId + "/messages", "UNKNOWN", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) }));
  }, onSuccess: async (result, change) => {
    if (!change) { if (result && typeof result === "object" && "id" in result && typeof result.id === "string") scrollTo.current = result.id;setBody("");key.current = null;setPage(1); }
    toast.success(t("saved"));await Promise.all([client.invalidateQueries({ queryKey: ["support-ticket"] }), client.invalidateQueries({ queryKey: ["support-tickets"] }), client.invalidateQueries({ queryKey: ["support-notifications"] })]);
  }, onError: () => { void client.invalidateQueries({ queryKey: ["support-ticket"] }); } });
  if (query.isPending) return <ContentSkeleton layout="cards" label={t("loading")} />;
  if (query.isError || !query.data) return <div role="alert" className="space-y-4 rounded-xl border border-border p-6"><p>{errorText(query.error)}</p><Button onClick={() => void query.refetch()}>{t("retry")}</Button><Button asChild variant="outline"><Link href={admin ? "/admin/tickets" : "/support"}>{t("back")}</Link></Button></div>;
  const { ticket, messages, total } = query.data;
  return <section className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={admin ? "/admin/tickets" : "/support"}>{t("back")}</Link></Button><Button variant="outline" pending={query.isFetching} pendingLabel={t("loading")} onClick={() => { setPage(1);void query.refetch(); }}>{t("refresh")}</Button></div>
    <header className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7"><p className="text-sm text-muted-foreground">{t("number", { number: ticket.number })}</p><h1 className="break-words text-2xl font-bold" dir="auto">{ticket.subject}</h1><TicketBadges ticket={ticket} />
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{t("createdAt")}</dt><dd><time dateTime={ticket.createdAt}>{format.dateTime(new Date(ticket.createdAt), { dateStyle: "medium", timeStyle: "short" })}</time></dd></div><div><dt className="text-muted-foreground">{t("activity")}</dt><dd><time dateTime={ticket.lastMessageAt}>{format.dateTime(new Date(ticket.lastMessageAt), { dateStyle: "medium", timeStyle: "short" })}</time></dd></div></dl>
      {ticket.order && <div className="flex flex-wrap items-center gap-3"><p>{t("orderNumber", { number: ticket.order.order_id })}{ticket.order.type && <> · <bdi>{ticket.order.type}</bdi></>}</p><Button asChild size="sm" variant="outline"><Link href={`/order?orderId=${ticket.order.order_id}`}>{t("viewOrder")}</Link></Button></div>}
      {admin && <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="ticket-status">{t("status")}</label><select id="ticket-status" className={selectClass} value={ticket.status} disabled={mutation.isPending || ticket.status === "CLOSED"} onChange={event => { const status = ticketStatuses.find(value => value === event.target.value);if (status) mutation.mutate({ action: "status", status, expectedUpdatedAt: ticket.updatedAt }); }}>{ticketStatuses.map(status => <option key={status} value={status}>{t("statuses." + status)}</option>)}</select></div><div><label htmlFor="ticket-priority">{t("priority")}</label><select id="ticket-priority" className={selectClass} value={ticket.priority} disabled={mutation.isPending} onChange={event => { const priority = ticketPriorities.find(value => value === event.target.value);if (priority) mutation.mutate({ action: "priority", priority, expectedUpdatedAt: ticket.updatedAt }); }}>{ticketPriorities.map(priority => <option key={priority} value={priority}>{t("priorities." + priority)}</option>)}</select></div></div>}
    </header>
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t("messagePagination")}><Button variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>{t("newer")}</Button><p className="text-sm text-muted-foreground">{t("messagePage", { page, total: Math.max(1, Math.ceil(total / 20)) })}</p><Button variant="outline" disabled={page * 20 >= total || query.isFetching} onClick={() => setPage(value => value + 1)}>{t("older")}</Button></nav>
    <ol className="space-y-4" aria-label={t("conversation")}>{messages.map(message => <li key={message.id} id={"message-" + message.id}><article className={"w-fit max-w-[95%] space-y-2 rounded-2xl border border-border p-4 sm:max-w-[85%] sm:p-5 " + (message.isAdmin ? "me-auto bg-secondary" : "ms-auto bg-primary/10")}><p className="text-sm font-semibold">{t(message.isAdmin ? "admin" : "customer")}</p><p dir="auto" className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.body}</p><time className="block text-xs text-muted-foreground" dateTime={message.createdAt}>{format.dateTime(new Date(message.createdAt), { dateStyle: "medium", timeStyle: "short" })}</time></article></li>)}</ol>
    {mutation.isError && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{errorText(mutation.error)}</p>}
    {ticket.status === "CLOSED" ? <div className="space-y-3 rounded-2xl border border-border bg-card p-5"><p>{t("closedHint")}</p><Button pending={mutation.isPending} pendingLabel={t("saving")} onClick={() => mutation.mutate({ action: "reopen", expectedUpdatedAt: ticket.updatedAt })}>{t("reopen")}</Button></div> :
      <form className="space-y-3 rounded-2xl border border-border bg-card p-5" onSubmit={event => { event.preventDefault();mutation.mutate(null); }}><label htmlFor="ticket-reply">{t("reply")}</label><Textarea id="ticket-reply" dir="auto" required rows={5} maxLength={8000} disabled={mutation.isPending} value={body} onChange={event => setBody(event.target.value)} /><Button type="submit" pending={mutation.isPending} pendingLabel={t("saving")}>{t("send")}</Button></form>}
  </section>;
}
