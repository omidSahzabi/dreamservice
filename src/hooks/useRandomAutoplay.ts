import { useEffect, useRef } from "react";
import type { Swiper as SwiperType } from "swiper";

export function useRandomAutoplay(swiper: SwiperType | null) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getRandomDelay = () => 1000 + Math.random() * 1000;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearExistingTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const scheduleNextSlide = () => {
    clearExistingTimeout();
    if (reducedMotion()) return;
    timeoutRef.current = setTimeout(() => {
      if (swiper && !reducedMotion()) {
        swiper.slideNext();
        scheduleNextSlide();
      }
    }, getRandomDelay());
  };

  const resetAutoplay = () => {
    clearExistingTimeout();
    scheduleNextSlide();
  };

  useEffect(() => {
    scheduleNextSlide();

    return () => {
      clearExistingTimeout();
    };
  }, [swiper]);

  return resetAutoplay;
}
