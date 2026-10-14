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
  /** How much of the box shows, from 0 (nothing) to 1 (fully); left out for an ordinary solid box. Glass walls use it. */
  opacity?: number;
}

export const COLORS = {
  wall: 0xece4d6,
  floor: 0xc9a57c,
  /** The darker boards of the wooden floor, which alternate with `floor`. */
  floorDark: 0xbf9a70,
  ceiling: 0xf6f2ea,
  /** Self-lighting for the ceiling: nothing shines on it from below. */
  ceilingGlow: 0x707070,
  desk: 0xc8a27a,
  monitor: 0x222222,
  chair: 0x2f3640,
  glass: 0xbcd6d8,
  meetingTable: 0x8a6a4a,
  /** The floor of the meeting room and of the lounge. */
  meetingFloor: 0x6d7f8c,
  loungeFloor: 0xd7c3a0,
  counter: 0xf2efe8,
  island: 0xc8a27a,
  sofa: 0x3f7d5c,
  receptionDesk: 0xd9643a,
  rug: 0x3b5b8a,
  whiteboard: 0xfafafa,
  frame: 0x8a8d93,
  pot: 0xd9643a,
  leaves: 0x4f8a4a,
  light: 0xffffff,
} as const;
