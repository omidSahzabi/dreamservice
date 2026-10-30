"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/modules/data-table/data-table";
import { DataTableFilterForm } from "@/components/modules/data-table/data-table-filter-form";
import type { DataTableFilterField, DataTableFilterValues } from "@/components/modules/data-table/data-table-filter-types";
import { DataTableLoading } from "@/components/modules/data-table/data-table-loading";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, fetchJson, localizeApiError } from "@/lib/api/errors";
import { canTransitionProject, projectInputSchema, projectListResponseSchema, projectStatuses, type ManagedProject, type ProjectInput } from "@/schemas/project";

const emptyProject: ProjectInput = { title: "", titleFa: "", description: null, descriptionFa: null, orderId: null,
  status: "PLANNED", startAt: null, deadlineAt: null, isPublic: false, showOnHomepage: false };
const subscribeToHydration = () => () => {};
function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function isoInput(value: string) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function ProjectsView({ actorId }: { actorId: string }) {
  const t = useTranslations("AdminProjects");
  const errors = useTranslations("Errors");
  const orderStatuses = useTranslations("OrderStatus");
  const locale = useLocale();
  const auth = useAuth();
  // Auth may resolve in the shared client cache before this streamed page hydrates.
  // Keep its first client render identical to the server's loading shell.
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const authorized = !auth.isError && auth.user?.id === actorId && auth.user.permission === "ADMIN";
  const client = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [filters, setFilters] = useState<DataTableFilterValues>({});
  const [editing, setEditing] = useState<ManagedProject | "new" | null>(null);
  const [draft, setDraft] = useState<ProjectInput>(emptyProject);
  const [confirming, setConfirming] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const query = useQuery({
    queryKey: ["admin-projects", locale, actorId, pagination, filters], enabled: hydrated && authorized,
    staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ ...filters, page: String(pagination.pageIndex + 1), limit: String(pagination.pageSize) });
      const result = projectListResponseSchema.safeParse(await fetchJson("/api/admin/projects?" + params, "UNKNOWN", { cache: "no-store", signal }));
      if (!result.success) throw new ApiError("UNKNOWN");
      return result.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!authorized || !editing) throw new ApiError("FORBIDDEN");
      const parsed = projectInputSchema.safeParse(draft);
      if (!parsed.success) throw new ApiError("INVALID_INPUT");
      await fetchJson("/api/admin/projects" + (editing === "new" ? "" : "/" + editing.id), "UNKNOWN", {
        method: editing === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing === "new" ? parsed.data : { data: parsed.data, expectedUpdatedAt: editing.updatedAt }),
      });
    },
    onSuccess: async () => { toast.success(t("success")); setEditing(null); setConfirming(false); await client.invalidateQueries({ queryKey: ["admin-projects"] }); },
    onError: async () => { setConfirming(false); await client.invalidateQueries({ queryKey: ["admin-projects"] }); },
  });
  const open = (project: ManagedProject | "new") => {
    setEditing(project); setConfirming(false); setInvalid(false); mutation.reset();
    if (project === "new") setDraft(emptyProject);
    else setDraft({ title: project.title, titleFa: project.titleFa, description: project.description, descriptionFa: project.descriptionFa,
      orderId: project.orderId, status: project.status, startAt: project.startAt, deadlineAt: project.deadlineAt,
      isPublic: project.isPublic, showOnHomepage: project.showOnHomepage });
  };
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("none");
  const columns: ColumnDef<ManagedProject>[] = [
    { id: "title", header: t("project"), cell: ({ row }) => <bdi className="whitespace-normal break-words">{locale === "fa" ? row.original.titleFa : row.original.title}</bdi> },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => t("statuses." + row.original.status) },
    { id: "deadline", header: t("deadlineAt"), cell: ({ row }) => date(row.original.deadlineAt) },
    { id: "order", header: t("orderId"), cell: ({ row }) => row.original.order ? <span><bdi>{row.original.order.order_id}</bdi>{" · "}{row.original.order.status && orderStatuses.has(row.original.order.status) ? orderStatuses(row.original.order.status) : t("none")}</span> : t("standalone") },
    { id: "visibility", header: t("visibility"), cell: ({ row }) => t(row.original.isPublic ? "public" : "private") },
    { id: "actions", header: t("actions"), enableHiding: false, cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => open(row.original)}>{t("edit")}</Button> },
  ];
  const fields: DataTableFilterField[] = [
    { id: "search", type: "text", label: t("search"), placeholder: t("searchPlaceholder") },
    { id: "status", type: "select", label: t("status"), options: projectStatuses.map(status => ({ value: status, label: t("statuses." + status) })) },
  ];
  const updateFilters = (values: DataTableFilterValues) => { setFilters(values); setPagination(previous => ({ ...previous, pageIndex: 0 })); };
  if (!hydrated || auth.isLoading) return <DataTableLoading columns={6} />;
  if (!authorized) return <AccessRequired embedded forbidden={Boolean(auth.user)} />;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold">{t("title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p></div><Button onClick={() => open("new")}>{t("create")}</Button></div>
    <Button variant="outline" pending={query.isFetching} pendingLabel={t("loading")} onClick={() => void query.refetch()}>{t("refresh")}</Button>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <DataTable columns={columns} data={query.data?.data ?? []} getRowId={row => row.id} isLoading={query.isLoading}
        errorMessage={query.isError ? localizeApiError(query.error, errors) : undefined} onRetry={() => void query.refetch()}
        emptyMessage={t("empty")} manualPagination manualFiltering manualSorting pagination={pagination} onPaginationChange={setPagination}
        rowCount={query.data?.total ?? 0} pageCount={Math.ceil((query.data?.total ?? 0) / pagination.pageSize)}
        filterForm={<DataTableFilterForm fields={fields} values={filters} onChange={updateFilters} />} filterValues={filters} onFilterChange={updateFilters} />
    </div>
    <Dialog open={Boolean(editing)} onOpenChange={value => { if (!value && !mutation.isPending) setEditing(null); }}>
      <DialogContent><DialogTitle>{t(editing === "new" ? "create" : "edit")}</DialogTitle><DialogDescription>{t("editDescription")}</DialogDescription>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); const valid = projectInputSchema.safeParse(draft).success; setInvalid(!valid); if (valid) setConfirming(true); }}>
          <fieldset disabled={mutation.isPending || confirming} className="space-y-4">
            {(["title", "titleFa"] as const).map(key => <div key={key}><label htmlFor={"project-" + key} className="text-sm">{t(key === "title" ? "titleEn" : key)}</label><Input id={"project-" + key} dir={key === "titleFa" ? "rtl" : "ltr"} required maxLength={200} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></div>)}
            {(["description", "descriptionFa"] as const).map(key => <div key={key}><label htmlFor={"project-" + key} className="text-sm">{t(key)}</label><Textarea id={"project-" + key} dir={key === "descriptionFa" ? "rtl" : "ltr"} maxLength={5000} value={draft[key] ?? ""} onChange={event => setDraft({ ...draft, [key]: event.target.value || null })} /></div>)}
            <div><label htmlFor="project-order" className="text-sm">{t("orderId")}</label><Input id="project-order" type="number" min={1} max={2147483647} value={draft.orderId ?? ""} onChange={event => setDraft({ ...draft, orderId: event.target.value ? Number(event.target.value) : null })} /><p className="mt-1 text-xs text-muted-foreground">{t("orderHint")}</p></div>
            {editing && editing !== "new" && editing.order && <p className="text-sm">{t("linkedOrder", { id: editing.order.order_id })}{" · "}{editing.order.status && orderStatuses.has(editing.order.status) ? orderStatuses(editing.order.status) : t("none")}</p>}
            <div><label htmlFor="project-status" className="text-sm">{t("status")}</label><select id="project-status" className="w-full rounded-md border border-input bg-background p-2" value={draft.status} onChange={event => {
              const status = projectStatuses.find(value => value === event.target.value);
              if (status) setDraft({ ...draft, status, showOnHomepage: ["PLANNED", "ACTIVE"].includes(status) && draft.showOnHomepage });
            }}>{projectStatuses.filter(status => editing === "new" ? status === "PLANNED" : editing && canTransitionProject(editing.status, status)).map(status => <option key={status} value={status}>{t("statuses." + status)}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">{t("statusHint")}</p></div>
            {(["startAt", "deadlineAt"] as const).map(key => <div key={key}><label htmlFor={"project-" + key} className="text-sm">{t(key)}</label><Input id={"project-" + key} type="datetime-local" dir="ltr" min="2000-01-01T00:00" max="2200-12-31T23:59" value={localInput(draft[key])} onChange={event => setDraft({ ...draft, [key]: isoInput(event.target.value), ...(key === "deadlineAt" && !event.target.value ? { showOnHomepage: false } : {}) })} /></div>)}
            <p className="text-xs text-muted-foreground">{t("dateHint")}</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isPublic} onChange={event => setDraft({ ...draft, isPublic: event.target.checked, showOnHomepage: event.target.checked && draft.showOnHomepage })} />{t("isPublic")}</label>
            <p className="text-xs text-muted-foreground">{t("homepageHint")}</p>
          </fieldset>
          {invalid && <p role="alert" className="text-sm text-destructive">{t("validation")}</p>}
          {mutation.isError && <p role="alert" className="text-sm text-destructive">{localizeApiError(mutation.error, errors)}</p>}
          {confirming ? <div className="space-y-3 rounded-xl border border-border p-4"><p>{t("confirmSave")}</p><div className="flex gap-2"><Button type="button" pending={mutation.isPending} pendingLabel={t("saving")} onClick={() => mutation.mutate()}>{t("confirm")}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setConfirming(false)}>{t("back")}</Button></div></div> : <Button type="submit">{t("review")}</Button>}
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
