/** What the office is built from: boxes, and the colours they are painted. */

export interface BoxPiece {
  /** [width, height, depth] */
  size: readonly [number, number, number];
  /** Center position [x, y, z] */
  at: readonly [number, number, number];
  color: number;
  solid: boolean;
  emissive?: number;
  /** Cast shadows. Flat decals and light panels do not need to. */
  shadows: boolean;
}

export const COLORS = {
  wall: 0xe8e4da,
  floor: 0x9a9aa0,
  ceiling: 0xf4f4f4,
  /** Self-lighting for the ceiling: nothing shines on it from below. */
  ceilingGlow: 0x707070,
  desk: 0x9c6b3f,
  monitor: 0x222222,
  chair: 0x2f3542,
  divider: 0xcfd8dc,
  meetingTable: 0x6d4c41,
  rug: 0x3b5b8a,
  whiteboard: 0xfafafa,
  frame: 0x8a8d93,
  pot: 0x8b5a3c,
  leaves: 0x3f8f4f,
  light: 0xffffff,
} as const;
