import {
  OFFICE_DEPTH,
  OFFICE_WIDTH,
  PLAYER_RADIUS,
  WALL_THICKNESS,
} from "./constants.ts";

export interface Move {
  x: number;
  z: number;
  yaw: number;
}

/** Sent by the server when a reported move was impossible: "you are actually here". */
export interface Correction {
  x: number;
  z: number;
}

/** The size of a floor, for the walls that keep a move inside it. */
export interface FloorSize {
  width: number;
  depth: number;
}

const DEFAULT_SIZE: FloorSize = { width: OFFICE_WIDTH, depth: OFFICE_DEPTH };

const limitOf = (size: number) => size / 2 - WALL_THICKNESS / 2 - PLAYER_RADIUS;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/**
 * Validates an untrusted `move` message from a client. Returns null when the
 * payload is malformed; otherwise a copy clamped to the office bounds.
 */
export function sanitizeMove(
  payload: unknown,
  floor: FloorSize = DEFAULT_SIZE,
): Move | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { x, z, yaw } = payload as Record<string, unknown>;
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw))
    return null;
  return {
    x: clamp(x as number, limitOf(floor.width)),
    z: clamp(z as number, limitOf(floor.depth)),
    yaw: yaw as number,
  };
}
