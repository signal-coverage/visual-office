import { describe, expect, it } from "vitest";
import {
  OFFICE_DEPTH,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  PLAYER_RADIUS,
} from "./constants.ts";
import {
  BOX_PIECES,
  FURNITURE,
  MEETING_ROOM,
  MEETING_SCREEN,
  OFFICE_COLLIDERS,
  PLANTS,
  sceneFor,
  WHITEBOARD,
} from "./layout.ts";
import { findProblems } from "./officeProblems.ts";
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
    const canReach = reachableFrom({ x: 0, z: 8.5 });
    expect(canReach(0, 0), "between the desks").toBe(true);
    expect(canReach(-10.5, 8), "reception, beside its desk").toBe(true);
    expect(canReach(10.5, -3.5), "kitchen, beside the island").toBe(true);
    expect(canReach(10.5, 4.5), "lounge, in front of the sofa").toBe(true);
    expect(canReach(-12, -3.2), "just outside the meeting room").toBe(true);
    expect(canReach(-7.5, -3.5), "meeting room, at its open corner").toBe(true);
    expect(canReach(-10.5, -4), "meeting room, beside the table").toBe(true);
    expect(canReach(-10.5, -8.2), "meeting room, other side of the table").toBe(
      true,
    );
  });

  it("closes the meeting room with glass walls, open only at one corner", () => {
    // The glass blocks: a straight line through it is not a way in
    const east = OFFICE_COLLIDERS.filter(
      (b) => b.minX > -6.2 && b.maxX < -5.8 && b.minZ <= -9,
    );
    expect(east.length).toBeGreaterThan(0);
    expect(isBlocked(-6, -8)).toBe(true);
    expect(isBlocked(-12, -2)).toBe(true);
    // ...but the corner is a door wide enough for a person
    expect(isBlocked(-7.5, -3.5)).toBe(false);
    expect(isBlocked(-6, -3.5)).toBe(false);
    expect(isBlocked(-7.5, -2)).toBe(false);
  });

  it("keeps a whiteboard and a shared screen inside the meeting room", () => {
    expect(WHITEBOARD.x).toBeLessThan(MEETING_ROOM.minX + 0.3);
    expect(WHITEBOARD.z).toBeGreaterThan(MEETING_ROOM.minZ);
    expect(WHITEBOARD.z).toBeLessThan(MEETING_ROOM.maxZ);
    expect(MEETING_SCREEN.x).toBeGreaterThan(MEETING_ROOM.minX);
    expect(MEETING_SCREEN.x).toBeLessThan(MEETING_ROOM.maxX);
    expect(MEETING_SCREEN.z).toBeLessThan(MEETING_ROOM.minZ + 0.3);
  });

  it("makes the glass walls see-through and the others not", () => {
    const glass = BOX_PIECES.filter((p) => p.opacity !== undefined);
    expect(glass.length).toBe(2);
    for (const piece of glass) {
      expect(piece.opacity).toBeGreaterThan(0);
      expect(piece.opacity).toBeLessThan(1);
      expect(piece.solid).toBe(true);
    }
  });

  it("is the prototype's office: 30 by 20 metres, 3.2 high", () => {
    expect(OFFICE_WIDTH).toBe(30);
    expect(OFFICE_DEPTH).toBe(20);
    expect(OFFICE_HEIGHT).toBe(3.2);
  });

  it("has its twelve desks, seven plants and the rooms' furniture", () => {
    const count = (kind: string) =>
      FURNITURE.filter((item) => item.kind === kind).length;
    expect(count("desk")).toBe(12);
    expect(count("chair")).toBeGreaterThanOrEqual(12);
    expect(count("plant")).toBe(7);
    expect(count("conference-table")).toBe(1);
    expect(count("counter")).toBe(1);
    expect(count("island")).toBe(1);
    expect(count("sofa")).toBe(1);
    expect(count("reception-desk")).toBe(1);
  });

  it("leaves no problem in the default layout", () => {
    expect(findProblems(FURNITURE, PROPS)).toEqual([]);
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
