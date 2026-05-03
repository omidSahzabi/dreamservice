"use client";

import { useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Star, Sparkles, Crown, Gem } from "lucide-react";

import { features } from "./features";
import { buttons } from "./features";
import FeatureCard from "./FeatureCard";

export default function CallToAction() {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-200px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });

  const boxOpen = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const lidRotate = useTransform(scrollYProgress, [0, 0.5], [-120, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const contentY = useTransform(scrollYProgress, [0.3, 0.5], [50, 0]);
  const light = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  const [active, setActive] = useState(0);

  return (
    <div ref={ref} className="relative min-h-screen flex items-center justify-center py-40">
      <motion.div className="relative z-10 w-full max-w-5xl mx-4" style={{ scale: boxOpen }}>
        <motion.div className="absolute inset-0 flex justify-center" style={{ opacity: light }}>
          <motion.div
            animate={{ scale: [1, 1.5, 1], rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="w-96 h-96 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-[120px] opacity-60"
          />
        </motion.div>

        <motion.div
          className="absolute inset-x-0 top-0 h-16 bg-white/10 rounded-t-3xl origin-top"
          style={{ rotateX: lidRotate }}
        />

        <motion.div
          className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 pt-20"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          <motion.div className="absolute -top-10 left-1/4" animate={{ opacity: isInView ? [0,1,0] : 0 }}>
            <Sparkles className="w-8 h-8 text-yellow-400" />
          </motion.div>

          <motion.div className="absolute -top-8 right-1/3" animate={{ opacity: isInView ? [0,1,0] : 0 }}>
            <Crown className="w-6 h-6 text-purple-400" />
          </motion.div>

          <motion.div className="absolute -top-6 left-1/2" animate={{ opacity: isInView ? [0,1,0] : 0 }}>
            <Gem className="w-5 h-5 text-blue-400" />
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {buttons.map((b, i) => (
              <motion.button
                key={b.id}
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`px-6 py-3 rounded-full text-sm ${
                  b.variant === "primary"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : b.variant === "secondary"
                    ? "bg-white/10 border border-white/20"
                    : "border border-white/30"
                }`}
              >
                {b.text}
              </motion.button>
            ))}
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-2">آیا آماده‌اید؟</h2>
            <p className="text-white/70">همین حالا شروع کنید و تجربه‌ای متفاوت داشته باشید</p>
          </div>

          <div className="relative">
            <button onClick={() => setActive((p) => (p - 1 + features.length) % features.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white"> <ArrowRight /> </button>

            <button onClick={() => setActive((p) => (p + 1) % features.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 text-white"> <ArrowLeft /> </button>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <FeatureCard key={i} feature={f} active={active === i} index={i} onClick={() => setActive(i)} isInView={isInView} />
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-6 mt-6 border-t border-white/10 pt-6">
            <div className="flex items-center gap-1">
              {[1,2,3,4].map((i)=><div key={i} className="w-8 h-8 bg-blue-500 rounded-full" />)}
              <span className="text-white/70 text-sm">+۵۰۰ مشتری راضی</span>
            </div>

            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((i)=><Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400"/>)}
              <span className="text-white/70 text-sm">۴.۹</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
