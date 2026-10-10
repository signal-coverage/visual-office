export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolates between two angles (radians) along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((b - a) % twoPi) + Math.PI * 3) % twoPi) - Math.PI;
  return a + diff * t;
}
