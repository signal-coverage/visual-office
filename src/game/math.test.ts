import { describe, expect, it } from "vitest";
import { lerp, lerpAngle } from "./math";

describe("lerp", () => {
  it("interpolates between two values", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(2, 4, 0)).toBe(2);
    expect(lerp(2, 4, 1)).toBe(4);
  });
});

describe("lerpAngle", () => {
  it("interpolates normally when no wrap is needed", () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it("takes the shortest path across the +PI / -PI boundary", () => {
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const mid = lerpAngle(from, to, 0.5);
    // Halfway is PI (or equivalently -PI), not 0
    expect(Math.abs(Math.cos(mid) + 1)).toBeLessThan(1e-9);
  });

  it("reaches the target at t = 1", () => {
    const result = lerpAngle(3, -3, 1);
    expect(Math.cos(result)).toBeCloseTo(Math.cos(-3));
    expect(Math.sin(result)).toBeCloseTo(Math.sin(-3));
  });
});
