"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { TeamMember } from "@/lib/api/team";

type TeamCardProps = {
  member: TeamMember;
  index: number;
};

const accents = [
  {
    glow: "from-primary/10 via-transparent to-transparent",
    badge: "bg-card/95 text-primary ring-border",
  },
  {
    glow: "from-primary/10 via-transparent to-transparent",
    badge: "bg-card/95 text-primary ring-border",
  },
  {
    glow: "from-primary/10 via-transparent to-transparent",
    badge: "bg-card/95 text-primary ring-border",
  },
];

export function TeamCard({ member, index }: TeamCardProps) {
  const t = useTranslations("About.Team");
  const roles = useTranslations("Navbar");
  const accent = accents[index % accents.length];

  const fullName =
    [member.user?.fname, member.user?.lname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    member.name ||
    t("fallbackName");

  const role =
    ((member.role || member.user?.role) ? (roles.has("roles." + (member.role || member.user?.role)) ? roles("roles." + (member.role || member.user?.role)) : t("fallbackRole")) : null) ||
    member.pr_company ||
    t("fallbackRole");

  const imageUrl = member.image?.url || member.imageUrl || null;

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "TS";



  // مسیر داخلی پروفایل — Next.js Link با locale خودش هندل می‌شود
  const profileHref: string | null = null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.08, 0.3) }}
      whileHover={{ y: -8 }}
      className="motion-reduce:opacity-100! motion-reduce:transform-none! group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-soft"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glow} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />

      <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative aspect-[1.15/1] overflow-hidden bg-secondary">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={member.image?.altText || fullName}
              className="h-full w-full object-cover grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <span className="text-6xl font-black tracking-tight text-primary">
                {initials}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/5" />

          <div
            className={`absolute start-5 top-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 backdrop-blur-md ${accent.badge}`}
          >
            <Sparkles className="size-3.5" />
            <span>{t("memberBadge")}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="mb-5">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              <bdi>{fullName}</bdi>
            </h3>

            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <BriefcaseBusiness className="size-4 text-primary" />
              <span><bdi>{role}</bdi></span>
            </div>
          </div>

          <div className="mt-auto">
            {profileHref ? (
              <a
                href={profileHref}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-text-secondary transition hover:border-primary/40 hover:bg-accent hover:text-foreground"
              >
                <span>{t("viewProfile")}</span>
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ) : (
              <div className="flex w-full items-center justify-between rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-muted-foreground">
                <span>{t("noProfile")}</span>
                <ExternalLink className="size-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
