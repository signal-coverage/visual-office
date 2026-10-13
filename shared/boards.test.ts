import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT, OFFICE_WIDTH, WALL_THICKNESS } from "./constants.ts";
import {
  aimAtBoard,
  BOARD_REACH,
  BOARDS,
  boardById,
  canReachBoard,
  type Board,
} from "./boards.ts";
import { zoneById } from "./zones.ts";

const board = boardById("meeting")!;
const { center, width, height } = board;

describe("the boards", () => {
  it("each belong to a real zone, and sit inside it", () => {
    for (const b of BOARDS) {
      const zone = zoneById(b.zone);
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
      const area = zoneById(b.zone)!.area;
      expect(inFront.x).toBeGreaterThan(area.minX);
      expect(inFront.x).toBeLessThan(area.maxX);
    }
  });

  it("hang on the wall: above the floor, below the ceiling, not inside the wall", () => {
    for (const b of BOARDS) {
      expect(b.center.y - b.height / 2).toBeGreaterThan(0.3);
      expect(b.center.y + b.height / 2).toBeLessThan(OFFICE_HEIGHT);
      expect(b.center.x).toBeLessThan(OFFICE_WIDTH / 2 - WALL_THICKNESS / 2);
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
  const origin = { x: center.x - 2, y: center.y, z: center.z };
  const straight = { x: 1, y: 0, z: 0 };

  it("finds the middle of the board when looking straight at it", () => {
    const hit = aimAtBoard(board, origin, straight)!;
    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.v).toBeCloseTo(0.5);
    expect(hit.distance).toBeCloseTo(2);
  });

  it("puts a point to the right of the board on the right (u grows to the right)", () => {
    // The board's right is +z, seen from the room
    const hit = aimAtBoard(
      board,
      { ...origin, z: center.z + width / 4 },
      straight,
    )!;
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
    const hit = aimAtBoard(board, origin, { x: 2, y: 0, z: dz / 1 });
    // 2 m forward gives 1 m of travel per 1 unit, so dz*... is a quarter-board shift
    expect(hit!.u).toBeCloseTo(0.5 + dz / 1 / width);
  });

  it("does not need the direction to be normalised", () => {
    const hit = aimAtBoard(board, origin, { x: 5, y: 0, z: 0 })!;
    expect(hit.distance).toBeCloseTo(2);
  });

  it("misses when looking past the edge of the board", () => {
    expect(
      aimAtBoard(board, { ...origin, z: center.z + width / 2 + 0.1 }, straight),
    ).toBeNull();
    expect(
      aimAtBoard(
        board,
        { ...origin, y: center.y + height / 2 + 0.1 },
        straight,
      ),
    ).toBeNull();
  });

  it("misses when looking away from it", () => {
    expect(aimAtBoard(board, origin, { x: -1, y: 0, z: 0 })).toBeNull();
    expect(aimAtBoard(board, origin, { x: 0, y: 0, z: 1 })).toBeNull();
  });

  it("cannot be used from behind the board", () => {
    const behind = { x: center.x + 1, y: center.y, z: center.z };
    expect(aimAtBoard(board, behind, { x: -1, y: 0, z: 0 })).toBeNull();
  });

  it("ignores an empty direction", () => {
    expect(aimAtBoard(board, origin, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

describe("canReachBoard", () => {
  it("is true standing in front of it, at arm's length or a few steps", () => {
    expect(canReachBoard(board, center.x - 1, center.z)).toBe(true);
    expect(canReachBoard(board, center.x - BOARD_REACH + 0.1, center.z)).toBe(
      true,
    );
  });

  it("is false from across the room", () => {
    expect(canReachBoard(board, center.x - BOARD_REACH - 0.5, center.z)).toBe(
      false,
    );
  });

  it("is false from the other side of the wall", () => {
    expect(canReachBoard(board, center.x + 1, center.z)).toBe(false);
  });

  it("is false far along the wall, though close to it", () => {
    expect(
      canReachBoard(
        board,
        center.x - 1,
        center.z + width / 2 + BOARD_REACH + 1,
      ),
    ).toBe(false);
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
