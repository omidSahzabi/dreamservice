import { useCallback, useEffect, useRef, useState } from "react";
import type { Swiper as SwiperType } from "swiper";

export function useRandomAutoplay(swiper: SwiperType | null) {
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const clear = useCallback(() => {
    generation.current++;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const reset = useCallback(() => {
    clear();
    const version = generation.current;
    const schedule = () => {
      if (version !== generation.current || !swiper || swiper.destroyed || paused || focused || hovered || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer.current = setTimeout(() => {
        if (version !== generation.current) return;
        timer.current = null;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !swiper.destroyed) swiper.slideNext();
        // Swiper can synchronously reset us through onSlideChange. That reset
        // owns the next timer; this callback must not create a second chain.
        schedule();
      }, 6000);
    };
    schedule();
  }, [clear, focused, hovered, paused, swiper]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reset();
    media.addEventListener("change", reset);
    return () => { clear(); media.removeEventListener("change", reset); };
  }, [clear, reset]);
  return { paused, setPaused, setFocused, setHovered, reset };
}
