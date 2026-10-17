import { describe, expect, it } from "vitest";
import { sanitizeMove } from "./movement.ts";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "./constants.ts";

describe("sanitizeMove", () => {
  it("accepts a valid position and rotation", () => {
    expect(sanitizeMove({ x: 1, z: -2, yaw: 0.5 })).toEqual({
      x: 1,
      z: -2,
      yaw: 0.5,
    });
  });

  it.each([null, undefined, 42, "move", []])(
    "rejects non-object payload %p",
    (payload) => {
      expect(sanitizeMove(payload)).toBeNull();
    },
  );

  it("rejects missing or non-numeric fields", () => {
    expect(sanitizeMove({ x: 1, z: 2 })).toBeNull();
    expect(sanitizeMove({ x: "1", z: 2, yaw: 0 })).toBeNull();
  });

  it("rejects NaN and Infinity", () => {
    expect(sanitizeMove({ x: NaN, z: 0, yaw: 0 })).toBeNull();
    expect(sanitizeMove({ x: 0, z: Infinity, yaw: 0 })).toBeNull();
  });

  it("clamps positions to stay inside the office walls", () => {
    const move = sanitizeMove({ x: 999, z: -999, yaw: 0 });
    expect(move!.x).toBeLessThan(OFFICE_WIDTH / 2);
    expect(move!.z).toBeGreaterThan(-OFFICE_DEPTH / 2);
  });
});

describe("sanitizeMove in another floor", () => {
  const small = { width: 24, depth: 16 };

  it("clamps to the walls of that floor", () => {
    const move = sanitizeMove({ x: 999, z: -999, yaw: 0 }, small)!;
    expect(move.x).toBeCloseTo(12 - 0.15 - 0.4);
    expect(move.z).toBeCloseTo(-8 + 0.15 + 0.4);
  });

  it("lets a position that is out in a bigger floor through in that one", () => {
    const big = { width: 36, depth: 20 };
    expect(sanitizeMove({ x: 16, z: 0, yaw: 0 }, big)!.x).toBe(16);
    expect(sanitizeMove({ x: 16, z: 0, yaw: 0 }, small)!.x).toBeLessThan(16);
  });
});
