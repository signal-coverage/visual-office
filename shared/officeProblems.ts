import type { Box } from "./collision.ts";
import { PLAYER_RADIUS } from "./constants.ts";
import {
  CATALOG,
  furnitureColliders,
  furnitureExtent,
  isFlat,
  type Furniture,
} from "./furniture.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import { footprintCollider, type PropPlacement } from "./props.ts";
import { shellFloorBox, type Shell } from "./shell.ts";
import { shellColliders } from "./shellGeometry.ts";
import { zoneAt, zonesOf } from "./zones.ts";

/** Something about an office layout that would make it unusable or look broken. */
export type ProblemCode =
  "outside" | "overlap" | "wall" | "spawn" | "unreachable";

/** One thing in the layout: an entry of the furniture list or of the models list. */
export interface Target {
  list: "furniture" | "models";
  index: number;
}

export interface Problem {
  code: ProblemCode;
  /** In words a person can act on. */
  message: string;
  /** What is wrong, so the editor can point at it. Empty when it is about the office as a whole. */
  targets: Target[];
}

interface Thing {
  target: Target;
  label: string;
  /** What it blocks. */
  colliders: Box[];
  /** Everything it covers, decoration included. */
  extent: Box[];
}

/** Floating point noise and things that merely touch are not problems. */
const TOLERANCE = 1e-6;
const WALL_TOLERANCE = 0.01;
/** How finely the floor is checked for a way through. */
const GRID_STEP = 0.2;

const overlaps = (a: Box, b: Box) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > TOLERANCE &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > TOLERANCE;

const outside = (box: Box, floor: Box) =>
  box.minX < floor.minX - WALL_TOLERANCE ||
  box.maxX > floor.maxX + WALL_TOLERANCE ||
  box.minZ < floor.minZ - WALL_TOLERANCE ||
  box.maxZ > floor.maxZ + WALL_TOLERANCE;

function thingsOf(furniture: Furniture[], models: PropPlacement[]): Thing[] {
  const things: Thing[] = furniture.map((item, index) => {
    return {
      target: { list: "furniture", index },
      label: CATALOG[item.kind].label.toLowerCase(),
      colliders: furnitureColliders(item),
      // A rug may run under a wall
      extent: isFlat(item.kind) ? [] : furnitureExtent(item),
    };
  });

  models.forEach((prop, index) => {
    const box = footprintCollider(prop);
    things.push({
      target: { list: "models", index },
      label: prop.model,
      colliders: box ? [box] : [],
      extent: box ? [box] : [],
    });
  });
  return things;
}

/** Whether a player standing at (x, z) would be inside something. */
const blockedAt = (x: number, z: number, boxes: Box[]) =>
  boxes.some(
    (b) =>
      x + PLAYER_RADIUS > b.minX &&
      x - PLAYER_RADIUS < b.maxX &&
      z + PLAYER_RADIUS > b.minZ &&
      z - PLAYER_RADIUS < b.maxZ,
  );

/** Which floor points somebody who appears at the spawn area can walk to. */
function reachableFloor(
  boxes: Box[],
  floor: Box,
  spawn: Box,
): ((x: number, z: number) => boolean) | null {
  const start = {
    x: (spawn.minX + spawn.maxX) / 2,
    z: (spawn.minZ + spawn.maxZ) / 2,
  };
  if (blockedAt(start.x, start.z, boxes)) return null;

  const key = (i: number, j: number) => `${i},${j}`;
  const seen = new Set([key(0, 0)]);
  const queue: Array<[number, number]> = [[0, 0]];
  while (queue.length > 0) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      const x = start.x + ni * GRID_STEP;
      const z = start.z + nj * GRID_STEP;
      if (x < floor.minX || x > floor.maxX) continue;
      if (z < floor.minZ || z > floor.maxZ) continue;
      if (seen.has(key(ni, nj)) || blockedAt(x, z, boxes)) continue;
      seen.add(key(ni, nj));
      queue.push([ni, nj]);
    }
  }
  return (x, z) =>
    seen.has(
      key(
        Math.round((x - start.x) / GRID_STEP),
        Math.round((z - start.z) / GRID_STEP),
      ),
    );
}

/**
 * Everything wrong with a layout: things past the walls, on top of each other
 * or inside a wall, standing where people appear, or closing off a room. It is
 * what the editor shows while somebody edits, and what the server warns about
 * when it starts. A layout with problems still loads; this is only to tell.
 */
export function findProblems(
  furniture: Furniture[],
  models: PropPlacement[],
  shell: Shell = DEFAULT_SHELL,
): Problem[] {
  const things = thingsOf(furniture, models);
  const floor = shellFloorBox(shell);
  const walls = shellColliders(shell);
  const zones = zonesOf(shell);
  const spawnArea = shell.spawn.area;
  const problems: Problem[] = [];

  for (const thing of things) {
    if (thing.extent.some((box) => outside(box, floor))) {
      problems.push({
        code: "outside",
        message: `The ${thing.label} sticks out past the walls.`,
        targets: [thing.target],
      });
    }
    if (
      thing.colliders.some((box) => walls.some((wall) => overlaps(box, wall)))
    ) {
      problems.push({
        code: "wall",
        message: `The ${thing.label} is inside a wall.`,
        targets: [thing.target],
      });
    }
    const spawn: Box = {
      minX: spawnArea.minX - PLAYER_RADIUS,
      maxX: spawnArea.maxX + PLAYER_RADIUS,
      minZ: spawnArea.minZ - PLAYER_RADIUS,
      maxZ: spawnArea.maxZ + PLAYER_RADIUS,
    };
    if (thing.colliders.some((box) => overlaps(box, spawn))) {
      problems.push({
        code: "spawn",
        message: `The ${thing.label} is where people appear when they join.`,
        targets: [thing.target],
      });
    }
  }

  for (let a = 0; a < things.length; a++) {
    for (let b = a + 1; b < things.length; b++) {
      const touching = things[a].colliders.some((boxA) =>
        things[b].colliders.some((boxB) => overlaps(boxA, boxB)),
      );
      if (touching) {
        problems.push({
          code: "overlap",
          message: `The ${things[a].label} and the ${things[b].label} are on top of each other.`,
          targets: [things[a].target, things[b].target],
        });
      }
    }
  }

  const everything = [...walls, ...things.flatMap((t) => t.colliders)];
  const reachable = reachableFloor(everything, floor, spawnArea);
  // If people cannot even stand where they appear, the spawn problem above says so
  if (reachable) {
    for (const zone of zones) {
      let found = false;
      for (let x = floor.minX; x <= floor.maxX && !found; x += GRID_STEP) {
        for (let z = floor.minZ; z <= floor.maxZ; z += GRID_STEP) {
          if (zoneAt(x, z, null, zones) === zone.id && reachable(x, z)) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        problems.push({
          code: "unreachable",
          message: `Nobody can walk into the ${zone.label.toLowerCase()} from where people appear.`,
          targets: [],
        });
      }
    }
  }
  return problems;
}
