import { OFFICE_DEPTH, OFFICE_WIDTH } from "../../shared/constants.ts";

/** Pixels per meter in the plan. */
export const SCALE = 32;
/** Room around the office, in pixels, for the labels and the walls' thickness. */
const MARGIN = 40;

export const CANVAS_WIDTH = OFFICE_WIDTH * SCALE + MARGIN * 2;
export const CANVAS_HEIGHT = OFFICE_DEPTH * SCALE + MARGIN * 2;

/**
 * A point on the floor (x east, z south, in meters, from the middle of the
 * office) to a pixel of the plan. North is at the top, so the plan reads like
 * the room does from above, with the meeting room at the top left.
 */
export function worldToScreen(x: number, z: number): [number, number] {
  return [
    MARGIN + (x + OFFICE_WIDTH / 2) * SCALE,
    MARGIN + (z + OFFICE_DEPTH / 2) * SCALE,
  ];
}

export function screenToWorld(sx: number, sy: number): [number, number] {
  return [
    (sx - MARGIN) / SCALE - OFFICE_WIDTH / 2,
    (sy - MARGIN) / SCALE - OFFICE_DEPTH / 2,
  ];
}
