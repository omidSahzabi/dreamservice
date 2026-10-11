import type { DataTableFilterField } from "@/components/modules/data-table"

export function getReviewOrdersFilters(t: (key: string) => string, status: (key: string) => string): DataTableFilterField[] {
return [
  {
    id: "status",
    type: "select",
    label: t("filters.status"),
    placeholder: t("filters.selectStatus"),
    options: [
      { value: "PENDING", label: status("PENDING") },
      { value: "PROCESSING", label: status("PROCESSING") },
      { value: "COMPLETED", label: status("COMPLETED") },
      { value: "CANCELLED", label: status("CANCELLED") },
      { value: "REJECTED", label: status("REJECTED") },
    ],
  },
  {
    id: "type",
    type: "text",
    label: t("filters.type"),
    placeholder: t("filters.type"),
  },
  {
    id: "budget_range",
    type: "text",
    label: t("filters.budgetRange"),
    placeholder: t("filters.budgetRange"),
  },
  {
    id: "client_id",
    type: "text",
    label: t("filters.clientId"),
    placeholder: t("filters.clientId"),
  },
];
}
