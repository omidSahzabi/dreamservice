export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;
export function smooth(start: number, end: number, value: number) {
  const progress = clamp((value - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

// Scroll introduces the shot; one latched playhead owns release through settling.
export const climax = {
  enter: .625, entered: .648, draw: .650, drawn: .704,
  release: .732, impact: .808, stopped: .865, settled: .895,
  message: .900,
} as const;

export const phase = (start: number, end: number, value: number) => clamp((value - start) / (end - start), 0, 1);

export const shotGeometry = {scale: .021, distance: 1.22, draw: 8} as const;
export const shotDuration = {flight: .68, braking: .48, settling: .26} as const;
export const handRatios = {second: 1, minute: 12, hour: 144} as const;

export function shotAt(progress: number) {
  const impact = phase(climax.impact, climax.settled, progress);
  const draw = smooth(climax.draw, climax.drawn, progress);
  const travel = phase(climax.release, climax.impact, progress);
  // Short acceleration ramp followed by near-ballistic flight, with zero initial velocity.
  const flight = (travel - .12 * (1 - Math.exp(-travel / .12))) / (1 - .12 * (1 - Math.exp(-1 / .12)));
  // In official SVG units: the nock travels with the string until it passes rest.
  const displacement = (shotGeometry.distance / shotGeometry.scale - 13) * flight - shotGeometry.draw;
  const string = displacement <= 0 ? displacement : 1.2 * Math.sin(displacement / 1.2) * Math.exp(-displacement / 2.4) * (1 - smooth(.8, 1, flight));
  return {
    enter: smooth(climax.enter, climax.entered, progress),
    draw,
    string: progress < climax.release ? -shotGeometry.draw * draw : string,
    flight,
    impact,
    tension: smooth(.47, climax.release, progress) * (1 - smooth(climax.impact, climax.settled, progress)),
    calm: smooth(climax.impact, climax.settled, progress),
    vibration: progress < climax.impact ? 0 : Math.sin(impact * Math.PI * 10) * (1 - impact) ** 4,
    flash: progress < climax.impact ? 0 : (1 - smooth(0, .22, impact)) * .85,
    penetration: smooth(climax.impact, climax.impact + .014, progress) * .022,
  };
}

export const clockSpeedAt = (progress: number) => 2.8 + 3.2 * smooth(.19, .45, progress) + 36 * smooth(.45, climax.drawn, progress);

export type CinematicFrame = {progress: number; turn: number; oscillation: number; settled: boolean};

/** Visible elapsed time drives the hands, even when scroll is stationary.
 * Release is irreversible. Its bounded flight and braking cannot be skipped by a wheel jump.
 */
export function createCinematicTimeline() {
  let turn = .25, speed = clockSpeedAt(0), elapsed = 0;
  let released = false, stopped = false;
  let impactTurn = 0, impactSpeed = 0;
  let current: CinematicFrame = {progress: 0, turn, oscillation: 0, settled: false};
  const {flight, braking, settling} = shotDuration;
  const finish = flight + braking + settling;
  const rotate = (dt: number, progress: number) => {
    const target = clockSpeedAt(progress), decay = Math.exp(-dt / .16);
    turn += target * dt + (speed - target) * .16 * (1 - decay);
    speed = target + (speed - target) * decay;
  };
  return {
    frame: () => current,
    advance(milliseconds: number, requested: number, reduced = false): CinematicFrame {
      const dt = clamp(milliseconds / 1000, 0, .05);
      if (requested >= climax.release) released = true;
      if (reduced) {
        if (released) { elapsed = finish; stopped = true; }
        current = {progress: released ? Math.max(climax.settled, requested) : requested, turn, oscillation: 0, settled: stopped};
        return current;
      }
      if (!released) {
        rotate(dt, requested);
        current = {progress: requested, turn, oscillation: 0, settled: false};
        return current;
      }
      if (stopped) {
        current = {...current, progress: Math.max(climax.settled, requested), oscillation: 0, settled: true};
        return current;
      }
      const before = elapsed;
      elapsed = Math.min(finish, elapsed + dt);
      if (before < flight) {
        rotate(Math.min(elapsed, flight) - before, climax.release);
        if (elapsed >= flight) { impactTurn = turn; impactSpeed = speed; }
      }
      const brake = phase(flight, flight + braking, elapsed);
      if (elapsed >= flight) turn = impactTurn + impactSpeed * braking * (1 - (1 - brake) ** 4) / 4;
      const settle = phase(flight + braking, finish, elapsed);
      const oscillation = Math.sin(settle * Math.PI * 4) * Math.sin(settle * Math.PI) ** 2 * (1 - settle) ** 2 * .045;
      const progress = elapsed < flight ? lerp(climax.release, climax.impact, elapsed / flight)
        : elapsed < flight + braking ? lerp(climax.impact, climax.stopped, brake)
        : lerp(climax.stopped, climax.settled, settle);
      stopped = elapsed >= finish;
      current = {progress, turn, oscillation, settled: stopped};
      return current;
    },
  };
}

export const chapterAnchors = [0, .30, .54, .73, .985];
export function chapterAt(progress: number) {
  return progress < .19 ? 0 : progress < .45 ? 1 : progress < .63 ? 2 : progress < climax.message ? 3 : 4;
}
