import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS, SPAWN } from "./constants.ts";
import { zoneAt } from "./zones.ts";
import { randomSpawn, SPAWN_AREA } from "./spawn.ts";

describe("randomSpawn", () => {
  it("covers the whole spawn area from corner to corner", () => {
    expect(randomSpawn(() => 0)).toEqual({
      x: SPAWN_AREA.minX,
      z: SPAWN_AREA.minZ,
    });
    const max = randomSpawn(() => 1);
    expect(max.x).toBeCloseTo(SPAWN_AREA.maxX);
    expect(max.z).toBeCloseTo(SPAWN_AREA.maxZ);
  });

  it("always lands inside the area", () => {
    for (let i = 0; i < 200; i++) {
      const { x, z } = randomSpawn();
      expect(x).toBeGreaterThanOrEqual(SPAWN_AREA.minX);
      expect(x).toBeLessThanOrEqual(SPAWN_AREA.maxX);
      expect(z).toBeGreaterThanOrEqual(SPAWN_AREA.minZ);
      expect(z).toBeLessThanOrEqual(SPAWN_AREA.maxZ);
    }
  });

  it("is the open floor below the desks, as in the prototype, not a room with a private call", () => {
    // The southern strip, in the middle: south of the last row of desks, north of the wall
    expect(SPAWN_AREA.minZ).toBeGreaterThan(6.2);
    expect(SPAWN_AREA.maxZ + PLAYER_RADIUS).toBeLessThan(9.85);
    expect(SPAWN_AREA.minX).toBeLessThanOrEqual(0);
    expect(SPAWN_AREA.maxX).toBeGreaterThanOrEqual(0);
    expect(
      zoneAt((SPAWN_AREA.minX + SPAWN_AREA.maxX) / 2, SPAWN_AREA.minZ, null),
    ).toBeNull();
  });

  it("starts looking north, into the office", () => {
    expect(SPAWN.yaw).toBe(0);
  });

  it("gives different players different positions", () => {
    const a = randomSpawn(() => 0.1);
    const b = randomSpawn(() => 0.9);
    expect(a).not.toEqual(b);
  });
});
