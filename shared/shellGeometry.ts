import type { Box } from "./collision.ts";
import { OFFICE_HEIGHT } from "./constants.ts";
import { COLORS, type BoxPiece } from "./pieces.ts";
import {
  boardLayers,
  outerWalls,
  SCREEN_FRAME_MARGIN,
  SCREEN_FRAME_THICKNESS,
  screenFrameHeight,
  screenLayers,
  BOARD_FRAME_MARGIN,
  BOARD_FRAME_THICKNESS,
  BOARD_PANEL_THICKNESS,
  type Facing,
  type Shell,
} from "./shell.ts";

const GLASS_OPACITY = 0.35;

const heightOf = (shell: Shell) => shell.height ?? OFFICE_HEIGHT;

const mm = (value: number) => Math.round(value * 1000) / 1000;

const alongX = (facing: Facing) => facing === "north" || facing === "south";

/**
 * Every box the shell is drawn with: the outer walls, the walls inside, the
 * glass, the patches of floor, and the frames and panels of the boards and
 * screens. Only solid ones block people (see `shellColliders`).
 */
export function shellPieces(shell: Shell): BoxPiece[] {
  const height = heightOf(shell);
  const pieces: BoxPiece[] = [];
  const add = (
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
    pieces.push({ size, at, color, solid, emissive, shadows, opacity });
  };

  for (const wall of [...outerWalls(shell), ...shell.walls])
    add(
      [wall.width, height, wall.depth],
      [wall.x, height / 2, wall.z],
      COLORS.wall,
    );
  for (const wall of shell.glass)
    add(
      [wall.width, height, wall.depth],
      [wall.x, height / 2, wall.z],
      COLORS.glass,
      { opacity: GLASS_OPACITY },
    );

  for (const patch of shell.floors)
    add(
      [patch.width, 0.02, patch.depth],
      [patch.x, 0.011, patch.z],
      patch.tone === "meeting" ? COLORS.meetingFloor : COLORS.loungeFloor,
      { solid: false, shadows: false },
    );

  const flat = { solid: false, shadows: false };
  for (const board of shell.boards) {
    const layers = boardLayers(board);
    const sideways = alongX(board.facing);
    const place = (layer: number): BoxPiece["at"] =>
      sideways ? [board.along, board.y, layer] : [layer, board.y, board.along];
    const size = (thickness: number, width: number, height: number) =>
      sideways
        ? ([width, height, thickness] as const)
        : ([thickness, height, width] as const);
    add(
      size(
        BOARD_FRAME_THICKNESS,
        mm(board.width + 2 * BOARD_FRAME_MARGIN),
        mm(board.height + 2 * BOARD_FRAME_MARGIN),
      ),
      place(layers.frame),
      COLORS.frame,
      flat,
    );
    add(
      size(BOARD_PANEL_THICKNESS, board.width, board.height),
      place(layers.panel),
      COLORS.whiteboard,
      flat,
    );
  }
  for (const screen of shell.screens) {
    const layers = screenLayers(screen);
    const sideways = alongX(screen.facing);
    const width = mm(screen.width + 2 * SCREEN_FRAME_MARGIN);
    add(
      sideways
        ? [width, screenFrameHeight(screen), SCREEN_FRAME_THICKNESS]
        : [SCREEN_FRAME_THICKNESS, screenFrameHeight(screen), width],
      sideways
        ? [screen.along, screen.y, layers.frame]
        : [layers.frame, screen.y, screen.along],
      COLORS.frame,
      flat,
    );
  }
  return pieces;
}

/** What the walls and the glass block, as boxes on the floor. */
export function shellColliders(shell: Shell): Box[] {
  return shellPieces(shell)
    .filter((piece) => piece.solid)
    .map((piece) => ({
      minX: piece.at[0] - piece.size[0] / 2,
      maxX: piece.at[0] + piece.size[0] / 2,
      minZ: piece.at[2] - piece.size[2] / 2,
      maxZ: piece.at[2] + piece.size[2] / 2,
    }));
}
