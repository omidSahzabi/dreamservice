"use client";
import type {ReactNode} from "react";
import { motion } from "framer-motion";

type Props = {feature: {icon: ReactNode; title: string; description: string}; active: boolean; index: number; onClick: () => void; isInView: boolean};

export default function FeatureCard({ feature, active, index, onClick, isInView }: Props) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ delay: 0.5 + index * 0.1 }}
      onClick={onClick}
      className={`p-4 text-start rounded-2xl border cursor-pointer transition ${
        active ? "bg-white/10 border-white/30 shadow" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex gap-3">
        <div className={`p-2 rounded-xl ${active ? "bg-gradient-to-br from-blue-500 to-purple-600" : "bg-white/10"}`}>
          {feature.icon}
        </div>
        <div>
          <h3 className="text-white text-sm font-semibold">{feature.title}</h3>
          <p className="text-white/60 text-xs">{feature.description}</p>
        </div>
      </div>
      {active && (
        <motion.div layoutId="indicator" className="w-8 h-1 bg-blue-500 rounded-full mx-auto mt-2" />
      )}
    </motion.button>
  );
}
