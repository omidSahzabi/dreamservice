"use client";

import dynamic from "next/dynamic";
import {useEffect, useRef, useState, type CSSProperties, type MouseEvent} from "react";
import {useLocale, useTranslations} from "next-intl";
import {cn} from "@/lib/utils";
import {ProjectCTA} from "./ProjectCTA";
import {chapterAnchors, chapterAt, clamp, climax, createCinematicTimeline, smooth} from "./timeline";
import styles from "./Cinematic.module.css";

const HemisphereScene = dynamic(() => import("./HemisphereScene"), {ssr:false});

export function CinematicStory() {
  const t = useTranslations("Cinematic");
  const locale = useLocale();
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [timeline] = useState(createCinematicTimeline);
  const scene = useRef(timeline.frame());
  const [position, setPosition] = useState(0);
  const [nearby, setNearby] = useState(false);
  const stage = chapterAt(position);
  const number = (value: number) => new Intl.NumberFormat(locale, {minimumIntegerDigits:2}).format(value);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    let animation = 0;
    let previous = 0;
    let target = 0;
    let scrollProgress = 0;
    let visible = false;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const frame = (time: number) => {
      animation = 0;
      if (document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min(time - previous, 50) : 16;
      previous = time;
      scrollProgress += (target - scrollProgress) * (motion.matches ? 1 : 1 - Math.exp(-dt / 65));
      if (Math.abs(target - scrollProgress) < .00001) scrollProgress = target;
      scene.current = timeline.advance(dt, scrollProgress, motion.matches);
      progress.current = scene.current.progress;
      // Text can be revisited, but cannot reveal the resolution before physical settling.
      setPosition(Math.min(scrollProgress, scene.current.progress));
      if (scrollProgress !== target || (visible && !motion.matches && !scene.current.settled)) animation = requestAnimationFrame(frame);
      else previous = 0;
    };
    const schedule = () => {
      const range = Math.max(1, element.offsetHeight - innerHeight);
      target = clamp(-element.getBoundingClientRect().top / range, 0, 1);
      if (!animation) animation = requestAnimationFrame(frame);
    };
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setNearby(true); observer.disconnect(); }
    }, {rootMargin:"600px"});
    observer.observe(element);
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      previous = 0;
      if (visible) schedule();
    });
    visibility.observe(element);
    const pageVisibility = () => { previous = 0; if (!document.hidden) schedule(); };
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    schedule();
    window.addEventListener("scroll", schedule, {passive:true});
    window.addEventListener("resize", schedule, {passive:true});
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", pageVisibility);
    return () => { observer.disconnect(); visibility.disconnect(); resize.disconnect(); cancelAnimationFrame(animation); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); motion.removeEventListener("change", schedule); document.removeEventListener("visibilitychange", pageVisibility); };
  }, [timeline]);

  const jump = (index: number) => {
    const element = section.current;
    if (!element) return;
    const range = element.offsetHeight - innerHeight;
    scrollTo({top:element.getBoundingClientRect().top + scrollY + range * chapterAnchors[index], behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  };

  const reveal = (start: number, end: number): CSSProperties => {
    const value = smooth(start, end, position);
    return {"--reveal":value, visibility:value === 0 ? "hidden" : "visible"} as CSSProperties;
  };
  const continueStory = (event: MouseEvent<HTMLAnchorElement>) => {
    const next = document.getElementById("cinematic-end");
    if (!next) return;
    event.preventDefault();
    next.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block:"start"});
    next.focus({preventScroll:true});
  };

  return (
    <section ref={section} className={styles["story-section"]} id="cinematic-story" aria-label={t("storyLabel")} data-cinematic-stage={stage}>
      <div className={styles["story-sticky"]}>
        <div className={styles["story-inner"]}>
          <div className={styles["story-top"]}>{t("chapter", {number:number(stage + 1)})}</div>
          <div className={styles["story-copy"]}>
            {[0, 1, 2, 3, 4].map(index => (
              <article key={index} data-chapter={index} className={cn(styles.chapter, index === stage && styles.active, index === 4 && styles["chapter-final"])}>
                <span className={styles["stage-number"]}>{t(`stage${index}`)}</span>
                <h2><span className={index === 4 ? styles["resolution-line"] : undefined} style={index === 4 ? reveal(.900, .917) : undefined}>{t(`scene${index}a`)}</span>{index !== 4 && <br />}<span className={cn(styles.emph, index === 4 && styles["resolution-line"])} style={index === 4 ? reveal(.914, .937) : undefined}>{t(`scene${index}b`)}</span></h2>
                {index === 1 ? <div className={styles.questions}>
                  {[0, 1, 2, 3].map(question => <div key={question} className={cn(styles.question, smooth(.19, .43, position) > (question + .35) / 4 && styles.show)}>
                    <span className={styles["question-index"]}>{number(question + 1)}</span><span>{t(`q${question}`)}</span>
                  </div>)}
                </div> : <p className={index === 4 ? styles["resolution-item"] : undefined} style={index === 4 ? reveal(.935, .952) : undefined}>{t(`scene${index}p`)}</p>}
                {index === 0 && <div className={styles.microline}><i />{t("explore")}</div>}
                {index === 2 && <div className={styles["pressure-display"]}><span>{t("pressure")}</span><strong>× {(1 + smooth(.45, .7, position) * 39).toFixed(1).padStart(4, "0")}</strong></div>}
                {index === 3 && <div className={styles.note}>{t("scene3note")}</div>}
                {index === 4 && <>
                  <div className={styles["resolution-item"]} style={reveal(.950, .965)}><ProjectCTA /></div>
                  <div className={styles["resolution-item"]} style={reveal(.962, .978)}>
                    <a href="#cinematic-end" className={styles["next-chapter"]} onClick={continueStory}>
                      <span>{t("nextChapter")}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 4v15m-5-5 5 5 5-5" /></svg>
                    </a>
                  </div>
                </>}
              </article>
            ))}
          </div>
          <div className={styles["scene-visual"]}>
            <div className={styles["visual-ring"]} aria-hidden="true" />
            {nearby ? <HemisphereScene progress={progress} scene={scene} interactive={stage < 2} /> : <div className={styles.fallback}>{t("loading")}</div>}
            <div className={styles["orbit-label"]}>{t("network")}</div>
            <div className={styles["clock-badge"]}>{t(position >= climax.settled ? "reclaimed" : position > .47 ? "accelerating" : "flowing")}</div>
            <div className={cn(styles["drag-hint"], stage >= 2 && styles.hidden)}><span aria-hidden="true">✥</span><span>{t("drag")}</span></div>
          </div>
          <div className={styles["story-progress"]} aria-label={t("storyLabel")}>
            {[0, 1, 2, 3, 4].map(index => <button type="button" key={index} className={cn(styles["progress-node"], index === stage && styles.active)} aria-current={index === stage ? "step" : undefined} aria-label={t("stageLabel", {number:number(index + 1), title:t(`scene${index}a`)})} onClick={() => jump(index)} />)}
          </div>
          <div className={styles["story-index"]} aria-hidden="true">{number(stage + 1)} — {number(5)}</div>
          <a href="#cinematic-end" className={styles["skip-story"]}>{t("skipAnimation")}</a>
        </div>
      </div>
    </section>
  );
}
