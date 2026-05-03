import { useEffect, useRef } from "react";
import type { Swiper as SwiperType } from "swiper";

export function useRandomAutoplay(swiper: SwiperType | null) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getRandomDelay = () => 1000 + Math.random() * 1000;

  const clearExistingTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const scheduleNextSlide = () => {
    clearExistingTimeout();
    timeoutRef.current = setTimeout(() => {
      if (swiper) {
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
