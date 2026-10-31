// Anchor server durations to a monotonic clock, conservatively including request
// latency. Client clock/timezone changes cannot extend the verification window.
export function otpDeadline(expiresAt: string, serverNow: string, requestStarted: number) {
  return requestStarted + Math.max(0, Date.parse(expiresAt) - Date.parse(serverNow));
}

export function otpSeconds(deadline: number | null, now: number) {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
