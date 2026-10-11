"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export type TeamMember = {
  pr_id?: number;
  user_id?: string;
  role?: string | null;
  pr_company?: string | null;
  subdomain?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  user?: {
    id?: string;
    fname?: string | null;
    lname?: string | null;
    role?: string | null;
    subdomain?: string | null;
  } | null;
  image?: {
    url?: string | null;
    altText?: string | null;
  } | null;
};

type TeamCardProps = {
  member: TeamMember;
  index: number;
  locale: "fa" | "en";
};

const accents = [
  {
    glow: "from-violet-500/30 via-fuchsia-500/10 to-transparent",
    badge: "bg-violet-500/15 text-violet-200 ring-violet-400/20",
  },
  {
    glow: "from-cyan-500/30 via-blue-500/10 to-transparent",
    badge: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/20",
  },
  {
    glow: "from-emerald-500/30 via-teal-500/10 to-transparent",
    badge: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20",
  },
];

export function TeamCard({ member, index, locale }: TeamCardProps) {
  const accent = accents[index % accents.length];

  const fullName =
    [member.user?.fname, member.user?.lname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    member.name ||
    member.user_id ||
    (locale === "fa" ? "عضو تیم" : "plus member");

  const role =
    member.role ||
    member.user?.role ||
    member.pr_company ||
    (locale === "fa" ? "متخصص خلاق" : "Creative specialist");

  const imageUrl = member.image?.url || member.imageUrl || null;

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "TS";

  const subdomain = member.subdomain || member.user?.subdomain;

  const profileHref = subdomain ? `/${locale}/${subdomain}` : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.08, 0.3) }}
      whileHover={{ y: -8 }}
      className="group relative h-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glow} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#0c1534]/90">
        <div className="relative aspect-[1.15/1] overflow-hidden bg-gradient-to-br from-white/10 to-white/[0.02]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={member.image?.altText || fullName}
              className="h-full w-full object-cover grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/30 via-blue-500/20 to-cyan-500/20">
              <span className="text-6xl font-black tracking-tight text-white/90">
                {initials}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1534] via-transparent to-black/5" />

          <div
            className={`absolute left-5 top-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 backdrop-blur-md ${accent.badge}`}
          >
            <Sparkles className="size-3.5" />
            <span>{locale === "fa" ? "عضو تیم" : "plus member"}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="mb-5">
            <h3 className="text-xl font-bold tracking-tight text-white">
              {fullName}
            </h3>

            <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <BriefcaseBusiness className="size-4 text-violet-300" />
              <span>{role}</span>
            </div>
          </div>

          <div className="mt-auto">
            {profileHref ? (
              <a
                href={profileHref}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-violet-300/30 hover:bg-violet-400/10 hover:text-white"
              >
                <span>{locale === "fa" ? "مشاهده پروفایل" : "View profile"}</span>
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ) : (
              <div className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-slate-500">
                <span>{locale === "fa" ? "پروفایل تیم" : "plus profile"}</span>
                <ExternalLink className="size-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}