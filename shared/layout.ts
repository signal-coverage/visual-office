import type { Box } from "./collision.ts";
import {
  OFFICE_DEPTH,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  WALL_THICKNESS,
} from "./constants.ts";
import { PROP_COLLIDERS } from "./props.ts";

/**
 * The office as plain data. The client draws it and the server uses the same
 * pieces for collisions, so what you can walk through is decided in one place.
 * (When the office becomes a modelled GLB, only the drawing changes: this file
 * keeps describing where players can and cannot stand.)
 */

export interface BoxPiece {
  /** [width, height, depth] */
  size: readonly [number, number, number];
  /** Center position [x, y, z] */
  at: readonly [number, number, number];
  color: number;
  solid: boolean;
  emissive?: number;
  /** Cast shadows. Flat decals and light panels do not need to. */
  shadows: boolean;
}

export interface PlantPiece {
  x: number;
  z: number;
}

export const COLORS = {
  wall: 0xe8e4da,
  floor: 0x9a9aa0,
  ceiling: 0xf4f4f4,
  /** Self-lighting for the ceiling: nothing shines on it from below. */
  ceilingGlow: 0x707070,
  desk: 0x9c6b3f,
  monitor: 0x222222,
  chair: 0x2f3542,
  divider: 0xcfd8dc,
  meetingTable: 0x6d4c41,
  rug: 0x3b5b8a,
  whiteboard: 0xfafafa,
  frame: 0x8a8d93,
  pot: 0x8b5a3c,
  leaves: 0x3f8f4f,
  light: 0xffffff,
} as const;

const POSTER_COLORS = [0x5b8cff, 0xffb347, 0x6bcf8f];

const WIDTH = OFFICE_WIDTH;
const DEPTH = OFFICE_DEPTH;
const HEIGHT = OFFICE_HEIGHT;
const WALL = WALL_THICKNESS;

const DESK_ROWS_Z = [-3, 3];
const DESK_COLUMNS_X = [-6, -2, 2];
const DIVIDER_X = 5.5;
const DIVIDER_THICKNESS = 0.2;
const DOOR_HALF_WIDTH = 1.5;
const MEETING_CENTER = { x: 8, z: 0 };

/** The floor of the meeting room: from the divider to the walls around it. */
export const MEETING_ROOM: Box = {
  minX: DIVIDER_X + DIVIDER_THICKNESS / 2,
  maxX: WIDTH / 2 - WALL / 2,
  minZ: -DEPTH / 2 + WALL / 2,
  maxZ: DEPTH / 2 - WALL / 2,
};

const PLANT_COLLIDER_SIZE = 0.5;

export const BOX_PIECES: BoxPiece[] = [];
export const PLANTS: PlantPiece[] = [];

const add = (
  size: BoxPiece["size"],
  at: BoxPiece["at"],
  color: number,
  {
    solid = true,
    emissive,
    shadows = true,
  }: { solid?: boolean; emissive?: number; shadows?: boolean } = {},
) => {
  BOX_PIECES.push({ size, at, color, solid, emissive, shadows });
};

/** A chair whose backrest is on the `backSide` (+1 / -1) side of the seat along z. */
const chair = (x: number, z: number, backSide: 1 | -1) => {
  add([0.5, 0.45, 0.5], [x, 0.225, z], COLORS.chair);
  add([0.5, 0.5, 0.08], [x, 0.7, z + backSide * 0.21], COLORS.chair, {
    solid: false,
  });
};

// Outer walls
add([WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, -DEPTH / 2], COLORS.wall);
add([WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, DEPTH / 2], COLORS.wall);
add([WALL, HEIGHT, DEPTH], [-WIDTH / 2, HEIGHT / 2, 0], COLORS.wall);
add([WALL, HEIGHT, DEPTH], [WIDTH / 2, HEIGHT / 2, 0], COLORS.wall);

// Open-plan desks: monitors face +z, chairs sit on that side
for (const z of DESK_ROWS_Z) {
  for (const x of DESK_COLUMNS_X) {
    add([1.8, 0.75, 0.9], [x, 0.375, z], COLORS.desk);
    add([0.6, 0.4, 0.05], [x, 1.0, z - 0.2], COLORS.monitor, { solid: false });
    chair(x, z + 0.95, 1);
  }
}

// Meeting room: a divider with a door gap, a table with chairs, a rug and a whiteboard
const dividerLength = DEPTH / 2 - DOOR_HALF_WIDTH;
const dividerCenter = DOOR_HALF_WIDTH + dividerLength / 2;
add(
  [DIVIDER_THICKNESS, HEIGHT, dividerLength],
  [DIVIDER_X, HEIGHT / 2, -dividerCenter],
  COLORS.divider,
);
add(
  [DIVIDER_THICKNESS, HEIGHT, dividerLength],
  [DIVIDER_X, HEIGHT / 2, dividerCenter],
  COLORS.divider,
);

const { x: mx, z: mz } = MEETING_CENTER;
add([4.2, 0.02, 4.8], [mx, 0.011, mz], COLORS.rug, {
  solid: false,
  shadows: false,
});
add([1.2, 0.75, 3.2], [mx, 0.375, mz], COLORS.meetingTable);
for (const dz of [-1.2, 0, 1.2]) {
  chair(mx - 1.1, mz + dz, -1);
  chair(mx + 1.1, mz + dz, 1);
}
const boardX = WIDTH / 2 - WALL / 2 - 0.03;
add([0.04, 1.5, 2.8], [boardX, 1.6, mz], COLORS.frame, {
  solid: false,
  shadows: false,
});
add([0.05, 1.3, 2.6], [boardX - 0.01, 1.6, mz], COLORS.whiteboard, {
  solid: false,
  shadows: false,
});

// Decoration: corner plants, posters on the north wall, ceiling light panels
const plantX = WIDTH / 2 - 0.9;
const plantZ = DEPTH / 2 - 0.9;
for (const [x, z] of [
  [-plantX, -plantZ],
  [-plantX, plantZ],
  [plantX, -plantZ],
  [plantX, plantZ],
]) {
  PLANTS.push({ x, z });
}

POSTER_COLORS.forEach((color, i) => {
  const x = DESK_COLUMNS_X[i];
  add([0.9, 1.2, 0.03], [x, 1.7, -DEPTH / 2 + WALL / 2 + 0.02], color, {
    solid: false,
    shadows: false,
  });
});

const lights: Array<[number, number]> = [
  ...DESK_COLUMNS_X.flatMap((x) =>
    DESK_ROWS_Z.map((z): [number, number] => [x, z]),
  ),
  [mx, mz - 1.5],
  [mx, mz + 1.5],
];
for (const [x, z] of lights) {
  add([1.4, 0.05, 0.5], [x, HEIGHT - 0.03, z], COLORS.light, {
    solid: false,
    shadows: false,
    emissive: COLORS.light,
  });
}

function colliderOf(x: number, z: number, w: number, d: number): Box {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** Everything a player bumps into, as XZ boxes: the built-in furniture plus your own models. */
export const OFFICE_COLLIDERS: Box[] = [
  ...BOX_PIECES.filter((p) => p.solid).map((p) =>
    colliderOf(p.at[0], p.at[2], p.size[0], p.size[2]),
  ),
  ...PLANTS.map((p) =>
    colliderOf(p.x, p.z, PLANT_COLLIDER_SIZE, PLANT_COLLIDER_SIZE),
  ),
  ...PROP_COLLIDERS,
];
