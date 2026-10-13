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
 * It has two parts: the shell (outer walls, the meeting room's divider and
 * door, the frames of the whiteboard and the screen), which is fixed here
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
  }: { solid?: boolean; emissive?: number; shadows?: boolean } = {},
) => {
  into.push({ size, at, color, solid, emissive, shadows });
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

// Meeting room: a divider with a door gap
const dividerLength = DEPTH / 2 - DOOR_HALF_WIDTH;
const dividerCenter = DOOR_HALF_WIDTH + dividerLength / 2;
add(
  shellPieces,
  [DIVIDER_THICKNESS, HEIGHT, dividerLength],
  [DIVIDER_X, HEIGHT / 2, -dividerCenter],
  COLORS.divider,
);
add(
  shellPieces,
  [DIVIDER_THICKNESS, HEIGHT, dividerLength],
  [DIVIDER_X, HEIGHT / 2, dividerCenter],
  COLORS.divider,
);

const { x: mx, z: mz } = MEETING_CENTER;

// The whiteboard on the east wall: a frame and a white panel
const boardX = WIDTH / 2 - WALL / 2 - 0.03;
add(shellPieces, [0.04, 1.5, 2.8], [boardX, 1.6, mz], COLORS.frame, {
  solid: false,
  shadows: false,
});
add(
  shellPieces,
  [0.05, 1.3, 2.6],
  [boardX - 0.01, 1.6, mz],
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
  x: boardX - 0.01 - 0.025 - 0.004,
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
  pieces: BoxPiece[];
  plants: PlantPiece[];
  colliders: Box[];
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
    pieces: [...shellPieces, ...furniture.flatMap(piecesOf)],
    plants: furniture
      .filter((item) => item.kind === "plant")
      .map(({ x, z }) => ({ x, z })),
    colliders: [
      ...SHELL_COLLIDERS,
      ...furniture.flatMap(furnitureColliders),
      ...models.flatMap((prop) => footprintCollider(prop) ?? []),
    ],
  };
}

/** What the walls and the divider block, with nothing inside the office. */
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

/** Everything a player bumps into, as XZ boxes: the shell, the furniture and your own models. */
export const OFFICE_COLLIDERS: Box[] = DEFAULT_SCENE.colliders;
