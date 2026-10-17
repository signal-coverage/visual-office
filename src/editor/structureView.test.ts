import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL } from "../../shared/defaultShell.ts";
import {
  boundsOf,
  describeRef,
  facingOfYaw,
  mountSegment,
  YAW_CHOICES,
  yawVector,
} from "./structureView";

describe("yawVector", () => {
  it("looks north at 0, west a quarter turn on, south at a half and east at three quarters", () => {
    expect(yawVector(0)).toEqual({ x: 0, z: -1 });
    expect(yawVector(Math.PI / 2).x).toBeCloseTo(-1);
    expect(yawVector(Math.PI / 2).z).toBeCloseTo(0);
    expect(yawVector(Math.PI)).toMatchObject({ z: expect.closeTo(1) });
    expect(yawVector(-Math.PI / 2).x).toBeCloseTo(1);
  });

  it("is a unit vector, and never negative zero", () => {
    const v = yawVector(0);
    expect(Object.is(v.x, -0)).toBe(false);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
});

describe("facingOfYaw", () => {
  it("names the four ways", () => {
    for (const choice of YAW_CHOICES)
      expect(facingOfYaw(choice.yaw)).toBe(choice.label);
  });

  it("names the nearest way for a turn that is not a quarter", () => {
    expect(facingOfYaw(0.1)).toBe("North");
    expect(facingOfYaw(Math.PI * 2)).toBe("North");
    expect(facingOfYaw((3 * Math.PI) / 2)).toBe("East");
  });
});

describe("mountSegment", () => {
  it("runs along the wall at the face, and points out of it", () => {
    const board = DEFAULT_SHELL.boards[0];
    const { a, b, out } = mountSegment(board);
    expect(a[0]).toBeCloseTo(-14.85);
    expect(b[0]).toBeCloseTo(-14.85);
    expect(Math.abs(b[1] - a[1])).toBeCloseTo(board.width);
    expect(out).toEqual([1, 0]);
  });

  it("goes across x for a board facing north or south", () => {
    const screen = DEFAULT_SHELL.screens[0];
    const { a, b, out } = mountSegment(screen);
    expect(a[1]).toBeCloseTo(-9.85);
    expect(Math.abs(b[0] - a[0])).toBeCloseTo(screen.width);
    expect(out).toEqual([0, 1]);
  });
});

describe("boundsOf", () => {
  it("is the box of a wall, a zone and the spawn area", () => {
    expect(boundsOf(DEFAULT_SHELL, { kind: "glass", index: 0 })).toEqual({
      minX: -6.075,
      maxX: -5.925,
      minZ: -10,
      maxZ: -5,
    });
    expect(boundsOf(DEFAULT_SHELL, { kind: "zone", index: 0 })).toEqual(
      DEFAULT_SHELL.zones[0].rect,
    );
    expect(boundsOf(DEFAULT_SHELL, { kind: "spawn", index: 0 })).toEqual(
      DEFAULT_SHELL.spawn.area,
    );
  });

  it("is a box around a board that is big enough to see", () => {
    const box = boundsOf(DEFAULT_SHELL, { kind: "board", index: 0 })!;
    expect(box.maxZ - box.minZ).toBeGreaterThan(2.6);
    expect(box.maxX - box.minX).toBeGreaterThan(0.2);
  });

  it("is null for a part that is not there", () => {
    expect(boundsOf(DEFAULT_SHELL, { kind: "wall", index: 3 })).toBeNull();
  });
});

describe("describeRef", () => {
  it("says what a part is in words", () => {
    expect(describeRef(DEFAULT_SHELL, { kind: "glass", index: 1 })).toBe(
      "Glass wall 2",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "zone", index: 0 })).toBe(
      "Private zone: Meeting room",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "area", index: 1 })).toBe(
      "Area: Kitchen",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "floor", index: 0 })).toBe(
      "Floor patch 1",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "board", index: 0 })).toBe(
      "Whiteboard of Meeting room",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "screen", index: 0 })).toBe(
      "Screen of Meeting room",
    );
    expect(describeRef(DEFAULT_SHELL, { kind: "spawn", index: 0 })).toBe(
      "Where people appear",
    );
  });

  it("says a board of the open floor is", () => {
    const shell = {
      ...DEFAULT_SHELL,
      boards: [{ ...DEFAULT_SHELL.boards[0], zone: null }],
    };
    expect(describeRef(shell, { kind: "board", index: 0 })).toBe(
      "Whiteboard of the open floor",
    );
  });
});
