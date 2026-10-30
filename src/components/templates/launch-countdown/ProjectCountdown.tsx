"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DreamForm, type FieldConfig } from "@/components/modules/dream-form/dream-form";
import type { PublicHomepageProject } from "@/lib/projects/homepage";
import { useCountdown } from "./useCountdown";

export function ProjectCountdown({ project, serverNow }: { project: PublicHomepageProject; serverNow: number }) {
  const t = useTranslations("LaunchCountdown");
  const format = useFormatter();
  const time = useCountdown(project.deadlineAt, serverNow);
  const fields: FieldConfig[] = [
    { name: "email", label: t("email"), type: "email", placeholder: t("emailPlaceholder"),
      validation: [{ type: "required", message: t("emailRequired") }, { type: "email", message: t("emailInvalid") }] },
    { name: "message", label: t("message"), type: "textarea", placeholder: t("messagePlaceholder"), rows: 3 },
  ];
  return <section id="upcoming-project" className="mx-auto max-w-4xl px-4 pb-20 pt-8">
    <article className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft md:p-8">
      <div className="space-y-3 text-center">
        <h2 className="break-words text-3xl font-bold text-foreground md:text-4xl"><bdi>{project.title}</bdi></h2>
        {project.description && <p dir="auto" className="whitespace-pre-wrap break-words text-muted-foreground">{project.description}</p>}
      </div>
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-primary">{t("upcoming")}</p>
          <p className="text-sm text-muted-foreground"><time dateTime={project.deadlineAt}>{format.dateTime(new Date(project.deadlineAt), { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })}</time>{" "}{t("utc")}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label={t("countdownLabel")}>
          {(["days", "hours", "minutes", "seconds"] as const).map(unit => <div key={unit} className="rounded-xl border border-border bg-background p-4 text-center md:p-6">
            <div className="text-4xl font-bold tabular-nums text-foreground">{format.number(time[unit], { minimumIntegerDigits: 2, useGrouping: false })}</div>
            <div className="mt-2 text-sm text-muted-foreground">{t(unit, { count: time[unit] })}</div>
          </div>)}
        </div>
      </div>
      {time.expired ? <p role="status" className="text-center text-muted-foreground">{t("deadlineReached")}</p> :
        <div className="space-y-4 border-t border-border pt-6">
          <h3 className="text-xl font-semibold">{t("signup")}</h3>
          <p className="text-sm text-muted-foreground">{t("subscriptionLimitation")}</p>
          <DreamForm fields={fields} onSubmit={() => { toast.error(t("unavailable")); }} showResetButton={false} submitText={t("submit")} />
        </div>}
    </article>
  </section>;
}
