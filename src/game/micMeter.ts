/** Quieter than this shows as an empty bar: the hiss of a quiet room. */
const FLOOR_DB = -60;
/** Louder than this fills the bar. */
const CEILING_DB = -10;
/** How fast the bar falls once the sound stops, in whole bars per second. */
const DECAY_PER_SECOND = 2.5;

export const METER_STEPS = 8;

/**
 * Turns the loudness of the microphone (RMS amplitude, 0..1) into how full the
 * bar should be (0..1). Loudness is perceived in decibels, so the bar follows
 * those, not the raw amplitude.
 */
export function levelFromRms(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
}

/** Rises at once and falls gradually, like the meter on a mixing desk. */
export function smoothLevel(
  previous: number,
  target: number,
  dt: number,
): number {
  if (target >= previous) return target;
  return Math.max(target, previous - DECAY_PER_SECOND * dt);
}

/** Whole bars to draw (0..METER_STEPS). Any sound at all shows at least one. */
export function meterSteps(level: number): number {
  if (!(level > 0)) return 0;
  return Math.min(METER_STEPS, Math.max(1, Math.round(level * METER_STEPS)));
}
