"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { fetchplus, type TeamMember } from "@/lib/api/team";
import { TeamCard } from "./TeamCard";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

function TeamSkeleton({label}: {label: string}) {
  return (
    <SkeletonRegion label={label}><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[26rem] space-y-5 rounded-2xl border border-border bg-card p-6">
          <Skeleton shape="block" className="h-48" /><Skeleton className="h-5 w-2/3" /><Skeleton className="w-1/2" /><Skeleton /><Skeleton className="w-4/5" />
        </div>
      ))}
    </div></SkeletonRegion>
  );
}

export default function TeamSection({initialTeam}: {initialTeam?: TeamMember[]}) {
  const t = useTranslations("About.Team");

  const {
    data: team = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["team-members"],
    queryFn: fetchplus,
    staleTime: 1000 * 60 * 5,
    initialData: initialTeam,
  });

  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-10">
      <h2 className="text-3xl font-black text-foreground">{t("title")}</h2>
      <p className="mt-3 text-base text-muted-foreground">{t("description")}</p>

      <div className="mt-12">
        {isLoading ? (
          <TeamSkeleton label={t("loading")} />
        ) : isError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 py-16">
            <p className="text-sm text-destructive">{t("error")}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <RefreshCw className="size-4" />
              {t("retry")}
            </button>
          </div>
        ) : team.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {team.map((member, index) => (
              <TeamCard key={member.websiteUrl ?? member.pr_id ?? member.user_id ?? index} member={member} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
