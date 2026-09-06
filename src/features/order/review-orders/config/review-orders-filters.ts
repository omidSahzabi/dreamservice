import type { DataTableFilterField } from "@/components/modules/data-table"

export const reviewOrdersFilters: DataTableFilterField[] = [
  {
    id: "status",
    type: "select",
    label: "وضعیت",
    placeholder: "انتخاب وضعیت",
    options: [
      { value: "PENDING", label: "در انتظار" },
      { value: "PROCESSING", label: "در حال پردازش" },
      { value: "COMPLETED", label: "تکمیل شده" },
      { value: "CANCELLED", label: "لغو شده" },
      { value: "REJECTED", label: "رد شده" },
    ],
  },
  {
    id: "type",
    type: "text",
    label: "نوع سفارش",
    placeholder: "نوع سفارش",
  },
  {
    id: "budget_range",
    type: "text",
    label: "بازه بودجه",
    placeholder: "بازه بودجه",
  },
  {
    id: "client_id",
    type: "text",
    label: "شناسه مشتری",
    placeholder: "شناسه مشتری",
  },
]
