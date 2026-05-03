"use client";
import React, { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, EffectCoverflow } from "swiper/modules";
import ProjectCard from "./ProjectCard";
import { useRandomAutoplay } from "@/hooks/useRandomAutoplay";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-coverflow";

const projects = [
  { id: 1, title: "فروشگاه آنلاین", desc: "طراحی و توسعه فروشگاه کامل با Next.js", image: "🛒", tags: ["Next.js", "TypeScript", "Tailwind"] },
  { id: 2, title: "داشبورد مدیریت", desc: "پنل ادمین با طراحی مدرن و ریسپانسیو", image: "📊", tags: ["React", "Redux", "Charts"] },
  { id: 3, title: "اپلیکیشن موبایل", desc: "اپلیکیشن فروشگاهی با React Native", image: "📱", tags: ["React Native", "Firebase"] },
  { id: 4, title: "وب‌سایت شخصی", desc: "سایت رزومه و نمونه کارها", image: "👤", tags: ["Next.js", "Framer Motion"] },
  { id: 5, title: "سیستم CRM", desc: "مدیریت ارتباط با مشتریان", image: "🤝", tags: ["Vue.js", "Node.js"] },
  { id: 6, title: "پلتفرم آموزشی", desc: "سیستم آموزش آنلاین با ویدیو", image: "🎓", tags: ["Next.js", "Stripe"] },
  { id: 7, title: "بازی تحت وب", desc: "بازی مرورگری با Canvas", image: "🎮", tags: ["TypeScript", "Canvas"] },
];

export default function ProjectsCarousel() {
  const [swiperInstance, setSwiperInstance] = useState(null);
  const resetAutoplay = useRandomAutoplay(swiperInstance);

  // Handlers called on user interactions to reset autoplay timer
  const handleUserInteraction = () => {
    resetAutoplay();
  };

  return (
    <section className="py-24 w-full flex justify-center">
      <div className="w-full max-w-7xl mx-auto px-4">
        <Swiper
          loop={true}
          effect="coverflow"
          modules={[Navigation, Pagination, EffectCoverflow]}
          spaceBetween={30}
          slidesPerView={1}
          centeredSlides={true}
          coverflowEffect={{ rotate: 50, stretch: 0, depth: 100, modifier: 1, slideShadows: false }}
          navigation
          pagination={{ clickable: true }}
          breakpoints={{ 640: { slidesPerView: 1 }, 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
          onSwiper={setSwiperInstance}
          onSlideChange={handleUserInteraction}
          onNavigationPrev={handleUserInteraction}
          onNavigationNext={handleUserInteraction}
          onPaginationClick={handleUserInteraction}
          className="!pb-14"
        >
          {projects.map((project) => (
            <SwiperSlide key={project.id}>
              {({ isActive }) => <ProjectCard project={project} isActive={isActive} />}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
