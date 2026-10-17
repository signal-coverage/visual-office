import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT, OFFICE_WIDTH, WALL_THICKNESS } from "./constants.ts";
import {
  aimAtBoard,
  BOARD_REACH,
  BOARDS,
  boardById,
  boardsOf,
  canReachBoard,
  type Board,
} from "./boards.ts";
import { zoneById } from "./zones.ts";

const board = boardById("meeting")!;
const { center, width, height } = board;

describe("the boards", () => {
  it("each belong to a real zone, and sit inside it", () => {
    for (const b of BOARDS) {
      const zone = zoneById(b.zone ?? "");
      expect(zone).toBeDefined();
      const { area } = zone!;
      expect(b.center.x).toBeGreaterThan(area.minX);
      expect(b.center.x).toBeLessThan(area.maxX + WALL_THICKNESS);
      expect(b.center.z - b.width / 2).toBeGreaterThanOrEqual(area.minZ);
      expect(b.center.z + b.width / 2).toBeLessThanOrEqual(area.maxZ);
    }
  });

  it("face into the room, not into the wall", () => {
    for (const b of BOARDS) {
      const inFront = {
        x: b.center.x + b.normal.x,
        z: b.center.z + b.normal.z,
      };
      const area = zoneById(b.zone ?? "")!.area;
      expect(inFront.x).toBeGreaterThan(area.minX);
      expect(inFront.x).toBeLessThan(area.maxX);
    }
  });

  it("hang on the wall: above the floor, below the ceiling, not inside the wall", () => {
    for (const b of BOARDS) {
      expect(b.center.y - b.height / 2).toBeGreaterThan(0.3);
      expect(b.center.y + b.height / 2).toBeLessThan(OFFICE_HEIGHT);
      expect(Math.abs(b.center.x)).toBeLessThan(
        OFFICE_WIDTH / 2 - WALL_THICKNESS / 2 + 0.2,
      );
    }
  });

  it("have unique ids", () => {
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length);
  });

  it("have a normal and a right direction that are unit length and perpendicular", () => {
    for (const b of BOARDS) {
      const len = (v: { x: number; y: number; z: number }) =>
        Math.hypot(v.x, v.y, v.z);
      expect(len(b.normal)).toBeCloseTo(1);
      expect(len(b.right)).toBeCloseTo(1);
      expect(
        b.normal.x * b.right.x +
          b.normal.y * b.right.y +
          b.normal.z * b.right.z,
      ).toBeCloseTo(0);
    }
  });
});

describe("aimAtBoard", () => {
  // Standing 2 m in front of the board's middle, looking straight at it
  const { normal, right } = board;
  const origin = {
    x: center.x + normal.x * 2,
    y: center.y,
    z: center.z + normal.z * 2,
  };
  const straight = { x: -normal.x, y: 0, z: -normal.z };
  const shifted = (along: number) => ({
    ...origin,
    x: origin.x + right.x * along,
    z: origin.z + right.z * along,
  });

  it("finds the middle of the board when looking straight at it", () => {
    const hit = aimAtBoard(board, origin, straight)!;
    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.v).toBeCloseTo(0.5);
    expect(hit.distance).toBeCloseTo(2);
  });

  it("puts a point to the right of the board on the right (u grows to the right)", () => {
    // Seen from the room, to the right is along the board's own right
    const hit = aimAtBoard(board, shifted(width / 4), straight)!;
    expect(hit.u).toBeCloseTo(0.75);
  });

  it("puts a higher point higher up the board", () => {
    const hit = aimAtBoard(
      board,
      { ...origin, y: center.y + height / 4 },
      straight,
    )!;
    expect(hit.v).toBeCloseTo(0.75);
  });

  it("follows where the player looks, not only where they stand", () => {
    // Aiming up and to the side by an angle that lands on a known spot
    const dz = width / 4;
    const hit = aimAtBoard(board, origin, {
      x: straight.x * 2 + right.x * dz,
      y: 0,
      z: straight.z * 2 + right.z * dz,
    });
    // 2 m forward gives 1 m of travel per 1 unit, so dz*... is a quarter-board shift
    expect(hit!.u).toBeCloseTo(0.5 + dz / 1 / width);
  });

  it("does not need the direction to be normalised", () => {
    const hit = aimAtBoard(board, origin, {
      x: straight.x * 5,
      y: 0,
      z: straight.z * 5,
    })!;
    expect(hit.distance).toBeCloseTo(2);
  });

  it("misses when looking past the edge of the board", () => {
    expect(aimAtBoard(board, shifted(width / 2 + 0.1), straight)).toBeNull();
    expect(
      aimAtBoard(
        board,
        { ...origin, y: center.y + height / 2 + 0.1 },
        straight,
      ),
    ).toBeNull();
  });

  it("misses when looking away from it", () => {
    expect(aimAtBoard(board, origin, normal)).toBeNull();
    expect(aimAtBoard(board, origin, right)).toBeNull();
  });

  it("cannot be used from behind the board", () => {
    const behind = {
      x: center.x - normal.x,
      y: center.y,
      z: center.z - normal.z,
    };
    expect(aimAtBoard(board, behind, normal)).toBeNull();
  });

  it("ignores an empty direction", () => {
    expect(aimAtBoard(board, origin, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

describe("canReachBoard", () => {
  const { normal, right } = board;
  const at = (out: number, along = 0) =>
    [
      center.x + normal.x * out + right.x * along,
      center.z + normal.z * out + right.z * along,
    ] as const;

  it("is true standing in front of it, at arm's length or a few steps", () => {
    expect(canReachBoard(board, ...at(1))).toBe(true);
    expect(canReachBoard(board, ...at(BOARD_REACH - 0.1))).toBe(true);
  });

  it("is false from across the room", () => {
    expect(canReachBoard(board, ...at(BOARD_REACH + 0.5))).toBe(false);
  });

  it("is false from the other side of the wall", () => {
    expect(canReachBoard(board, ...at(-1))).toBe(false);
  });

  it("is false far along the wall, though close to it", () => {
    expect(canReachBoard(board, ...at(1, width / 2 + BOARD_REACH + 1))).toBe(
      false,
    );
  });
});

describe("a made-up board", () => {
  // The maths must not depend on this particular wall
  const other: Board = {
    id: "other",
    zone: "meeting",
    center: { x: 0, y: 1.5, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    right: { x: -1, y: 0, z: 0 },
    width: 2,
    height: 1,
  };

  it("works for a board on another wall", () => {
    const hit = aimAtBoard(
      other,
      { x: 0.5, y: 1.5, z: 2 },
      { x: 0, y: 0, z: -1 },
    )!;
    // Looking at -z from +z: this board's right is -x, so x = 0.5 is to its left
    expect(hit.u).toBeCloseTo(0.5 - 0.5 / 2);
    expect(hit.distance).toBeCloseTo(2);
  });
});

describe("boards of another shell", () => {
  const sides = {
    east: { normal: { x: 1, y: 0, z: 0 }, right: { x: 0, y: 0, z: -1 } },
    west: { normal: { x: -1, y: 0, z: 0 }, right: { x: 0, y: 0, z: 1 } },
    south: { normal: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 } },
    north: { normal: { x: 0, y: 0, z: -1 }, right: { x: -1, y: 0, z: 0 } },
  } as const;

  it.each(["east", "west", "south", "north"] as const)(
    "turns the board that faces %s to look out of its wall, with its right hand to the right of whoever looks at it",
    (facing) => {
      const [board] = boardsOf({
        boards: [
          {
            id: "b",
            zone: "z",
            facing,
            face: 5,
            along: 2,
            y: 1.5,
            width: 2,
            height: 1,
          },
        ],
      });
      expect(board.normal).toEqual(sides[facing].normal);
      expect(board.right).toEqual(sides[facing].right);
      // Somebody who looks at it, from in front, aims at its middle
      const eye = {
        x: board.center.x + board.normal.x * 2,
        y: 1.5,
        z: board.center.z + board.normal.z * 2,
      };
      const hit = aimAtBoard(board, eye, {
        x: -board.normal.x,
        y: 0,
        z: -board.normal.z,
      })!;
      expect(hit.u).toBeCloseTo(0.5);
      expect(hit.v).toBeCloseTo(0.5);
      expect(canReachBoard(board, eye.x, eye.z)).toBe(true);
    },
  );

  it("looks a board up among the boards it is given", () => {
    const boards = boardsOf({
      boards: [
        {
          id: "mine",
          zone: "z",
          facing: "east",
          face: 0,
          along: 0,
          y: 1.5,
          width: 2,
          height: 1,
        },
      ],
    });
    expect(boardById("mine", boards)?.zone).toBe("z");
    expect(boardById("meeting", boards)).toBeUndefined();
  });
});
