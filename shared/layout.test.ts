import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH, PLAYER_RADIUS } from "./constants.ts";
import { BOX_PIECES, OFFICE_COLLIDERS, PLANTS } from "./layout.ts";
import { PROP_COLLIDERS } from "./props.ts";
import { SPAWN_AREA } from "./spawn.ts";

const isBlocked = (x: number, z: number) =>
  OFFICE_COLLIDERS.some(
    (b) =>
      x + PLAYER_RADIUS > b.minX &&
      x - PLAYER_RADIUS < b.maxX &&
      z + PLAYER_RADIUS > b.minZ &&
      z - PLAYER_RADIUS < b.maxZ,
  );

const STEP = 0.2;

/** Every grid cell a player could stand on and reach from `start` by walking. */
function reachableFrom(start: { x: number; z: number }) {
  const key = (x: number, z: number) =>
    `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
  const seen = new Set([key(start.x, start.z)]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, z } = queue.pop()!;
    for (const [dx, dz] of [
      [STEP, 0],
      [-STEP, 0],
      [0, STEP],
      [0, -STEP],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (Math.abs(nx) > OFFICE_WIDTH / 2 || Math.abs(nz) > OFFICE_DEPTH / 2)
        continue;
      if (seen.has(key(nx, nz)) || isBlocked(nx, nz)) continue;
      seen.add(key(nx, nz));
      queue.push({ x: nx, z: nz });
    }
  }
  return (x: number, z: number) => seen.has(key(x, z));
}

describe("office layout", () => {
  it("derives colliders only from solid pieces, plants and props with a footprint", () => {
    const solid = BOX_PIECES.filter((p) => p.solid).length;
    expect(OFFICE_COLLIDERS).toHaveLength(
      solid + PLANTS.length + PROP_COLLIDERS.length,
    );
    expect(solid).toBeGreaterThan(0);
  });

  it("never spawns a player inside furniture or walls", () => {
    const { minX, maxX, minZ, maxZ } = SPAWN_AREA;
    for (let x = minX; x <= maxX; x += 0.25) {
      for (let z = minZ; z <= maxZ; z += 0.25) {
        expect(isBlocked(x, z), `blocked spawn at ${x}, ${z}`).toBe(false);
      }
    }
  });

  it("lets a player walk from the spawn area to every part of the office", () => {
    const canReach = reachableFrom({ x: -8.2, z: 0 });
    expect(canReach(0, 0), "central corridor").toBe(true);
    expect(canReach(-8.2, 6), "north-west corner area").toBe(true);
    expect(canReach(6.1, 0), "just past the meeting room door").toBe(true);
    expect(canReach(8, 3.6), "meeting room, beside the table").toBe(true);
    expect(canReach(8, -3.6), "meeting room, other side of the table").toBe(
      true,
    );
  });

  it("keeps the meeting room only reachable through its door", () => {
    const canReach = reachableFrom({ x: -8.2, z: 0 });
    expect(canReach(5.5, 4)).toBe(false);
    expect(canReach(5.5, -4)).toBe(false);
  });
});
