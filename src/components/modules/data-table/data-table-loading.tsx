import { useTranslations } from "next-intl";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Table, TableBody } from "@/components/ui/table";
import { DataTableSkeleton } from "./data-table-skeleton";

/** Table shell for route/auth initialization before the DataTable can mount. */
export function DataTableLoading({ label, columns = 6 }: { label?: string; columns?: number }) {
  const t = useTranslations("DataTable");
  return <SkeletonRegion label={label ?? t("loading")}>
    <div className="space-y-6"><Skeleton className="h-7 w-56" /><Skeleton className="w-80 max-w-full" />
      <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
        <Table><TableBody><DataTableSkeleton rows={10} columns={columns} /></TableBody></Table>
      </div>
    </div>
  </SkeletonRegion>;
}
