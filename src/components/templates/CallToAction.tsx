"use client";

import React, { useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { 
  Rocket, 
  Shield, 
  Zap, 
  Users, 
  Award, 
  Heart,
  Star,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Crown,
  Gem
} from "lucide-react";

// ============== Types ==============
interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface CTABarButton {
  text: string;
  icon?: React.ReactNode;
  id: string ;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

// ============== Main Component ==============
export default function CallToAction(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-200px" });
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  // انیمیشن‌های transform بر اساس اسکرول
  const boxOpen = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const lidRotate = useTransform(scrollYProgress, [0, 0.5], [-120, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const contentY = useTransform(scrollYProgress, [0.3, 0.5], [50, 0]);
  const lightIntensity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  const [activeFeature, setActiveFeature] = useState(0);

  const features: FeatureItem[] = [
    { 
      icon: <Rocket className="w-6 h-6" />, 
      title: "سرعت بالا", 
      description: "بهینه‌سازی شده برای بالاترین سرعت" 
    },
    { 
      icon: <Shield className="w-6 h-6" />, 
      title: "امنیت کامل", 
      description: "Protection با استانداردهای روز دنیا" 
    },
    { 
      icon: <Zap className="w-6 h-6" />, 
      title: "پشتیبانی ۲۴/۷", 
      description: "تیم ما همیشه آنلاین و آماده کمک" 
    },
    { 
      icon: <Users className="w-6 h-6" />, 
      title: "تیم متخصص", 
      description: "سال‌ها تجربه در حوزه فناوری" 
    },
    { 
      icon: <Award className="w-6 h-6" />, 
      title: "کیفیت برتر", 
      description: "بهترین خدمات با بهترین قیمت" 
    },
    { 
      icon: <Heart className="w-6 h-6" />, 
      title: "مشتری مداری", 
      description: "رضایت شما اولویت ماست" 
    },
  ];

  const buttons: CTABarButton[] = [
    { text: "شروع همکاری", variant: "primary", onClick: () => {} , id:'1' },
    { text: "مشاوره رایگان", variant: "secondary", onClick: () => {} , id:'2' },
    { text: "نمونه کارها", variant: "outline", onClick: () => {} ,id:'3' },
    { text: "تماس با ما", variant: "outline", onClick: () => {} , id:'4' },
  ];

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center py-40 overflow-visible"
    >
      {/* جعبه اصلی */}
      <motion.div
        className="relative z-10 w-full max-w-5xl mx-4"
        style={{ scale: boxOpen }}
      >
        {/* نور داخل جعبه */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: lightIntensity }}
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-96 h-96 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-[120px] opacity-60"
          />
        </motion.div>

        {/* بدنه جعبه */}
        <div className="relative">
          {/* درب جعبه */}
          <motion.div
            className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 to-white/10 rounded-t-3xl origin-top"
            style={{ rotateX: lidRotate, transformOrigin: "top center" }}
          >
            {/* دستگیره درب */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-2 bg-white/30 rounded-full" />
          </motion.div>

          {/* داخل جعبه - محتوا */}
          <motion.div
            className="relative bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 pt-20"
            style={{ 
              opacity: contentOpacity,
              y: contentY,
              boxShadow: useTransform(
                lightIntensity,
                [0, 1],
                ["0 0 0px rgba(59,130,246,0)", "0 0 100px rgba(59,130,246,0.5)"]
              )
            }}
          >
            {/* ذرات نوری بیرون آمده */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: isInView ? [0, 1, 0] : 0,
                scale: isInView ? [0, 1.5, 0] : 0,
                y: isInView ? [0, -100] : 0
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-10 left-1/4"
            >
              <Sparkles className="w-8 h-8 text-yellow-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: isInView ? [0, 1, 0] : 0,
                scale: isInView ? [0, 1.2, 0] : 0,
                y: isInView ? [0, -80] : 0
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              className="absolute -top-8 right-1/3"
            >
              <Crown className="w-6 h-6 text-purple-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: isInView ? [0, 1, 0] : 0,
                scale: isInView ? [0, 1, 0] : 0,
                y: isInView ? [0, -60] : 0
              }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 1 }}
              className="absolute -top-6 left-1/2"
            >
              <Gem className="w-5 h-5 text-blue-400" />
            </motion.div>

            {/* نوار دکمه‌های بالا */}
            <motion.div 
              className="flex flex-wrap justify-center gap-3 mb-10"
            >
              {buttons.map((button, index) => (
                <motion.button
                  key={button?.id}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ 
                    delay: 0.2 + index * 0.1,
                    type: "spring",
                    stiffness: 200,
                    damping: 10
                  }}
                  whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                  onClick={button.onClick}
                  className={`
                    px-6 py-3 rounded-full font-medium text-sm
                    transition-all duration-300
                    flex items-center gap-2
                    ${button.variant === 'primary' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl' 
                      : button.variant === 'secondary'
                      ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                      : 'bg-transparent text-white border border-white/30 hover:bg-white/10'
                    }
                  `}
                >
                  {button.icon}
                  {button.text}
                </motion.button>
              ))}
            </motion.div>

            {/* جعبه نورانی مرکزی */}
            <motion.div
              className="relative mb-12"
            >
              {/* نور مرکزی */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-40 h-40 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-[80px]"
                />
              </div>
              
              {/* متن مرکزی */}
              <div className="relative text-center py-8">
                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  animate={isInView ? { y: 0, opacity: 1 } : {}}
                  transition={{ delay: 0.3 }}
                  className="text-4xl md:text-5xl font-bold text-white mb-4"
                >
                  آیا آماده‌اید؟
                </motion.h2>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={isInView ? { y: 0, opacity: 1 } : {}}
                  transition={{ delay: 0.4 }}
                  className="text-white/70 text-lg max-w-xl mx-auto"
                >
                  همین حالا شروع کنید و تجربه‌ای متفاوت داشته باشید
                </motion.p>
              </div>
            </motion.div>

            {/* ویژگی‌ها */}
            <div className="relative">
              {/* دکمه‌های ناوبری */}
              <button 
                onClick={() => setActiveFeature((prev) => (prev - 1 + features.length) % features.length)}
                className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveFeature((prev) => (prev + 1) % features.length)}
                className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* ویژگی‌ها */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className={`
                      relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer
                      ${activeFeature === index 
                        ? 'bg-white/10 border-white/30 shadow-lg shadow-blue-500/20' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }
                    `}
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="relative flex items-start gap-3">
                      <div className={`
                        p-2 rounded-xl
                        ${activeFeature === index 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                          : 'bg-white/10'
                        }
                      `}>
                        <div className="text-white">
                          {feature.icon}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm mb-1">
                          {feature.title}
                        </h3>
                        <p className="text-white/60 text-xs">
                          {feature.description}
                        </p>
                      </div>
                    </div>

                    {activeFeature === index && (
                      <motion.div 
                        layoutId="activeIndicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* امتیاز و تعداد مشتریان */}
            <motion.div
              className="flex items-center justify-center gap-8 mt-8 pt-8 border-t border-white/10"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-slate-900"
                    />
                  ))}
                </div>
                <span className="text-white/70 text-sm mr-2">+۵۰۰ مشتری راضی</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="text-white/70 text-sm mr-1">۴.۹</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* پرتوهای بیرون آمده از جعبه */}
      <motion.div 
        className="absolute inset-0 pointer-events-none overflow-visible"
        style={{ opacity: lightIntensity }}
      >
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-px h-40 bg-gradient-to-b from-blue-500 to-transparent"
            style={{
              transform: `translateX(-50%) rotate(${i * 45}deg)`,
              transformOrigin: "bottom center"
            }}
            animate={{
              height: [60, 100, 60],
              opacity: [0.3, 0.7, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}