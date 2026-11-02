"use client";

import {useEffect, useId, useRef, useState, type RefObject} from "react";
import {useTranslations} from "next-intl";
import {createHemisphereRenderer} from "./hemisphere-renderer";
import type {CinematicFrame} from "./timeline";
import styles from "./Cinematic.module.css";

export default function HemisphereScene({progress, scene: playhead, interactive}: {progress: RefObject<number>; scene: RefObject<CinematicFrame>; interactive: boolean}) {
  const t = useTranslations("Cinematic");
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createHemisphereRenderer> | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const help = useId();

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d", {alpha:true});
    if (!element || !context) return;
    const scene = createHemisphereRenderer(context);
    renderer.current = scene;
    setReady(true);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let animation = 0;
    let previous = 0;
    let lastProgress = -1;
    let width = 0;
    let dirty = true;
    const frame = (time: number) => {
      animation = 0;
      if (!visible || document.hidden) return;
      const changed = lastProgress !== progress.current;
      const climaxActive = progress.current >= .62 && progress.current < .90;
      if ((motion.matches || climaxActive || time - previous >= (width < 550 ? 34 : 24)) && (!motion.matches || dirty || changed)) {
        scene.render(motion.matches ? 0 : time, previous ? Math.min(time - previous, 60) : 25, playhead.current, motion.matches);
        previous = time;
        lastProgress = progress.current;
        dirty = false;
      }
      if (!motion.matches) animation = requestAnimationFrame(frame);
    };
    const wake = () => {
      dirty = true;
      if (visible && !document.hidden && !animation) animation = requestAnimationFrame(frame);
    };
    redraw.current = wake;
    const resize = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      width = box.width;
      element.width = Math.round(box.width * dpr);
      element.height = Math.round(box.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(box.width, box.height);
      wake();
    });
    resize.observe(element);
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { previous = 0; wake(); }
      else { cancelAnimationFrame(animation); animation = 0; }
    });
    visibility.observe(element);
    const pageVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(animation); animation = 0; }
      else { previous = 0; wake(); }
    };
    motion.addEventListener("change", wake);
    document.addEventListener("visibilitychange", pageVisibility);
    window.addEventListener("scroll", wake, {passive:true});
    return () => {
      cancelAnimationFrame(animation);
      resize.disconnect(); visibility.disconnect();
      motion.removeEventListener("change", wake);
      document.removeEventListener("visibilitychange", pageVisibility);
      window.removeEventListener("scroll", wake);
      renderer.current = null;
      redraw.current = () => {};
    };
  }, [progress, playhead]);

  const pointer = useRef<{id:number; x:number; y:number} | null>(null);
  const rotate = (yaw: number, pitch = 0) => {
    if (progress.current > .43) return;
    renderer.current?.rotate(yaw, pitch);
    redraw.current();
  };

  return (
    <>
      <div className={styles.fallback} hidden={ready}>{t("canvasFallback")}</div>
      <canvas ref={canvas} className={styles["globe-canvas"]} tabIndex={interactive ? 0 : -1} role="img" aria-label={t("canvasLabel")} aria-describedby={help}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key) || progress.current > .43) return;
          event.preventDefault();
          if (event.key === "Home") { renderer.current?.reset(); redraw.current(); }
          else rotate(event.key === "ArrowLeft" ? -.18 : event.key === "ArrowRight" ? .18 : 0, event.key === "ArrowUp" ? -.08 : event.key === "ArrowDown" ? .08 : 0);
        }}
        onPointerDown={event => {
          if (progress.current > .43 || (event.pointerType === "mouse" && event.button !== 0)) return;
          pointer.current = {id:event.pointerId, x:event.clientX, y:event.clientY};
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const previous = pointer.current;
          if (!previous || previous.id !== event.pointerId) return;
          rotate((event.clientX - previous.x) * .009, (event.clientY - previous.y) * .006);
          pointer.current = {id:event.pointerId, x:event.clientX, y:event.clientY};
        }}
        onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }}>
        {t("canvasFallback")}
      </canvas>
      <p id={help} className="sr-only">{t("canvasHelp")}</p>
      {interactive && <div className={styles.controls}>
        <button type="button" disabled={!interactive} aria-label={t("rotateLeft")} onClick={() => rotate(-.3)}>←</button>
        <button type="button" disabled={!interactive} aria-label={t("reset")} onClick={() => { if (progress.current <= .43) { renderer.current?.reset(); redraw.current(); } }}>↺</button>
        <button type="button" disabled={!interactive} aria-label={t("rotateRight")} onClick={() => rotate(.3)}>→</button>
      </div>}
    </>
  );
}
