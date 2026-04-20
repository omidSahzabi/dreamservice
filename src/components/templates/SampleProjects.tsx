"use client";
import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

interface Project {
  id: number;
  title: string;
  description: string;
  image: string;
  tags: string[];
  link: string;
}

const projects: Project[] = [
  {
    id: 1,
    title: 'فروشگاه آنلاین',
    description: 'طراحی و توسعه فروشگاه کامل با Next.js',
    image: '🛒',
    tags: ['Next.js', 'TypeScript', 'Tailwind'],
    link: '#',
  },
  {
    id: 2,
    title: 'داشبورد مدیریت',
    description: 'پنل ادمین با طراحی مدرن و ریسپانسیو',
    image: '📊',
    tags: ['React', 'Redux', 'Charts'],
    link: '#',
  },
  {
    id: 3,
    title: 'اپلیکیشن موبایل',
    description: 'اپلیکیشن فروشگاهی با React Native',
    image: '📱',
    tags: ['React Native', 'Firebase'],
    link: '#',
  },
  {
    id: 4,
    title: 'وب‌سایت شخصی',
    description: 'سایت رزومه و نمونه کارها',
    image: '👤',
    tags: ['Next.js', 'Framer Motion'],
    link: '#',
  },
  {
    id: 5,
    title: 'سیستم CRM',
    description: 'مدیریت ارتباط با مشتریان',
    image: '🤝',
    tags: ['Vue.js', 'Node.js'],
    link: '#',
  },
  {
    id: 6,
    title: 'پلتفرم آموزشی',
    description: 'سیستم آموزش آنلاین با ویدیو',
    image: '🎓',
    tags: ['Next.js', 'Stripe'],
    link: '#',
  },
  {
    id: 7,
    title: 'بازی تحت وب',
    description: 'بازی مرورگری با Canvas',
    image: '🎮',
    tags: ['TypeScript', 'Canvas'],
    link: '#',
  },
];

export default function SampleProjects(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollProgress = useRef(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // پارالکس پس‌زمینه
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -50]);

  const handleWheel = (e: React.WheelEvent) => {
    if (isDragging) return;
    
    const delta = e.deltaY;
    if (delta > 0) {
      setActiveIndex(prev => Math.min(prev + 1, projects.length - 1));
    } else {
      setActiveIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const endX = e.clientX;
    const diff = startX.current - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setActiveIndex(prev => Math.min(prev + 1, projects.length - 1));
      } else {
        setActiveIndex(prev => Math.max(prev - 1, 0));
      }
    }
    
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX.current - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setActiveIndex(prev => Math.min(prev + 1, projects.length - 1));
      } else {
        setActiveIndex(prev => Math.max(prev - 1, 0));
      }
    }
  };

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen py-24 overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* پس‌زمینه شفاف - بدون رنگ */}
      
      {/* لایه پارالکس - شبکه */}
      <motion.div 
        style={{ y: y1 }}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* لایه پارالکس - ذرات */}
      <motion.div 
        style={{ y: y2 }}
        className="absolute inset-0 pointer-events-none"
      >
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </motion.div>

      {/* هدر */}
      <div className="relative z-10 px-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            پروژه‌های نمونه
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            تعدادی از پروژه‌هایی که با آخرین تکنولوژی‌ها طراحی و توسعه دادم
          </p>
        </motion.div>
      </div>

      {/* کارت‌های stacked */}
      <div className="relative z-10 flex items-center justify-center h-[500px] px-4">
        <AnimatePresence mode="popLayout">
          {projects.map((project, index) => {
            const isActive = index === activeIndex;
            const isPrev = index < activeIndex;
            const isNext = index > activeIndex;
            const distance = Math.abs(index - activeIndex);
            
            return (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.8, x: 100 }}
                animate={{ 
                  opacity: isActive ? 1 : isPrev || isNext ? 0.3 : 0,
                  scale: isActive ? 1 : 0.85,
                  x: isActive ? 0 : (isPrev ? -200 : 200),
                  zIndex: isActive ? 10 : (isPrev || isNext ? 5 : 0),
                  rotateY: isActive ? 0 : (isPrev ? -15 : 15),
                }}
                exit={{ opacity: 0, scale: 0.8, x: 100 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30,
                  opacity: { duration: 0.3 }
                }}
                className={`absolute cursor-pointer ${isActive ? 'w-80 md:w-96' : 'w-72 md:w-80'}`}
                style={{ 
                  transformStyle: "preserve-3d",
                  perspective: "1000px",
                }}
                onClick={() => setActiveIndex(index)}
              >
                <div className={`
                  relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden
                  hover:border-cyan-400/50 transition-all duration-500
                  ${isActive ? 'hover:-translate-y-2' : ''}
                `}>
                  {/* تصویر پروژه */}
                  <div className="h-48 bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center text-6xl relative overflow-hidden">
                    <span className={isActive ? 'text-7xl' : 'text-5xl'}>
                      {project.image}
                    </span>
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/10 to-transparent" />
                    )}
                  </div>

                  {/* محتوا */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-gray-400 text-xs mb-3 line-clamp-2">
                      {project.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-white/5 text-gray-300 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* خط گرادینت */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* شماره صفحه */}
      <div className="relative z-10 flex justify-center items-center gap-4 mt-4">
        <button 
          onClick={() => setActiveIndex(prev => Math.max(prev - 1, 0))}
          disabled={activeIndex === 0}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-2xl font-bold">{activeIndex + 1}</span>
          <span className="text-white/30 text-xl">/</span>
          <span className="text-white/50 text-xl">{projects.length}</span>
        </div>

        <button 
          onClick={() => setActiveIndex(prev => Math.min(prev + 1, projects.length - 1))}
          disabled={activeIndex === projects.length - 1}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* راهنما */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm flex items-center gap-2"
      >
        <span>واسه جابجایی اسکرول کن یا drag کن</span>
      </motion.div>
    </section>
  );
}