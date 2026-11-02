"use client";

import {useEffect, useRef} from "react";
import {useLocale, useTranslations} from "next-intl";
import styles from "./Cinematic.module.css";

const industries = [
  {value:128400, symbol:"◇"}, {value:94600, symbol:"✧"},
  {value:173800, symbol:"▤"}, {value:61500, symbol:"✳"},
  {value:88100, symbol:"✺"}, {value:47200, symbol:"↗"},
];

export function IndustryCounters() {
  const t = useTranslations("Cinematic");
  const locale = useLocale();
  const grid = useRef<HTMLDivElement>(null);
  const format = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US");

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const numbers = element.querySelectorAll<HTMLElement>("[data-count]");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const formatter = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US");
    let animation = 0;
    const finish = () => {
      cancelAnimationFrame(animation);
      numbers.forEach((number, index) => { number.textContent = formatter.format(industries[index].value); });
    };
    const preference = () => { if (motion.matches) finish(); };
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      if (motion.matches) { finish(); return; }
      const start = performance.now();
      const frame = (time: number) => {
        let done = true;
        numbers.forEach((number, index) => {
          const progress = Math.max(0, Math.min(1, (time - start - index * 105) / 1550));
          number.textContent = formatter.format(Math.round(industries[index].value * (1 - Math.pow(1 - progress, 4))));
          if (progress < 1) done = false;
        });
        if (!done) animation = requestAnimationFrame(frame);
      };
      animation = requestAnimationFrame(frame);
    }, {threshold:.16});
    observer.observe(element);
    motion.addEventListener("change", preference);
    return () => { observer.disconnect(); cancelAnimationFrame(animation); motion.removeEventListener("change", preference); };
  }, [locale]);

  return (
    <div className={styles["counter-section"]}>
      <div className={styles["counter-heading"]}>{t("counterHeading")}</div>
      <div ref={grid} className={styles["counter-grid"]}>
        {industries.map((industry, index) => (
          <div key={index} className={styles["counter-card"]}>
            <span className={styles["counter-symbol"]} aria-hidden="true">{industry.symbol} {String(index + 1).padStart(2, "0")}</span>
            <div className={styles["counter-number"]}>
              <span className="sr-only">{format.format(industry.value)}+</span>
              <span data-count={industry.value} aria-hidden="true">{format.format(industry.value)}</span><span className={styles.plus} aria-hidden="true">+</span>
            </div>
            <div className={styles["counter-label"]}>{t(`industry${index}`)}</div>
          </div>
        ))}
      </div>
      <p className={styles["counter-caption"]}>{t("counterFootnote")}</p>
    </div>
  );
}
