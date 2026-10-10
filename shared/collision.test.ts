import { describe, expect, it } from "vitest";
import { moveWithCollisions, type Box } from "./collision.ts";

const RADIUS = 0.4;
const wall: Box = { minX: 5, maxX: 6, minZ: -10, maxZ: 10 };

describe("moveWithCollisions", () => {
  it("moves freely when nothing is in the way", () => {
    const next = moveWithCollisions(
      { x: 0, z: 0 },
      { x: 1, z: 2 },
      [wall],
      RADIUS,
    );
    expect(next.x).toBeCloseTo(1);
    expect(next.z).toBeCloseTo(2);
  });

  it("stops the player in front of a wall", () => {
    const next = moveWithCollisions(
      { x: 4, z: 0 },
      { x: 2, z: 0 },
      [wall],
      RADIUS,
    );
    expect(next.x).toBeCloseTo(wall.minX - RADIUS);
    expect(next.z).toBe(0);
  });

  it("slides along the wall instead of sticking to it", () => {
    const next = moveWithCollisions(
      { x: 4.6, z: 0 },
      { x: 1, z: 1 },
      [wall],
      RADIUS,
    );
    expect(next.x).toBeCloseTo(wall.minX - RADIUS);
    expect(next.z).toBeCloseTo(1);
  });

  it("does not tunnel through a thin wall on a large step", () => {
    const thin: Box = { minX: 5, maxX: 5.1, minZ: -10, maxZ: 10 };
    const next = moveWithCollisions(
      { x: 0, z: 0 },
      { x: 20, z: 0 },
      [thin],
      RADIUS,
    );
    expect(next.x).toBeLessThan(thin.minX);
  });
});
