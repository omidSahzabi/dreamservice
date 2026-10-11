"use client";
import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type {Swiper as SwiperInstance} from "swiper";
import {useLocale, useTranslations} from "next-intl";
import { Navigation, Pagination, EffectCoverflow, A11y } from "swiper/modules";
import ProjectCard from "./ProjectCard";
import { useRandomAutoplay } from "@/hooks/useRandomAutoplay";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-coverflow";

const projects = [
  { id: 1,  image: "🛒", tags: ["Next.js", "TypeScript", "Tailwind"] },
  { id: 2,  image: "📊", tags: ["React", "Redux", "Charts"] },
  { id: 3,  image: "📱", tags: ["React Native", "Firebase"] },
  { id: 4,  image: "👤", tags: ["Next.js", "Framer Motion"] },
  { id: 5,  image: "🤝", tags: ["Vue.js", "Node.js"] },
  { id: 6,  image: "🎓", tags: ["Next.js", "Stripe"] },
  { id: 7,  image: "🎮", tags: ["TypeScript", "Canvas"] },
];

export default function ProjectsCarousel() {
  const locale = useLocale();
  const t = useTranslations("Projects");
  const common = useTranslations("Common");
  const keys = ["store", "dashboard", "mobile", "personal", "crm", "education", "game"] as const;
  const localizedProjects = projects.map((p, i) => ({...p, title: t(`items.${keys[i]}.title`), desc: t(`items.${keys[i]}.description`)}));
  const [swiperInstance, setSwiperInstance] = useState<SwiperInstance | null>(null);
  const resetAutoplay = useRandomAutoplay(swiperInstance);

  // Handlers called on user interactions to reset autoplay timer
  const handleUserInteraction = () => {
    resetAutoplay();
  };

  return (
    <section onClickCapture={handleUserInteraction} id="projects" className="py-24 w-full flex justify-center">
      <div className="w-full max-w-7xl mx-auto px-4">
        <Swiper
          key={locale}
          dir={locale === "fa" ? "rtl" : "ltr"}
          loop={true}
          effect="coverflow"
          modules={[Navigation, Pagination, EffectCoverflow, A11y]}
          spaceBetween={30}
          slidesPerView={1}
          centeredSlides={true}
          coverflowEffect={{ rotate: 50, stretch: 0, depth: 100, modifier: 1, slideShadows: false }}
          a11y={{prevSlideMessage: common("previous"), nextSlideMessage: common("next"), firstSlideMessage: common("firstPage"), lastSlideMessage: common("lastPage"), paginationBulletMessage: common("goToSlide", {index: "{{index}}"}), slideLabelMessage: common("slide", {index: "{{index}}", total: "{{slidesLength}}"})}}
          navigation
          pagination={{ clickable: true }}
          breakpoints={{ 640: { slidesPerView: 1 }, 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
          onSwiper={setSwiperInstance}
          onSlideChange={handleUserInteraction}
          onNavigationPrev={handleUserInteraction}
          onNavigationNext={handleUserInteraction}
          className="!pb-14"
        >
          {localizedProjects.map((project) => (
            <SwiperSlide key={project.id}>
              {({ isActive }) => <ProjectCard project={project} isActive={isActive} />}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
