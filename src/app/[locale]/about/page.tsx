"use client";

import { useLocale } from "next-intl";

import AboutHero from "@/components/templates/about/AboutHero";
import TeamSection from "@/components/templates/about/TeamSection";
import AboutValues from "@/components/templates/about/AboutValues";

export default function AboutPage() {
  const locale = useLocale();
  const isRtl = locale === "fa";

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen overflow-hidden bg-[#070d25] text-white"
    >
      <AboutHero />
      <TeamSection />
      <AboutValues />
    </main>
  );
}
