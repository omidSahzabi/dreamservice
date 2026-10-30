import { getTranslations } from "next-intl/server";
import { DataTableLoading } from "@/components/modules/data-table/data-table-loading";

export default async function TableRouteLoading() {
  const t = await getTranslations("Common");
  return <main className="mx-auto min-h-[60vh] w-full max-w-[1400px] p-4 sm:p-8">
    <DataTableLoading label={t("loading")} />
  </main>;
}
