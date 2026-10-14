import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "../../shared/constants.ts";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  SCALE,
  screenToWorld,
  worldToScreen,
} from "./view";

describe("worldToScreen and screenToWorld", () => {
  it("are each other's opposite", () => {
    for (const [x, z] of [
      [0, 0],
      [-9.85, -6.85],
      [9.85, 6.85],
      [3.25, -1.7],
    ]) {
      const [sx, sy] = worldToScreen(x, z);
      const [wx, wz] = screenToWorld(sx, sy);
      expect(wx).toBeCloseTo(x);
      expect(wz).toBeCloseTo(z);
    }
  });

  it("puts north (negative z) at the top and east (positive x) on the right", () => {
    const [x0, y0] = worldToScreen(0, 0);
    const [x1] = worldToScreen(1, 0);
    const [, y1] = worldToScreen(0, -1);
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeLessThan(y0);
  });

  it("is a true top view: a meter is the same length both ways", () => {
    const [x0, y0] = worldToScreen(0, 0);
    const [x1] = worldToScreen(1, 0);
    const [, y1] = worldToScreen(0, 1);
    expect(x1 - x0).toBeCloseTo(SCALE);
    expect(y1 - y0).toBeCloseTo(SCALE);
  });

  it("fits the whole office, with room around it, on the canvas", () => {
    const [left, top] = worldToScreen(-OFFICE_WIDTH / 2, -OFFICE_DEPTH / 2);
    const [right, bottom] = worldToScreen(OFFICE_WIDTH / 2, OFFICE_DEPTH / 2);
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
    expect(right).toBeLessThan(CANVAS_WIDTH);
    expect(bottom).toBeLessThan(CANVAS_HEIGHT);
  });
});
