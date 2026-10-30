"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table/data-table";
import { DataTableFilterForm } from "@/components/modules/data-table/data-table-filter-form";
import type { DataTableFilterField, DataTableFilterValues } from "@/components/modules/data-table/data-table-filter-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ApiError, fetchJson, localizeApiError } from "@/lib/api/errors";
import { userDetailsResponseSchema, userListResponseSchema, type ManagedUser, type ManagementAction } from "@/schemas/userManagement";
import { useAuth } from "@/hooks/useAuth";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { DataTableLoading } from "@/components/modules/data-table/data-table-loading";

export function UsersView({ actorId }: { actorId: string }) {
  const t = useTranslations("AdminUsers");
  const errors = useTranslations("Errors");
  const roles = useTranslations("Navbar.roles");
  const statuses = useTranslations("OrderStatus");
  const locale = useLocale();
  const auth = useAuth();
  const authorized = !auth.isError && auth.user?.id === actorId && auth.user.permission === "ADMIN";
  const client = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [filters, setFilters] = useState<DataTableFilterValues>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<ManagementAction | null>(null);
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["admin-users", locale, actorId, pagination, filters],
    enabled: authorized,
    staleTime: 0, retry: false, refetchOnWindowFocus: true,
    queryFn: async ({signal}) => {
      const params = new URLSearchParams({ ...filters, page: String(pagination.pageIndex + 1), limit: String(pagination.pageSize) });
      const result = userListResponseSchema.safeParse(await fetchJson("/api/admin/users?" + params, "UNKNOWN", { cache: "no-store", signal }));
      if (!result.success) throw new ApiError("UNKNOWN");
      return result.data;
    },
  });
  const details = useQuery({
    queryKey: ["admin-user", locale, actorId, selected], enabled: authorized && Boolean(selected),
    staleTime: 0, retry: false, refetchOnWindowFocus: true,
    queryFn: async ({signal}) => {
      const result = userDetailsResponseSchema.safeParse(await fetchJson("/api/admin/users/" + selected, "UNKNOWN", { cache: "no-store", signal }));
      if (!result.success) throw new ApiError("UNKNOWN");
      return result.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!authorized || !details.data || !action) throw new ApiError("INVALID_INPUT");
      await fetchJson("/api/admin/users/" + selected, "UNKNOWN", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, expectedAdmin: details.data.user.isAdmin, expectedBanned: Boolean(details.data.user.bannedAt) }) });
    },
    onSuccess: async () => {
      toast.success(t("success")); setAction(null); setReason("");
      await Promise.all([client.invalidateQueries({ queryKey: ["admin-users"] }), client.invalidateQueries({ queryKey: ["admin-user"] })]);
    },
    onError: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ["admin-users"] }), client.invalidateQueries({ queryKey: ["admin-user"] })]);
    },
  });
  const displayName = (user: ManagedUser) => [user.fname, user.lname].filter(Boolean).join(" ") || t("unavailable");
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : t("unavailable");
  const columns: ColumnDef<ManagedUser>[] = [
    { accessorKey: "id", header: t("id"), cell: ({row}) => <bdi>{row.original.id}</bdi> },
    { id: "name", header: t("name"), cell: ({row}) => <bdi>{displayName(row.original)}</bdi> },
    { accessorKey: "contact", header: t("phone"), cell: ({row}) => <bdi>{row.original.contact || t("unavailable")}</bdi> },
    { accessorKey: "email", header: t("email"), cell: ({row}) => <bdi>{row.original.email || t("unavailable")}</bdi> },
    { id: "role", header: t("role"), cell: ({row}) => t(row.original.isAdmin ? "admin" : "customer") },
    { id: "status", header: t("status"), cell: ({row}) => t(row.original.bannedAt ? "banned" : "active") },
    { accessorKey: "cr", header: t("registered"), cell: ({row}) => date(row.original.cr) },
    { id: "actions", header: t("actions"), enableHiding: false, cell: ({row}) => <Button variant="outline" size="sm" onClick={() => { setSelected(row.original.id); setAction(null); setReason(""); mutation.reset(); }}>{t("details")}</Button> },
  ];
  const fields: DataTableFilterField[] = [
    { id: "search", type: "text", label: t("search"), placeholder: t("searchPlaceholder") },
    { id: "role", type: "select", label: t("role"), options: [{ value: "admin", label: t("admin") }, { value: "customer", label: t("customer") }] },
    { id: "status", type: "select", label: t("status"), options: [{ value: "active", label: t("active") }, { value: "banned", label: t("banned") }] },
  ];
  const updateFilters = (values: DataTableFilterValues) => { setFilters(values); setPagination(previous => ({ ...previous, pageIndex: 0 })); };
  const user = details.data?.user;
  if (auth.isLoading) return <DataTableLoading columns={8} />;
  if (!authorized) return <AccessRequired embedded forbidden={Boolean(auth.user)} />;
  return <section className="space-y-5">
    <h1 className="text-xl font-bold">{t("title")}</h1>
    <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    <Button variant="outline" pending={query.isFetching} completed={!query.isError && Boolean(query.data)} pendingLabel={t("loading")} onClick={() => void query.refetch()}>{t("refresh")}</Button>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <DataTable columns={columns} data={query.data?.data ?? []} getRowId={row => row.id} isLoading={query.isLoading}
        errorMessage={query.isError ? localizeApiError(query.error, errors) : undefined} onRetry={() => void query.refetch()}
        emptyMessage={t("empty")} manualPagination manualFiltering manualSorting
        pagination={pagination} onPaginationChange={setPagination} rowCount={query.data?.total ?? 0}
        pageCount={Math.ceil((query.data?.total ?? 0) / pagination.pageSize)}
        filterForm={<DataTableFilterForm fields={fields} values={filters} onChange={updateFilters} />} filterValues={filters} onFilterChange={updateFilters} />
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !mutation.isPending) { setSelected(null); setAction(null); } }}>
      <DialogContent>
        <DialogTitle>{t("details")}</DialogTitle><DialogDescription>{t("detailsDescription")}</DialogDescription>
        {details.isLoading && <ContentSkeleton label={t("loading")} />}
        {details.isError && <div role="alert"><p>{localizeApiError(details.error, errors)}</p><Button onClick={() => void details.refetch()}>{t("refresh")}</Button></div>}
        {user && !details.isError && <>
          <dl className="ds-content-reveal grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt>{t("id")}</dt><dd className="break-all"><bdi>{user.id}</bdi></dd>
            <dt>{t("name")}</dt><dd><bdi>{displayName(user)}</bdi></dd>
            <dt>{t("phone")}</dt><dd><bdi>{user.contact || t("unavailable")}</bdi></dd>
            <dt>{t("email")}</dt><dd className="break-all"><bdi>{user.email || t("unavailable")}</bdi></dd>
            <dt>{t("role")}</dt><dd>{t(user.isAdmin ? "admin" : "customer")}</dd>
            <dt>{t("status")}</dt><dd>{t(user.bannedAt ? "banned" : "active")}</dd>
            <dt>{t("registered")}</dt><dd>{date(user.cr)}</dd>
          </dl>
          <h2 className="font-semibold">{t("profiles")}</h2>
          {user.profiles.length ? <ul className="space-y-2 text-sm">{user.profiles.map(profile => <li key={profile.pr_id}><bdi>{profile.pr_company || t("unavailable")}</bdi>{" · "}{profile.role && roles.has(profile.role) ? roles(profile.role) : roles("other")}</li>)}</ul> : <p>{t("noProfiles")}</p>}
          <h2 className="font-semibold">{t("orders", { count: details.data?.orderCount ?? 0 })}</h2>
          <p className="text-sm text-muted-foreground">{t("recentOrders")}</p>
          {details.data?.orders.length ? <ul className="space-y-2 text-sm">{details.data.orders.map(order => <li key={order.order_id}><bdi>{order.order_id}</bdi>{" · "}{order.status && statuses.has(order.status) ? statuses(order.status) : t("unavailable")}</li>)}</ul> : <p>{t("noOrders")}</p>}
          <div className="flex flex-wrap gap-2">{([user.isAdmin ? "demote" : "promote", user.bannedAt ? "unban" : "ban"] as const).map(value => <Button key={value} variant="outline" disabled={mutation.isPending || (user.id === actorId && (value === "ban" || value === "demote")) || (value === "promote" && Boolean(user.bannedAt))} onClick={() => { setAction(value); setReason(""); mutation.reset(); }}>{t(value)}</Button>)}</div>
          {action && <form className="space-y-3 rounded-lg border border-border p-3" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
            <p>{t("confirmation", { action: t(action), name: displayName(user) })}</p>
            <label htmlFor="management-reason" className="text-sm">{t("reason")}</label>
            <Textarea id="management-reason" required maxLength={1000} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} />
            {mutation.isError && <p role="alert" className="text-sm text-destructive">{localizeApiError(mutation.error, errors)}</p>}
            <div className="flex gap-2"><Button type="submit" pending={mutation.isPending} pendingLabel={t("saving")} disabled={!reason.trim() || details.isFetching}>{t("confirm")}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>{t("cancel")}</Button></div>
          </form>}
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
