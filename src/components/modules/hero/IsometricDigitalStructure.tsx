"use client";

import {useId} from "react";
import {motion, useReducedMotion, useTransform, type MotionValue} from "framer-motion";
import {cn} from "@/lib/utils";
import styles from "./IsometricDigitalStructure.module.css";

type Variation = "spire" | "terrace";
type Platform = {cx: number; cy: number; width: number; rise: number; drift: number};

const platforms: Record<Variation, readonly Platform[]> = {
  spire: [
    {cx: 98, cy: 160, width: 76, rise: 36, drift: -5},
    {cx: 174, cy: 144, width: 92, rise: 58, drift: 6},
    {cx: 130, cy: 114, width: 58, rise: 58, drift: -2},
  ],
  terrace: [
    {cx: 108, cy: 151, width: 104, rise: 46, drift: -6},
    {cx: 193, cy: 165, width: 60, rise: 42, drift: 8},
    {cx: 153, cy: 113, width: 66, rise: 52, drift: 4},
  ],
};

/** Thin isometric plates, with shallow edge faces rather than container walls. */
function Plate({cx, cy, width, base = false}: {cx: number; cy: number; width: number; base?: boolean}) {
  const x = width / 2;
  const y = width / 4;
  const depth = base ? 5 : 3;
  return <g>
    <path className={styles.edge} d={`M${cx - x} ${cy}v${depth}l${x} ${y} ${x} ${-y}v${-depth}l${-x} ${y}Z`} />
    <path className={styles.face} d={`M${cx} ${cy - y}l${x} ${y} ${-x} ${y} ${-x} ${-y}Z`} />
    <path className={styles.inset} d={`M${cx} ${cy - y * .68}l${x * .68} ${y * .68} ${-x * .68} ${y * .68} ${-x * .68} ${-y * .68}Z`} />
    <path className={styles.trace} d={`M${cx - x * .5} ${cy - y * .5}l${x} ${y}m${-x} 0 ${x} ${-y}`} />
    <path className={styles.port} d={`M${cx} ${cy - 3}l6 3-6 3-6-3Z`} />
  </g>;
}

function FloatingPlatform({platform, progress, secondary}: {platform: Platform; progress: MotionValue<number>; secondary: boolean}) {
  const reducedMotion = useReducedMotion();
  const y = useTransform(progress, [0, 1], [0, -platform.rise]);
  const x = useTransform(progress, [0, 1], [0, platform.drift]);
  return <motion.g
    data-structure-layer="floating"
    className={cn(styles.layer, secondary && styles.secondary)}
    style={{x: reducedMotion ? 0 : x, y: reducedMotion ? 0 : y}}
  >
    <Plate {...platform} />
    <path className={styles.signal} d={`M${platform.cx} ${platform.cy - 13}v-18m0-5v-3`} />
  </motion.g>;
}

function Fragment({progress, index, variation}: {progress: MotionValue<number>; index: number; variation: Variation}) {
  const reducedMotion = useReducedMotion();
  const direction = index % 2 ? 1 : -1;
  const x = useTransform(progress, [0, 1], [0, direction * (12 + index * 3)]);
  const y = useTransform(progress, [0, 1], [0, -18 - index * 8]);
  const opacity = useTransform(progress, [0, .2, 1], [0, .15, .75]);
  const cx = 140 + direction * (65 + index * 4);
  const cy = 206 - index * 11 + (variation === "terrace" ? 12 : 0);
  return <motion.path
    data-structure-fragment=""
    className={styles.fragment}
    d={`M${cx} ${cy - 4}l8 4-8 4-8-4Z`}
    style={{x: reducedMotion ? 0 : x, y: reducedMotion ? 0 : y, opacity: reducedMotion ? 0 : opacity}}
  />;
}

function Particle({progress, index, cx}: {progress: MotionValue<number>; index: number; cx: number}) {
  const reducedMotion = useReducedMotion();
  const y = useTransform(progress, [0, 1], [0, -36 - index * 12]);
  const opacity = useTransform(progress, [0, .25, 1], [.08, .4, .85]);
  return <motion.rect
    className={styles.particle}
    x={cx - 1} y={190 - index * 18} width="2" height={index % 2 ? 6 : 3}
    style={{y: reducedMotion ? 0 : y, opacity: reducedMotion ? .3 : opacity}}
  />;
}

export function IsometricDigitalStructure({progress, variation = "spire", className}: {
  progress: MotionValue<number>;
  variation?: Variation;
  className?: string;
}) {
  const id = useId();
  const beamId = `${id}-beam`;
  const glowId = `${id}-glow`;
  const reducedMotion = useReducedMotion();
  const beamScale = useTransform(progress, [0, 1], [.65, 1]);
  const beamOpacity = useTransform(progress, [0, 1], [.55, .9]);
  const baseY = useTransform(progress, [0, 1], [0, -5]);
  const beams = variation === "spire" ? [98, 122, 174, 188] : [108, 132, 164, 193];

  return <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 280 360"
    fill="none"
    data-digital-structure={variation}
    className={cn(styles.structure, className)}
  >
    <defs>
      <linearGradient id={beamId} gradientUnits="userSpaceOnUse" x1="0" y1="95" x2="0" y2="340">
        <stop stopColor="currentColor" stopOpacity="0" />
        <stop offset=".4" stopColor="currentColor" stopOpacity=".65" />
        <stop offset=".65" stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
      <filter id={glowId} x="-60%" y="-10%" width="220%" height="120%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>

    <path className={styles.footprint} d="m140 260 78 39-78 39-78-39Z" />
    <motion.g data-structure-beams="" className={styles.beams} style={{scaleY: reducedMotion ? .65 : beamScale, opacity: reducedMotion ? .55 : beamOpacity}}>
      <g className={styles.glow} filter={`url(#${glowId})`}>
        {beams.map(cx => <path key={cx} d={`M${cx} 150v180`} stroke={`url(#${beamId})`} strokeWidth="5" />)}
      </g>
      <path d="m108 232 17-9v108l-17 9Zm49-1 12-6v105l-12 6Z" fill={`url(#${beamId})`} className={styles.curtain} />
      {beams.map((cx, index) => <path key={cx} d={`M${cx} ${84 + index * 13}V${334 - index * 5}`} stroke={`url(#${beamId})`} strokeWidth={index % 2 ? 1 : 1.5} />)}
    </motion.g>

    <motion.g data-structure-layer="base" className={styles.layer} style={{y: reducedMotion ? 0 : baseY}}>
      <Plate cx={140} cy={218} width={208} base />
      <path className={styles.grid} d="m88 192 104 52m-130-39 104 52m-52-78 104 52M88 244l104-52M62 231l104-52m-52 78 104-52" />
      <path className={styles.core} d="m140 204 28 14-28 14-28-14Z" />
      <path className={styles.coreInset} d="m140 212 12 6-12 6-12-6Z" />
      <path className={styles.signal} d="M140 218v74m0 6v9" />
    </motion.g>

    {platforms[variation].map((platform, index) => <FloatingPlatform key={index} platform={platform} progress={progress} secondary={index === 2} />)}
    {beams.map((cx, index) => <Particle key={cx} cx={cx} index={index} progress={progress} />)}
    {[0, 1, 2, 3].map(index => <Fragment key={index} progress={progress} index={index} variation={variation} />)}
  </svg>;
}
