import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH, PLAYER_RADIUS } from "./constants.ts";
import {
  BOX_PIECES,
  FURNITURE,
  OFFICE_COLLIDERS,
  PLANTS,
  sceneFor,
} from "./layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { PROP_COLLIDERS, PROPS } from "./props.ts";
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

describe("sceneFor", () => {
  it("draws and blocks the same as the constants, for the layout in officeData.ts", () => {
    const scene = sceneFor({
      furniture: OFFICE_FURNITURE,
      models: OFFICE_MODELS,
    });
    expect(scene.pieces).toEqual(BOX_PIECES);
    expect(scene.plants).toEqual(PLANTS);
    expect(scene.colliders).toEqual(OFFICE_COLLIDERS);
    expect(scene.furniture).toEqual(FURNITURE);
    expect(scene.models).toEqual(PROPS);
  });

  it("has only the shell when nothing stands inside", () => {
    const scene = sceneFor({ furniture: [], models: [] });
    expect(scene.plants).toEqual([]);
    expect(scene.pieces.length).toBeGreaterThan(0);
    expect(scene.colliders.length).toBeGreaterThan(0);
  });

  it("adds what a piece of furniture is made of and blocks", () => {
    const empty = sceneFor({ furniture: [], models: [] });
    const scene = sceneFor({
      furniture: [{ kind: "desk", x: -5, z: -3, rotation: 0 }],
      models: [],
    });
    expect(scene.pieces.length).toBeGreaterThan(empty.pieces.length);
    expect(scene.colliders.length).toBeGreaterThan(empty.colliders.length);
  });

  it("lists the plants, so they can be drawn", () => {
    const scene = sceneFor({
      furniture: [{ kind: "plant", x: 2, z: 3, rotation: 0 }],
      models: [],
    });
    expect(scene.plants).toEqual([{ x: 2, z: 3 }]);
  });

  it("blocks where a model's footprint is, and nowhere for a decoration", () => {
    const empty = sceneFor({ furniture: [], models: [] });
    const scene = sceneFor({
      furniture: [],
      models: [
        { model: "a.glb", at: [1, 1], footprint: [1, 1] },
        { model: "b.glb", at: [3, 3] },
      ],
    });
    expect(scene.colliders).toHaveLength(empty.colliders.length + 1);
    expect(scene.models).toHaveLength(2);
  });

  it("leaves out anything malformed, as the file does, so a bad stored layout cannot break the floor", () => {
    const scene = sceneFor({
      furniture: [
        { kind: "desk", x: -5, z: -3, rotation: 0 },
        { kind: "spaceship", x: 0, z: 0, rotation: 0 },
        7,
      ] as never,
      models: [{ model: "../x.glb", at: [1, 1] }, null] as never,
    });
    expect(scene.furniture).toHaveLength(1);
    expect(scene.models).toEqual([]);
  });
});
