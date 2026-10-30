"use client";
import type {ReactNode} from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {feature: {icon: ReactNode; title: string; description: string}; active: boolean; index: number; onClick: () => void; isInView: boolean};

export default function FeatureCard({ feature, active, index, onClick, isInView }: Props) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ delay: 0.5 + index * 0.1 }}
      onClick={onClick}
      className={`p-4 text-start rounded-2xl border cursor-pointer transition motion-reduce:opacity-100! motion-reduce:transform-none! ${
        active ? "bg-accent border-primary/40 shadow-xs" : "bg-card border-border hover:bg-secondary"
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-3">
        <div className={`size-10 shrink-0 flex items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
          {feature.icon}
        </div>
        <div>
          <h3 className="text-foreground text-sm font-semibold">{feature.title}</h3>
          <p className="text-muted-foreground text-xs">{feature.description}</p>
        </div>
      </div>
      {active && (
        <motion.div layoutId="indicator" className="w-8 h-1 bg-primary rounded-full mx-auto mt-2" />
      )}
    </motion.button>
  );
}
