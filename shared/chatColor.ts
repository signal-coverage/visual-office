/**
 * Every player in a room gets a chat colour of their own. The server hands out
 * the lowest index not in use (`lowestFreeColor`) and everyone turns it into
 * the same colour here, so a name looks the same on every screen.
 */

/** About the angle that spreads points around a circle most evenly, one after another. */
const GOLDEN_ANGLE = 137.508;
/**
 * Brightness levels, taken in turn, so colours close on the wheel still differ.
 * Four of them, because the closest pairs of hues are 21 indices apart and a
 * cycle of three would give both the same brightness.
 */
const LIGHTNESS = [58, 68, 78, 66] as const;
const SATURATION = 75;

const safeIndex = (index: number) =>
  Number.isFinite(index) && index > 0 ? Math.floor(index) : 0;

/** Where on the colour wheel (0..360) this index sits: each new one lands far from the others. */
export function chatHue(index: number): number {
  return (safeIndex(index) * GOLDEN_ANGLE) % 360;
}

export function chatLightness(index: number): number {
  return LIGHTNESS[safeIndex(index) % LIGHTNESS.length];
}

/** A CSS colour for this index, bright enough to read on the dark chat background. */
export function chatColor(index: number): string {
  const hue = Math.round(chatHue(index) * 10) / 10;
  return `hsl(${hue} ${SATURATION}% ${chatLightness(index)}%)`;
}

/** The smallest colour index nobody is using. */
export function lowestFreeColor(used: Iterable<number>): number {
  const taken = new Set(used);
  let index = 0;
  while (taken.has(index)) index++;
  return index;
}
