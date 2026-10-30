import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { getHomepageProject } from "@/lib/projects/homepage";
import { securityEvent } from "@/lib/security/http";
import { ProjectCountdown } from "./launch-countdown/ProjectCountdown";

export default async function LaunchCountdown() {
  await connection();
  const locale = await getLocale();
  const t = await getTranslations("LaunchCountdown");
  const now = new Date();
  let project;
  try { project = await getHomepageProject(locale, now); }
  catch (error) {
    unstable_rethrow(error);
    securityEvent("operation_failed");
    return <section id="upcoming-project" className="mx-auto max-w-4xl px-4 pb-20 pt-8 text-center"><article className="rounded-2xl border border-border bg-card p-8 shadow-soft"><h2 className="text-2xl font-bold">{t("unavailableTitle")}</h2><p className="mt-3 text-muted-foreground">{t("unavailableDescription")}</p></article></section>;
  }
  if (!project) return <section id="upcoming-project" className="mx-auto max-w-4xl px-4 pb-20 pt-8 text-center"><article className="rounded-2xl border border-border bg-card p-8 shadow-soft"><h2 className="text-2xl font-bold">{t("emptyTitle")}</h2><p className="mt-3 text-muted-foreground">{t("emptyDescription")}</p></article></section>;
  return <ProjectCountdown key={project.deadlineAt + project.title} project={project} serverNow={now.getTime()} />;
}
