import { useState, useEffect } from 'react';
import { intervalToDuration, isBefore } from 'date-fns';

export function useCountdown(targetDate: Date) {
  const [state, setState] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, isLaunched: false
  });

  useEffect(() => {
    const tick = () => {
      if (isBefore(targetDate, new Date()))
        return setState((s) => ({ ...s, isLaunched: true }));

      const d = intervalToDuration({ start: new Date(), end: targetDate });
      setState({
        days: d.days ?? 0,
        hours: d.hours ?? 0,
        minutes: d.minutes ?? 0,
        seconds: d.seconds ?? 0,
        isLaunched: false,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return { timeLeft: state, isLaunched: state.isLaunched };
}
