import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS } from "./constants.ts";
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

  it("keeps the player clear of the west wall and the first desk column", () => {
    // west wall inner face at x = -10 + 0.15, first desk starts at x = -6.9
    expect(SPAWN_AREA.minX - PLAYER_RADIUS).toBeGreaterThan(-9.85);
    expect(SPAWN_AREA.maxX + PLAYER_RADIUS).toBeLessThan(-6.9);
  });

  it("gives different players different positions", () => {
    const a = randomSpawn(() => 0.1);
    const b = randomSpawn(() => 0.9);
    expect(a).not.toEqual(b);
  });
});
