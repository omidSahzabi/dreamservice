"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function AboutHero() {
  const t = useTranslations("About.Hero");

  return (
    <section className="relative mx-auto max-w-7xl px-5 pt-24 pb-16 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute -top-32 right-0 size-[28rem] rounded-full bg-violet-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-20 left-0 size-[22rem] rounded-full bg-cyan-500/15 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative max-w-3xl"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold text-violet-200 backdrop-blur-md">
          <Sparkles className="size-3.5" />
          {t("badge")}
        </span>

        <h1 className="mt-6 text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {t("title")}
        </h1>

        <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300">
          {t("description")}
        </p>
      </motion.div>
    </section>
  );
}
