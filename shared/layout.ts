import type { Box } from "./collision.ts";
import {
  OFFICE_DEPTH,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  WALL_THICKNESS,
} from "./constants.ts";
import {
  furnitureColliders,
  piecesOf,
  sanitizeFurniture,
  type Furniture,
} from "./furniture.ts";
import { interactablesOf, type Interactable } from "./interactions.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { COLORS, type BoxPiece } from "./pieces.ts";
import {
  footprintCollider,
  sanitizeModels,
  type PropPlacement,
} from "./props.ts";

/**
 * The office as plain data. The client draws it and the server uses the same
 * pieces for collisions, so what you can walk through is decided in one place.
 *
 * It has two parts: the shell (outer walls, the meeting room's glass walls and
 * door, the floors of the rooms, the frames of the whiteboard and the screen), which is fixed here
 * because zones, boards and screens depend on it, and everything that stands
 * inside (officeData.ts), which the office editor moves around.
 * (When the office becomes a modelled GLB, only the drawing changes: this file
 * keeps describing where players can and cannot stand.)
 */

export type { BoxPiece };
export { COLORS };

export interface PlantPiece {
  x: number;
  z: number;
}

const WIDTH = OFFICE_WIDTH;
const DEPTH = OFFICE_DEPTH;
const HEIGHT = OFFICE_HEIGHT;
const WALL = WALL_THICKNESS;

/** The glass walls of the meeting room, which sits in the north-west corner. */
const GLASS_THICKNESS = 0.15;
const GLASS_OPACITY = 0.35;
/** The room's floor, in the order of its corners: x from the west wall to its east glass wall. */
const MEETING_EAST_X = -6;
/** And from the north wall to its south glass wall. */
const MEETING_SOUTH_Z = -2;
const MEETING_CENTER = { x: -10.5, z: -6 };

/**
 * The floor of the meeting room: inside its glass walls and the outer walls.
 * Its south-east corner has no wall for 3 m along each glass wall: that is the door.
 */
export const MEETING_ROOM: Box = {
  minX: -WIDTH / 2 + WALL / 2,
  maxX: MEETING_EAST_X - GLASS_THICKNESS / 2,
  minZ: -DEPTH / 2 + WALL / 2,
  maxZ: MEETING_SOUTH_Z - GLASS_THICKNESS / 2,
};

/** The floor inside the outer walls: the furniture has to stay within it. */
export const OFFICE_FLOOR: Box = {
  minX: -WIDTH / 2 + WALL / 2,
  maxX: WIDTH / 2 - WALL / 2,
  minZ: -DEPTH / 2 + WALL / 2,
  maxZ: DEPTH / 2 - WALL / 2,
};

export const BOX_PIECES: BoxPiece[] = [];
export const PLANTS: PlantPiece[] = [];
const shellPieces: BoxPiece[] = [];

const add = (
  into: BoxPiece[],
  size: BoxPiece["size"],
  at: BoxPiece["at"],
  color: number,
  {
    solid = true,
    emissive,
    shadows = true,
    opacity,
  }: {
    solid?: boolean;
    emissive?: number;
    shadows?: boolean;
    opacity?: number;
  } = {},
) => {
  into.push({ size, at, color, solid, emissive, shadows, opacity });
};

// Outer walls
add(
  shellPieces,
  [WIDTH, HEIGHT, WALL],
  [0, HEIGHT / 2, -DEPTH / 2],
  COLORS.wall,
);
add(
  shellPieces,
  [WIDTH, HEIGHT, WALL],
  [0, HEIGHT / 2, DEPTH / 2],
  COLORS.wall,
);
add(
  shellPieces,
  [WALL, HEIGHT, DEPTH],
  [-WIDTH / 2, HEIGHT / 2, 0],
  COLORS.wall,
);
add(
  shellPieces,
  [WALL, HEIGHT, DEPTH],
  [WIDTH / 2, HEIGHT / 2, 0],
  COLORS.wall,
);

// Meeting room: two glass walls, each stopping 3 m short of the other's end
const glass = { opacity: GLASS_OPACITY };
add(
  shellPieces,
  [GLASS_THICKNESS, HEIGHT, 5],
  [MEETING_EAST_X, HEIGHT / 2, -7.5],
  COLORS.glass,
  glass,
);
add(
  shellPieces,
  [6, HEIGHT, GLASS_THICKNESS],
  [-12, HEIGHT / 2, MEETING_SOUTH_Z],
  COLORS.glass,
  glass,
);

// What the floor is made of in the two rooms that have their own
const flat = { solid: false, shadows: false };
add(shellPieces, [8, 0.02, 7], [-10.5, 0.011, -6], COLORS.meetingFloor, flat);
add(shellPieces, [8, 0.02, 6], [10.5, 0.011, 6.5], COLORS.loungeFloor, flat);

const { x: mx, z: mz } = MEETING_CENTER;

// The whiteboard on the west wall: a frame and a white panel
const boardX = -WIDTH / 2 + WALL / 2 + 0.03;
add(shellPieces, [0.04, 1.5, 2.8], [boardX, 1.6, mz], COLORS.frame, {
  solid: false,
  shadows: false,
});
add(
  shellPieces,
  [0.05, 1.3, 2.6],
  [boardX + 0.01, 1.6, mz],
  COLORS.whiteboard,
  { solid: false, shadows: false },
);

// A screen on the north wall of the meeting room, for whatever somebody shares
const northWallZ = -DEPTH / 2 + WALL / 2;
add(shellPieces, [3.5, 2.0, 0.06], [mx, 1.8, northWallZ + 0.03], COLORS.frame, {
  solid: false,
  shadows: false,
});

/** The picture area of that screen: a 16:9 plane just in front of its frame. */
export const MEETING_SCREEN = {
  x: mx,
  y: 1.8,
  z: northWallZ + 0.06 + 0.004,
  width: 3.3,
  height: (3.3 * 9) / 16,
};

/**
 * The part of the whiteboard that can be drawn on: a plane just in front of
 * its white panel, which is 2.6 m wide and 1.3 m high, centred at `y`.
 */
export const WHITEBOARD = {
  x: boardX + 0.01 + 0.025 + 0.004,
  y: 1.6,
  z: mz,
  width: 2.6,
  height: 1.3,
};

/** What stands inside, from officeData.ts; anything malformed there is left out. */
export const FURNITURE = sanitizeFurniture(OFFICE_FURNITURE);

/** What stands in a floor: the furniture and the models of your own. */
export interface Layout {
  furniture: Furniture[];
  models: PropPlacement[];
}

/** A layout turned into what is drawn and what blocks people. */
export interface FloorScene {
  /** The furniture that is left once the malformed entries are out. */
  furniture: Furniture[];
  models: PropPlacement[];
  /** The fixed shell alone: walls, glass, room floors and the frames of the boards. */
  shell: BoxPiece[];
  pieces: BoxPiece[];
  plants: PlantPiece[];
  colliders: Box[];
  /** What can be used: seats, desks, shelves, plants. */
  interactables: Interactable[];
}

/**
 * Everything the client draws and the server collides with, for any layout:
 * the fixed shell plus what the layout holds. Anything malformed is left out,
 * so a bad stored layout cannot break a floor.
 */
export function sceneFor(layout: Layout): FloorScene {
  const furniture = sanitizeFurniture(layout.furniture);
  const models = sanitizeModels(layout.models);
  return {
    furniture,
    models,
    shell: shellPieces,
    pieces: [...shellPieces, ...furniture.flatMap(piecesOf)],
    plants: furniture
      .filter((item) => item.kind === "plant")
      .map(({ x, z }) => ({ x, z })),
    colliders: [
      ...SHELL_COLLIDERS,
      ...furniture.flatMap(furnitureColliders),
      ...models.flatMap((prop) => footprintCollider(prop) ?? []),
    ],
    interactables: interactablesOf({ furniture, models }),
  };
}

/** What the walls and the glass block, with nothing inside the office. */
export const SHELL_COLLIDERS: Box[] = shellPieces
  .filter((piece) => piece.solid)
  .map((piece) => ({
    minX: piece.at[0] - piece.size[0] / 2,
    maxX: piece.at[0] + piece.size[0] / 2,
    minZ: piece.at[2] - piece.size[2] / 2,
    maxZ: piece.at[2] + piece.size[2] / 2,
  }));

const DEFAULT_SCENE = sceneFor({
  furniture: OFFICE_FURNITURE,
  models: OFFICE_MODELS,
});
BOX_PIECES.push(...DEFAULT_SCENE.pieces);
PLANTS.push(...DEFAULT_SCENE.plants);

/** What can be used in the default layout. */
export const OFFICE_INTERACTABLES: Interactable[] = DEFAULT_SCENE.interactables;

/** Everything a player bumps into, as XZ boxes: the shell, the furniture and your own models. */
export const OFFICE_COLLIDERS: Box[] = DEFAULT_SCENE.colliders;
