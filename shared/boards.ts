import { DEFAULT_SHELL } from "./defaultShell.ts";
import { boardLayers, normalOf, rightOf, type Shell } from "./shell.ts";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * A flat surface in the world that can be drawn on. It belongs to a private
 * zone: only the people in that zone see what is on it. A board with no zone
 * belongs to the open floor: the people who are in no private zone.
 */
export interface Board {
  id: string;
  /** The zone whose people can see and draw on it; null for the people in the open floor. */
  zone: string | null;
  center: Vec3;
  /** Unit vector pointing out of the board, toward whoever is looking at it. */
  normal: Vec3;
  /** Unit vector along the board's width, to the right of whoever is looking at it. */
  right: Vec3;
  width: number;
  height: number;
}

/** The boards of a shell, each where it hangs on its wall. */
export function boardsOf(shell: Pick<Shell, "boards">): Board[] {
  return shell.boards.map((board) => {
    const normal = normalOf(board.facing);
    const right = rightOf(board.facing);
    const sideways = board.facing === "north" || board.facing === "south";
    const surface = boardLayers(board).surface;
    return {
      id: board.id,
      zone: board.zone,
      center: {
        x: sideways ? board.along : surface,
        y: board.y,
        z: sideways ? surface : board.along,
      },
      normal: { x: normal.x, y: 0, z: normal.z },
      right: { x: right.x, y: 0, z: right.z },
      width: board.width,
      height: board.height,
    };
  });
}

/** The boards of the default shell. */
export const BOARDS: readonly Board[] = boardsOf(DEFAULT_SHELL);

export function boardById(
  id: string,
  boards: readonly Board[] = BOARDS,
): Board | undefined {
  return boards.find((board) => board.id === id);
}

/** How far from a board (in meters, straight out of it) somebody can draw on it. */
export const BOARD_REACH = 3.5;
/** And how far past its sides. */
const SIDE_ALLOWANCE = 1;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Where a look ray from `origin` along `direction` lands on the board, as a
 * point on its surface (u from left to right, v from bottom to top, both 0..1)
 * and the distance to it. Null when it looks away, from behind, or past an edge.
 */
export function aimAtBoard(
  board: Board,
  origin: Vec3,
  direction: Vec3,
): { u: number; v: number; distance: number } | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!(length > 0)) return null;
  const dir = {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };

  // The ray has to be heading into the board's front face
  const approach = dot(dir, board.normal);
  if (approach >= -1e-6) return null;

  const toBoard = {
    x: board.center.x - origin.x,
    y: board.center.y - origin.y,
    z: board.center.z - origin.z,
  };
  const t = dot(toBoard, board.normal) / approach;
  if (!(t > 0)) return null;

  const local = {
    x: origin.x + dir.x * t - board.center.x,
    y: origin.y + dir.y * t - board.center.y,
    z: origin.z + dir.z * t - board.center.z,
  };
  const u = dot(local, board.right) / board.width + 0.5;
  const v = local.y / board.height + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v, distance: t };
}

/**
 * Whether somebody standing at (x, z) is close enough to draw on the board:
 * in front of it, within reach, and not far past either side.
 */
export function canReachBoard(board: Board, x: number, z: number): boolean {
  const dx = x - board.center.x;
  const dz = z - board.center.z;
  const along = dx * board.normal.x + dz * board.normal.z;
  const lateral = dx * board.right.x + dz * board.right.z;
  return (
    along >= -0.05 &&
    along <= BOARD_REACH &&
    Math.abs(lateral) <= board.width / 2 + SIDE_ALLOWANCE
  );
}
