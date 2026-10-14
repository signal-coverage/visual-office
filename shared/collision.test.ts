import { describe, expect, it } from "vitest";
import { moveWithCollisions, segmentBlocked, type Box } from "./collision.ts";

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

describe("segmentBlocked", () => {
  const wallBox: Box = { minX: 2, maxX: 3, minZ: -5, maxZ: 5 };

  it("is free when nothing lies between the two points", () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 1.5, z: 0 }, [wallBox])).toBe(
      false,
    );
  });

  it("is blocked by a box between the points", () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 5, z: 0 }, [wallBox])).toBe(
      true,
    );
  });

  it("is blocked by a box only crossed on a diagonal", () => {
    expect(segmentBlocked({ x: 0, z: -4 }, { x: 5, z: 4 }, [wallBox])).toBe(
      true,
    );
  });

  it("ignores the box an end point stands in: it is the thing being reached", () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 2.5, z: 0 }, [wallBox])).toBe(
      false,
    );
    expect(segmentBlocked({ x: 2.5, z: 0 }, { x: 0, z: 0 }, [wallBox])).toBe(
      false,
    );
  });

  it("still sees a second box behind the one that is ignored", () => {
    const behind: Box = { minX: 3.5, maxX: 4, minZ: -5, maxZ: 5 };
    expect(
      segmentBlocked({ x: 2.5, z: 0 }, { x: 6, z: 0 }, [wallBox, behind]),
    ).toBe(true);
  });
});
