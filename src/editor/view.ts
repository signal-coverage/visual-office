import { OFFICE_DEPTH, OFFICE_WIDTH } from "../../shared/constants.ts";

/** Pixels per meter in the plan. */
export const SCALE = 32;
/** Room around the office, in pixels, for the labels and the walls' thickness. */
const MARGIN = 40;

/** How a floor is laid out on the plan: where each meter goes, and how big the canvas is. */
export interface View {
  canvasWidth: number;
  canvasHeight: number;
  /**
   * A point on the floor (x east, z south, in meters, from the middle of the
   * floor) to a pixel of the plan. North is at the top, so the plan reads like
   * the room does from above.
   */
  worldToScreen: (x: number, z: number) => [number, number];
  screenToWorld: (sx: number, sy: number) => [number, number];
}

/** The view of a floor of this size: every floor is shown at the same scale, so the canvas is as big as the floor. */
export function viewOf(floor: { width: number; depth: number }): View {
  const { width, depth } = floor;
  return {
    canvasWidth: width * SCALE + MARGIN * 2,
    canvasHeight: depth * SCALE + MARGIN * 2,
    worldToScreen: (x, z) => [
      MARGIN + (x + width / 2) * SCALE,
      MARGIN + (z + depth / 2) * SCALE,
    ],
    screenToWorld: (sx, sy) => [
      (sx - MARGIN) / SCALE - width / 2,
      (sy - MARGIN) / SCALE - depth / 2,
    ],
  };
}

/** The view of the default floor, the main office. */
export const DEFAULT_VIEW: View = viewOf({
  width: OFFICE_WIDTH,
  depth: OFFICE_DEPTH,
});

export const CANVAS_WIDTH = DEFAULT_VIEW.canvasWidth;
export const CANVAS_HEIGHT = DEFAULT_VIEW.canvasHeight;
export const worldToScreen = DEFAULT_VIEW.worldToScreen;
export const screenToWorld = DEFAULT_VIEW.screenToWorld;
