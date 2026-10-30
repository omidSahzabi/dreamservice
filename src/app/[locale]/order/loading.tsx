import { getTranslations } from "next-intl/server";
import { ContentSkeleton } from "@/components/ui/content-skeleton";

export default async function Loading() {
  const t = await getTranslations("OrderWorkflow");
  return <main className="mx-auto min-h-[60vh] max-w-5xl p-4 sm:p-8"><ContentSkeleton layout="cards" label={t("loading")} /></main>;
}
