import { describe, expect, it } from "vitest";
import type { Box } from "./collision.ts";
import { areasOf } from "./areas.ts";
import { boardsOf } from "./boards.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import { COLORS, type BoxPiece } from "./pieces.ts";
import { screensOf } from "./screens.ts";
import { findShellProblems, sanitizeShell, shellFloorBox } from "./shell.ts";
import { shellColliders, shellPieces } from "./shellGeometry.ts";
import { zonesOf } from "./zones.ts";

/**
 * The shell as it was when it was code: every floor shared these numbers. The
 * default shell has to reproduce them, so a floor that never chose another one
 * behaves as before. These constants are copied from the old shared/layout.ts,
 * shared/zones.ts, shared/areas.ts, shared/boards.ts, shared/screens.ts and
 * shared/spawn.ts on purpose: they are the thing to be equal to.
 */
const WIDTH = 30;
const DEPTH = 20;
const HEIGHT = 3.2;
const WALL = 0.3;
const GLASS_THICKNESS = 0.15;
const GLASS_OPACITY = 0.35;
const MEETING_EAST_X = -6;
const MEETING_SOUTH_Z = -2;
const MEETING_CENTER = { x: -10.5, z: -6 };

const legacyMeetingRoom: Box = {
  minX: -WIDTH / 2 + WALL / 2,
  maxX: MEETING_EAST_X - GLASS_THICKNESS / 2,
  minZ: -DEPTH / 2 + WALL / 2,
  maxZ: MEETING_SOUTH_Z - GLASS_THICKNESS / 2,
};

function legacyPieces(): BoxPiece[] {
  const into: BoxPiece[] = [];
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
    into.push({ size, at, color, solid, emissive, shadows, opacity });
  };
  add([WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, -DEPTH / 2], COLORS.wall);
  add([WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, DEPTH / 2], COLORS.wall);
  add([WALL, HEIGHT, DEPTH], [-WIDTH / 2, HEIGHT / 2, 0], COLORS.wall);
  add([WALL, HEIGHT, DEPTH], [WIDTH / 2, HEIGHT / 2, 0], COLORS.wall);
  const glass = { opacity: GLASS_OPACITY };
  add(
    [GLASS_THICKNESS, HEIGHT, 5],
    [MEETING_EAST_X, HEIGHT / 2, -7.5],
    COLORS.glass,
    glass,
  );
  add(
    [6, HEIGHT, GLASS_THICKNESS],
    [-12, HEIGHT / 2, MEETING_SOUTH_Z],
    COLORS.glass,
    glass,
  );
  const flat = { solid: false, shadows: false };
  add([8, 0.02, 7], [-10.5, 0.011, -6], COLORS.meetingFloor, flat);
  add([8, 0.02, 6], [10.5, 0.011, 6.5], COLORS.loungeFloor, flat);
  const { x: mx, z: mz } = MEETING_CENTER;
  const boardX = -WIDTH / 2 + WALL / 2 + 0.03;
  add([0.04, 1.5, 2.8], [boardX, 1.6, mz], COLORS.frame, {
    solid: false,
    shadows: false,
  });
  add([0.05, 1.3, 2.6], [boardX + 0.01, 1.6, mz], COLORS.whiteboard, {
    solid: false,
    shadows: false,
  });
  const northWallZ = -DEPTH / 2 + WALL / 2;
  add([3.5, 2.0, 0.06], [mx, 1.8, northWallZ + 0.03], COLORS.frame, {
    solid: false,
    shadows: false,
  });
  return into;
}

const legacyBoardX = -WIDTH / 2 + WALL / 2 + 0.03;
const legacyWhiteboard = {
  x: legacyBoardX + 0.01 + 0.025 + 0.004,
  y: 1.6,
  z: MEETING_CENTER.z,
  width: 2.6,
  height: 1.3,
};
const legacyScreen = {
  x: MEETING_CENTER.x,
  y: 1.8,
  z: -DEPTH / 2 + WALL / 2 + 0.06 + 0.004,
  width: 3.3,
  height: (3.3 * 9) / 16,
};

describe("the default shell is the one that used to be code", () => {
  it("has the size every floor had", () => {
    expect(DEFAULT_SHELL.width).toBe(WIDTH);
    expect(DEFAULT_SHELL.depth).toBe(DEPTH);
    expect(shellFloorBox(DEFAULT_SHELL)).toEqual({
      minX: -WIDTH / 2 + WALL / 2,
      maxX: WIDTH / 2 - WALL / 2,
      minZ: -DEPTH / 2 + WALL / 2,
      maxZ: DEPTH / 2 - WALL / 2,
    });
  });

  it("draws the same boxes: outer walls, glass, floors, board and screen frames", () => {
    expect(shellPieces(DEFAULT_SHELL)).toEqual(legacyPieces());
  });

  it("blocks in the same places", () => {
    const expected = legacyPieces()
      .filter((piece) => piece.solid)
      .map((piece) => ({
        minX: piece.at[0] - piece.size[0] / 2,
        maxX: piece.at[0] + piece.size[0] / 2,
        minZ: piece.at[2] - piece.size[2] / 2,
        maxZ: piece.at[2] + piece.size[2] / 2,
      }));
    expect(shellColliders(DEFAULT_SHELL)).toEqual(expected);
    expect(expected).toHaveLength(6);
  });

  it("has the same private zone, with voice isolation in the meeting room only", () => {
    expect(zonesOf(DEFAULT_SHELL)).toEqual([
      { id: "meeting", label: "Meeting room", area: legacyMeetingRoom },
    ]);
  });

  it("has the same named areas, in the same order", () => {
    expect(areasOf(DEFAULT_SHELL)).toEqual([
      {
        label: "Meeting room",
        area: { minX: -15, maxX: -6, minZ: -10, maxZ: -2 },
      },
      { label: "Kitchen", area: { minX: 6, maxX: 15, minZ: -10, maxZ: -2 } },
      { label: "Lounge", area: { minX: 6, maxX: 15, minZ: 3, maxZ: 10 } },
      { label: "Reception", area: { minX: -15, maxX: -6, minZ: 3, maxZ: 10 } },
      {
        label: "Open area",
        area: { minX: -15, maxX: 15, minZ: -10, maxZ: 10 },
      },
    ]);
  });

  it("has the same whiteboard", () => {
    expect(boardsOf(DEFAULT_SHELL)).toEqual([
      {
        id: "meeting",
        zone: "meeting",
        center: {
          x: legacyWhiteboard.x,
          y: legacyWhiteboard.y,
          z: legacyWhiteboard.z,
        },
        normal: { x: 1, y: 0, z: 0 },
        right: { x: 0, y: 0, z: -1 },
        width: legacyWhiteboard.width,
        height: legacyWhiteboard.height,
      },
    ]);
  });

  it("has the same screen", () => {
    expect(screensOf(DEFAULT_SHELL)).toEqual([
      {
        id: "meeting",
        zone: "meeting",
        center: { x: legacyScreen.x, y: legacyScreen.y, z: legacyScreen.z },
        normal: { x: 0, y: 0, z: 1 },
        width: legacyScreen.width,
        height: legacyScreen.height,
      },
    ]);
  });

  it("has the same place where people appear", () => {
    expect(DEFAULT_SHELL.spawn).toEqual({
      area: { minX: -3, maxX: 3, minZ: 7.5, maxZ: 9 },
      yaw: 0,
    });
  });

  it("is a good shell, and the sanitizer leaves it as it is", () => {
    expect(findShellProblems(DEFAULT_SHELL)).toEqual([]);
    expect(sanitizeShell(DEFAULT_SHELL)).toEqual(DEFAULT_SHELL);
    expect(sanitizeShell(JSON.parse(JSON.stringify(DEFAULT_SHELL)))).toEqual(
      DEFAULT_SHELL,
    );
  });
});
