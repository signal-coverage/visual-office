import type { Area } from "./areas.ts";
import { areasOf } from "./areas.ts";
import { boardsOf, type Board } from "./boards.ts";
import type { Box } from "./collision.ts";
import {
  furnitureColliders,
  piecesOf,
  sanitizeFurniture,
  type Furniture,
} from "./furniture.ts";
import { DEFAULT_SHELL, shellOrDefault } from "./defaultShell.ts";
import { interactablesOf, type Interactable } from "./interactions.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { COLORS, type BoxPiece } from "./pieces.ts";
import {
  footprintCollider,
  sanitizeModels,
  type PropPlacement,
} from "./props.ts";
import { screensOf, type Screen } from "./screens.ts";
import { shellFloorBox, type Shell, type ShellSpawn } from "./shell.ts";
import { shellColliders, shellPieces } from "./shellGeometry.ts";
import { zonesOf, type Zone } from "./zones.ts";

/**
 * A floor as plain data. The client draws it and the server uses the same
 * pieces for collisions, so what you can walk through is decided in one place.
 *
 * It has two parts: the shell (outer walls, the glass of a private room, its
 * whiteboard and screen, the places that have a floor of their own), which is
 * data of the floor (shell.ts; the default shell is the one every floor had
 * when it was code), and everything that stands inside (officeData.ts for the
 * default floor), which the office editor moves around.
 * (When the office becomes a modelled GLB, only the drawing changes: this file
 * keeps describing where players can and cannot stand.)
 */

export type { BoxPiece };
export { COLORS };

export interface PlantPiece {
  x: number;
  z: number;
}

/** What stands inside the default shell, from officeData.ts; anything malformed there is left out. */
export const FURNITURE = sanitizeFurniture(OFFICE_FURNITURE);

/**
 * What stands in a floor: the furniture and the models of your own, and the
 * shell around them. A layout without a shell has the default one.
 */
export interface Layout {
  furniture: Furniture[];
  models: PropPlacement[];
  shell?: Shell;
}

/** A layout turned into what is drawn and what blocks people. */
export interface FloorScene {
  /** The furniture that is left once the malformed entries are out. */
  furniture: Furniture[];
  models: PropPlacement[];
  /** The shell of the floor, as data: walls, zones, areas, boards, screens and where people appear. */
  shell: Shell;
  /** The shell alone, drawn: walls, glass, room floors and the frames of the boards. */
  shellPieces: BoxPiece[];
  pieces: BoxPiece[];
  plants: PlantPiece[];
  colliders: Box[];
  /** What can be used: seats, desks, shelves, plants. */
  interactables: Interactable[];
  /** The floor inside the outer walls: furniture and people stay within it. */
  floor: Box;
  /** The private zones, each with its own voice room. */
  zones: Zone[];
  /** The named parts, only so people can say where they are. */
  areas: Area[];
  boards: Board[];
  screens: Screen[];
  spawn: ShellSpawn;
}

/**
 * Everything the client draws and the server collides with, for any layout:
 * its shell plus what the layout holds. Anything malformed is left out, so a
 * bad stored layout cannot break a floor.
 */
export function sceneFor(layout: Layout): FloorScene {
  const furniture = sanitizeFurniture(layout.furniture);
  const models = sanitizeModels(layout.models);
  const shell = shellOrDefault(layout.shell);
  const drawn = shellPieces(shell);
  return {
    furniture,
    models,
    shell,
    shellPieces: drawn,
    pieces: [...drawn, ...furniture.flatMap(piecesOf)],
    plants: furniture
      .filter((item) => item.kind === "plant")
      .map(({ x, z }) => ({ x, z })),
    colliders: [
      ...shellColliders(shell),
      ...furniture.flatMap(furnitureColliders),
      ...models.flatMap((prop) => footprintCollider(prop) ?? []),
    ],
    interactables: interactablesOf({ furniture, models }),
    floor: shellFloorBox(shell),
    zones: zonesOf(shell),
    areas: areasOf(shell),
    boards: boardsOf(shell),
    screens: screensOf(shell),
    spawn: shell.spawn,
  };
}

/*
 * The default shell and the default layout, as constants: what a floor has
 * when it never chose another, and what the tests and the editor's file
 * (officeData.ts) are about.
 */

/** The floor of the default shell, inside its outer walls: the furniture has to stay within it. */
export const OFFICE_FLOOR: Box = shellFloorBox(DEFAULT_SHELL);

/** What the walls and the glass of the default shell block, with nothing inside the office. */
export const SHELL_COLLIDERS: Box[] = shellColliders(DEFAULT_SHELL);

/** The floor of the default shell's meeting room: inside its glass walls and the outer walls. */
export const MEETING_ROOM: Box = zonesOf(DEFAULT_SHELL)[0].area;

const DEFAULT_SCENE = sceneFor({
  furniture: OFFICE_FURNITURE,
  models: OFFICE_MODELS,
});

export const BOX_PIECES: BoxPiece[] = DEFAULT_SCENE.pieces;
export const PLANTS: PlantPiece[] = DEFAULT_SCENE.plants;

/** The picture area of the default shell's screen: a 16:9 plane just in front of its frame. */
export const MEETING_SCREEN = {
  x: DEFAULT_SCENE.screens[0].center.x,
  y: DEFAULT_SCENE.screens[0].center.y,
  z: DEFAULT_SCENE.screens[0].center.z,
  width: DEFAULT_SCENE.screens[0].width,
  height: DEFAULT_SCENE.screens[0].height,
};

/** The part of the default shell's whiteboard that can be drawn on. */
export const WHITEBOARD = {
  x: DEFAULT_SCENE.boards[0].center.x,
  y: DEFAULT_SCENE.boards[0].center.y,
  z: DEFAULT_SCENE.boards[0].center.z,
  width: DEFAULT_SCENE.boards[0].width,
  height: DEFAULT_SCENE.boards[0].height,
};

/** What can be used in the default layout. */
export const OFFICE_INTERACTABLES: Interactable[] = DEFAULT_SCENE.interactables;

/** Everything a player bumps into, as XZ boxes: the shell, the furniture and your own models. */
export const OFFICE_COLLIDERS: Box[] = DEFAULT_SCENE.colliders;
