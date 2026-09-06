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

export const reviewOrdersColumns: ColumnDef<OrderItem>[] = [
  {
    accessorKey: "order_id",
    header: () => <div className="text-center font-bold">شناسه</div>,
    size: 80,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="font-mono text-xs font-bold text-primary">
          #{row.original.order_id}
        </span>
      </div>
    ),
  },
  {
    id: "customer",
    header: () => <div className="text-right font-bold">مشتری</div>,
    accessorFn: (row) => row.meta?.full_name ?? "-",
    size: 180,
    cell: ({ row }) => {
      const { full_name, company } = row.original.meta || {};
      return (
        <div className="flex flex-col items-start gap-1 text-right">
          <span className="font-medium text-text-primary">
            {full_name || "بدون نام"}
          </span>
          {company && (
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <Building className="size-3 shrink-0" />
              <span>{company}</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: "contact",
    header: () => <div className="text-right font-bold">اطلاعات تماس</div>,
    size: 220,
    cell: ({ row }) => {
      const { phone, email } = row.original.meta || {};
      return (
        <div className="flex flex-col items-start gap-1 text-right text-xs text-text-secondary">
          {phone && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <Phone className="size-3.5 shrink-0 text-text-muted" />
              <span>{phone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate max-w-[180px]">{email}</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: () => <div className="text-center font-bold">نوع خدمت</div>,
    size: 130,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="inline-flex items-center rounded-md border border-border-soft bg-surface-1 px-2.5 py-1 text-xs font-medium text-text-primary">
          {row.original.type}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "budget_range",
    header: () => <div className="text-center font-bold">بازه بودجه</div>,
    size: 120,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <span className="font-mono text-xs text-text-secondary" dir="ltr">
          {row.original.budget_range || "-"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "page_count",
    header: () => <div className="text-center font-bold">تعداد صفحات</div>,
    size: 110,
    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-1 text-xs text-text-secondary">
        <FileText className="size-3 text-text-muted" />
        <span className="font-mono">{row.original.page_count ?? "-"}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center font-bold">وضعیت</div>,
    size: 140,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <OrderStatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: () => <div className="text-right font-bold">توضیحات</div>,
    size: 220,
    cell: ({ row }) => (
      <div className="text-right">
        <p className="max-w-[200px] truncate text-xs text-text-secondary" title={row.original.description}>
          {row.original.description || "-"}
        </p>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-center font-bold">عملیات</div>,
    size: 70,
    enableResizing: false,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-primary"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border-soft bg-bg-primary">
            <DropdownMenuItem
              className="gap-2 text-xs text-text-primary focus:bg-surface-1 focus:text-primary cursor-pointer"
              onClick={() => console.log("View order", row.original.order_id)}
            >
              <Eye className="size-3.5" />
              مشاهده جزئیات
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];
