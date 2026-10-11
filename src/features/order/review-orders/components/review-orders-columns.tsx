"use client";
import {useTranslations, useFormatter} from "next-intl";
import {useOrderFormConfig} from "@/hooks/useOrderForm";
import {Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { OrderItem } from "../types";
import { OrderStatusBadge } from "./order-status-badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Phone, Mail, Building, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function useReviewOrdersColumns(): ColumnDef<OrderItem>[] {
  const t = useTranslations("ReviewOrders");
  const common = useTranslations("Common");
  const format = useFormatter();
  const {data: config} = useOrderFormConfig();
  const optionLabel = (key: string, value: string | null) => config?.form.steps.flatMap(step => step.fields).find(field => field.id === key || (key === "type" && field.id === "service_type"))?.options?.find(option => option.value === value)?.label ?? common("unknown");
  return [
  {
    accessorKey: "order_id",
    meta: {label: t("columns.id")},
    header: () => <div className="text-center font-bold">{t("columns.id")}</div>,
    size: 80,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="font-mono text-xs font-bold text-primary">
          <bdi>#{row.original.order_id}</bdi>
        </span>
      </div>
    ),
  },
  {
    id: "customer",
    meta: {label: t("columns.customer")},
    header: () => <div className="text-start font-bold">{t("columns.customer")}</div>,
    accessorFn: (row) => row.meta?.full_name ?? "-",
    size: 180,
    cell: ({ row }) => {
      const { full_name, company } = row.original.meta || {};
      return (
        <div className="flex flex-col items-start gap-1 text-start">
          <span className="font-medium text-text-primary">
            <bdi>{full_name || t("noName")}</bdi>
          </span>
          {company && (
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <Building className="size-3 shrink-0" />
              <bdi>{company}</bdi>
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: "contact",
    meta: {label: t("columns.contact")},
    header: () => <div className="text-start font-bold">{t("columns.contact")}</div>,
    size: 220,
    cell: ({ row }) => {
      const { phone, email } = row.original.meta || {};
      return (
        <div className="flex flex-col items-start gap-1 text-start text-xs text-text-secondary">
          {phone && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <Phone className="size-3.5 shrink-0 text-text-muted" />
              <bdi dir="ltr">{phone}</bdi>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
              <Mail className="size-3.5 shrink-0" />
              <bdi dir="ltr" className="truncate max-w-[180px]">{email}</bdi>
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    meta: {label: t("columns.serviceType")},
    header: () => <div className="text-center font-bold">{t("columns.serviceType")}</div>,
    size: 130,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="inline-flex items-center rounded-md border border-border-soft bg-surface-1 px-2.5 py-1 text-xs font-medium text-text-primary">
          {optionLabel("type", row.original.type)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "budget_range",
    meta: {label: t("columns.budget")},
    header: () => <div className="text-center font-bold">{t("columns.budget")}</div>,
    size: 120,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="text-xs text-text-secondary">
          {optionLabel("budget_range", row.original.budget_range)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "page_count",
    meta: {label: t("columns.pageCount")},
    header: () => <div className="text-center font-bold">{t("columns.pageCount")}</div>,
    size: 110,
    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-1 text-xs text-text-secondary">
        <FileText className="size-3 text-text-muted" />
        <span className="font-mono">{row.original.page_count == null ? "—" : format.number(row.original.page_count)}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    meta: {label: t("columns.status")},
    header: () => <div className="text-center font-bold">{t("columns.status")}</div>,
    size: 140,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <OrderStatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "description",
    meta: {label: t("columns.description")},
    header: () => <div className="text-start font-bold">{t("columns.description")}</div>,
    size: 220,
    cell: ({ row }) => (
      <div className="text-start">
        <p className="max-w-[200px] truncate text-xs text-text-secondary" title={row.original.description ?? undefined}>
          {row.original.description || "-"}
        </p>
      </div>
    ),
  },
  {
    id: "actions",
    meta: {label: t("columns.actions")},
    header: () => <div className="text-center font-bold">{t("columns.actions")}</div>,
    size: 70,
    enableResizing: false,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("columns.actions")}
              className="size-8 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-primary"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border-soft bg-bg-primary">
            <DialogTrigger asChild><DropdownMenuItem
              className="gap-2 text-xs text-text-primary focus:bg-surface-1 focus:text-primary cursor-pointer"
              onSelect={event => event.preventDefault()}
            >
              <Eye className="size-3.5" />
              {t("viewDetails")}
            </DropdownMenuItem></DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent><DialogTitle>{t("viewDetails")}</DialogTitle><DialogDescription>{optionLabel("type", row.original.type)}</DialogDescription><p className="whitespace-pre-wrap"><bdi>{row.original.description || "—"}</bdi></p><OrderStatusBadge status={row.original.status} /></DialogContent>
        </Dialog>
      </div>
    ),
  },
];
}
