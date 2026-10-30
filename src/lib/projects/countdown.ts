export function countdownAt(deadline: string, now: number) {
  const difference = Date.parse(deadline) - now;
  const remaining = Number.isFinite(difference) ? Math.max(0, Math.ceil(difference / 1000)) : 0;
  return { days: Math.floor(remaining / 86400), hours: Math.floor(remaining / 3600) % 24,
    minutes: Math.floor(remaining / 60) % 60, seconds: remaining % 60, expired: remaining === 0 };
}
