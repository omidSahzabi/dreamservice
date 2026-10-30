"use client";
import { useEffect, useState } from "react";
import { countdownAt } from "@/lib/projects/countdown";

export function useCountdown(deadline: string, serverNow: number) {
  const [state, setState] = useState(() => countdownAt(deadline, serverNow));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = countdownAt(deadline, Date.now());
      setState(next);
      if (!next.expired) timer = setTimeout(tick, 1000);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [deadline]);
  return state;
}
