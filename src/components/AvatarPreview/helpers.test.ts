import { describe, expect, it } from "vitest";
import { DRAG_SPEED } from "./consts";
import { dragYaw } from "./helpers";

describe("dragYaw", () => {
  it("does not turn when the pointer does not move", () => {
    expect(dragYaw(1.2, 0)).toBe(1.2);
  });

  it("turns one way when dragging right and the other way when dragging left", () => {
    expect(dragYaw(0, 100)).toBeCloseTo(100 * DRAG_SPEED);
    expect(dragYaw(0, -100)).toBeCloseTo(-100 * DRAG_SPEED);
  });

  it("adds to the turn the character already had", () => {
    expect(dragYaw(2, 10)).toBeCloseTo(2 + 10 * DRAG_SPEED);
  });
});
