import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "../../shared/constants.ts";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  SCALE,
  screenToWorld,
  viewOf,
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

describe("viewOf", () => {
  const sizes = [
    { width: 30, depth: 20 },
    { width: 24, depth: 16 },
    { width: 36, depth: 20 },
    { width: 48, depth: 36 },
    { width: 16, depth: 12 },
  ];

  it("is the one the editor always had for the main office", () => {
    const view = viewOf({ width: OFFICE_WIDTH, depth: OFFICE_DEPTH });
    expect(view.canvasWidth).toBe(CANVAS_WIDTH);
    expect(view.canvasHeight).toBe(CANVAS_HEIGHT);
    expect(view.worldToScreen(3.5, -2)).toEqual(worldToScreen(3.5, -2));
    expect(view.screenToWorld(400, 300)).toEqual(screenToWorld(400, 300));
  });

  it.each(sizes)(
    "fits a floor of $width by $depth, with room around it",
    (size) => {
      const view = viewOf(size);
      const [left, top] = view.worldToScreen(-size.width / 2, -size.depth / 2);
      const [right, bottom] = view.worldToScreen(
        size.width / 2,
        size.depth / 2,
      );
      expect(left).toBeGreaterThan(0);
      expect(top).toBeGreaterThan(0);
      expect(right).toBeLessThan(view.canvasWidth);
      expect(bottom).toBeLessThan(view.canvasHeight);
    },
  );

  it.each(sizes)(
    "goes there and back on a floor of $width by $depth",
    (size) => {
      const view = viewOf(size);
      for (const [x, z] of [
        [0, 0],
        [-size.width / 2 + 0.15, -size.depth / 2 + 0.15],
        [size.width / 2 - 0.15, size.depth / 2 - 0.15],
      ]) {
        const [sx, sy] = view.worldToScreen(x, z);
        const [wx, wz] = view.screenToWorld(sx, sy);
        expect(wx).toBeCloseTo(x);
        expect(wz).toBeCloseTo(z);
      }
    },
  );

  it("keeps a meter the same length on every floor, and the canvas inside what a screen can show", () => {
    for (const size of sizes) {
      const view = viewOf(size);
      const [x0] = view.worldToScreen(0, 0);
      const [x1] = view.worldToScreen(1, 0);
      expect(x1 - x0).toBeCloseTo(SCALE);
      expect(view.canvasWidth).toBeLessThanOrEqual(48 * SCALE + 100);
      expect(view.canvasHeight).toBeLessThanOrEqual(36 * SCALE + 100);
    }
  });
});
