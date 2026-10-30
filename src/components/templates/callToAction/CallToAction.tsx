"use client";

import {useTranslations, useFormatter} from "next-intl";
import {useRouter} from "@/lib/i18n/navigation";
import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";

import { features } from "./features";
import { buttons } from "./features";
import FeatureCard from "./FeatureCard";

export default function CallToAction() {
  const t = useTranslations("CallToAction");
  const common = useTranslations("Common");
  const format = useFormatter();
  const router = useRouter();
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(ref, { margin: "-200px" });
  const isInView = reducedMotion || inView;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });

  const boxOpen = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const lidRotate = useTransform(scrollYProgress, [0, 0.5], [-120, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const contentY = useTransform(scrollYProgress, [0.3, 0.5], [50, 0]);

  const [active, setActive] = useState(0);

  return (
    <div ref={ref} className="relative overflow-hidden flex items-center justify-center py-20 sm:py-28">
      <motion.div className="relative z-10 w-full max-w-5xl mx-4 motion-reduce:transform-none!" style={{scale: reducedMotion ? 1 : boxOpen}}>
        <motion.div
          className="absolute inset-x-0 top-0 h-16 bg-secondary rounded-t-3xl origin-top"
          style={{rotateX: reducedMotion ? 0 : lidRotate}}
        />

        <motion.div
          className="relative bg-card border border-border rounded-2xl shadow-soft p-5 sm:p-10 motion-reduce:opacity-100! motion-reduce:transform-none!"
          style={{opacity: reducedMotion ? 1 : contentOpacity, y: reducedMotion ? 0 : contentY}}
        >

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {buttons.map((b, i) => (
              <motion.button
                key={b.key}
                type="button"
                onClick={() => router.push(b.href)}
                initial={reducedMotion ? false : { scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`px-6 py-3 rounded-full text-sm motion-reduce:transform-none! ${
                  b.variant === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                    : b.variant === "secondary"
                    ? "bg-secondary border border-border"
                    : "border border-input"
                }`}
              >
                {t(b.key)}
              </motion.button>
            ))}
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-2">{t("title")}</h2>
            <p className="text-text-secondary">{t("description")}</p>
          </div>

          <div className="relative">
            <button aria-label={common("previous")} onClick={() => setActive((p) => (p - 1 + features.length) % features.length)}
              className="absolute start-0 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-accent"> <ArrowRight className="ltr:rotate-180" /> </button>

            <button aria-label={common("next")} onClick={() => setActive((p) => (p + 1) % features.length)}
              className="absolute end-0 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-accent"> <ArrowLeft className="ltr:rotate-180" /> </button>

            <div className="mx-11 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {features.map((f, i) => (
                <FeatureCard key={i} feature={{icon: <f.Icon className="w-6 h-6" />, title: t(`features.${f.key}.title`), description: t(`features.${f.key}.description`)}} active={active === i} index={i} onClick={() => setActive(i)} isInView={isInView} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-6 border-t border-border pt-6">
            <div className="flex items-center gap-1">
              {[1,2,3,4].map((i)=><div key={i} className="w-6 h-6 bg-primary/15 border border-primary/20 rounded-full" />)}
              <span className="text-text-secondary text-sm">{t("customers", {count: 500})}</span>
            </div>

            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((i)=><Star key={i} className="w-4 h-4 text-warning fill-warning"/>)}
              <span className="text-text-secondary text-sm">{format.number(4.9, {maximumFractionDigits: 1})}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
