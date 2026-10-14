import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT } from "../../shared/constants.ts";
import {
  CATALOG,
  FURNITURE_KINDS,
  furnitureExtent,
  type Furniture,
  type FurnitureKind,
  type Rotation,
} from "../../shared/furniture.ts";
import { sceneFor } from "../../shared/layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../../shared/officeData.ts";
import { SEAT_HEIGHT } from "../../shared/seats.ts";
import {
  boundsOf,
  DETAIL_LEVELS,
  lookOf,
  partTriangles,
  placedBounds,
  triangleCount,
  TRIANGLE_BUDGET,
  type Bounds,
} from "./furnitureLook";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const VARIANTS = [0, 1, 2];
/** How far a drawn part may leave the box the kind blocks (leaves, a lip). */
const TOLERANCE = 0.06;
const TOUCH = 0.006;
/** Hung on a wall, which holds it: the floor and the ceiling do not. */
const ON_THE_WALL: FurnitureKind[] = ["poster"];

const item = (
  kind: FurnitureKind,
  rotation: Rotation = 0,
  variant = 0,
): Furniture => ({ kind, x: 0, z: 0, rotation, variant });

function footprint(kind: FurnitureKind) {
  const boxes = furnitureExtent(item(kind));
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}

const touching = (a: Bounds, b: Bounds) =>
  [0, 1, 2].every(
    (axis) =>
      a.min[axis] <= b.max[axis] + TOUCH && b.min[axis] <= a.max[axis] + TOUCH,
  );

describe("lookOf", () => {
  it("draws every kind", () => {
    for (const kind of FURNITURE_KINDS)
      expect(lookOf(kind, 0, "high").length, kind).toBeGreaterThan(0);
  });

  it("keeps every part inside the box the kind blocks, in every variant, level and turn", () => {
    for (const kind of FURNITURE_KINDS)
      for (const variant of VARIANTS)
        for (const level of DETAIL_LEVELS)
          for (const rotation of ROTATIONS) {
            const turned = item(kind, rotation, variant);
            const area = furnitureExtent(turned).reduce((acc, b) => ({
              minX: Math.min(acc.minX, b.minX),
              maxX: Math.max(acc.maxX, b.maxX),
              minZ: Math.min(acc.minZ, b.minZ),
              maxZ: Math.max(acc.maxZ, b.maxZ),
            }));
            for (const part of lookOf(kind, variant, level)) {
              const b = placedBounds(part, turned);
              const where = `${kind} v${variant} ${level} ${rotation}`;
              expect(b.min[0], where).toBeGreaterThanOrEqual(
                area.minX - TOLERANCE,
              );
              expect(b.max[0], where).toBeLessThanOrEqual(
                area.maxX + TOLERANCE,
              );
              expect(b.min[2], where).toBeGreaterThanOrEqual(
                area.minZ - TOLERANCE,
              );
              expect(b.max[2], where).toBeLessThanOrEqual(
                area.maxZ + TOLERANCE,
              );
            }
          }
  });

  it("turns with the placement: a part keeps its place relative to the middle of the piece", () => {
    const part = lookOf("desk", 0, "high").find((p) => p.role === "screen")!;
    const local = boundsOf(part);
    const quarter = placedBounds(part, { ...item("desk", 90), x: 2, z: 3 });
    // A quarter turn: what was toward +z now looks toward +x
    expect((quarter.min[0] + quarter.max[0]) / 2 - 2).toBeCloseTo(
      (local.min[2] + local.max[2]) / 2,
    );
    expect((quarter.min[2] + quarter.max[2]) / 2 - 3).toBeCloseTo(
      -(local.min[0] + local.max[0]) / 2,
    );
  });

  it("does not leave parts floating: each one touches the floor, the ceiling or a part that does", () => {
    for (const kind of FURNITURE_KINDS.filter((k) => !ON_THE_WALL.includes(k)))
      for (const variant of VARIANTS)
        for (const level of DETAIL_LEVELS) {
          const bounds = lookOf(kind, variant, level).map(boundsOf);
          const held = bounds.map(
            (b) => b.min[1] <= TOUCH || b.max[1] >= OFFICE_HEIGHT - TOUCH,
          );
          let changed = true;
          while (changed) {
            changed = false;
            bounds.forEach((b, i) => {
              if (held[i]) return;
              if (bounds.some((other, j) => held[j] && touching(b, other))) {
                held[i] = true;
                changed = true;
              }
            });
          }
          expect(held.every(Boolean), `${kind} v${variant} ${level}`).toBe(
            true,
          );
        }
  });

  it("puts the top of a chair's seat where the seated pose rests the hips", () => {
    for (const level of DETAIL_LEVELS) {
      const seats = lookOf("chair", 0, level).filter((p) => p.role === "seat");
      expect(seats.length).toBeGreaterThan(0);
      const top = Math.max(...seats.map((p) => boundsOf(p).max[1]));
      expect(top).toBeCloseTo(SEAT_HEIGHT, 3);
    }
  });

  it("puts the back of a chair toward +z, where it sat before", () => {
    const parts = lookOf("chair", 0, "high");
    const back = parts.find((p) => p.role === "back")!;
    const seat = parts.find((p) => p.role === "seat")!;
    expect(boundsOf(back).max[2]).toBeGreaterThan(boundsOf(seat).max[2] - 0.05);
    expect(boundsOf(back).max[1]).toBeGreaterThan(SEAT_HEIGHT + 0.3);
  });

  it("turns the screen of a desk to the side where its chair stands", () => {
    const scene = sceneFor({
      furniture: OFFICE_FURNITURE,
      models: OFFICE_MODELS,
    });
    const desks = scene.furniture.filter((f) => f.kind === "desk");
    const seats = scene.interactables.filter(
      (i) => i.seat?.atDesk && i.kind === "sit",
    );
    let checked = 0;
    for (const desk of desks) {
      const screen = lookOf("desk", 0, "high").find(
        (p) => p.role === "screen",
      )!;
      const b = placedBounds(screen, desk);
      // The thin side of the screen is its depth: the normal is the way it looks
      const centerZ = (b.min[2] + b.max[2]) / 2;
      const centerX = (b.min[0] + b.max[0]) / 2;
      const normal = (() => {
        const turn = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] }[
          desk.rotation
        ];
        return { x: turn[0], z: turn[1] };
      })();
      const chair = seats
        .filter(
          (s) => Math.hypot(s.anchor.x - desk.x, s.anchor.z - desk.z) < 1.3,
        )
        .sort(
          (a, c) =>
            Math.hypot(a.anchor.x - desk.x, a.anchor.z - desk.z) -
            Math.hypot(c.anchor.x - desk.x, c.anchor.z - desk.z),
        )[0];
      if (!chair) continue;
      const toChair = {
        x: chair.anchor.x - centerX,
        z: chair.anchor.z - centerZ,
      };
      expect(toChair.x * normal.x + toChair.z * normal.z).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("lets a part glow only when it is a screen or a light", () => {
    for (const kind of FURNITURE_KINDS)
      for (const part of lookOf(kind, 0, "high")) {
        if (part.surface !== "solid")
          expect(["screen", "light"]).toContain(part.surface);
      }
    expect(lookOf("light", 0, "high").some((p) => p.surface === "light")).toBe(
      true,
    );
  });

  it("gives the three plants in the table three different looks", () => {
    const shapes = VARIANTS.map((v) =>
      JSON.stringify(lookOf("plant", v, "high")),
    );
    expect(new Set(shapes).size).toBe(3);
    expect(lookOf("plant", 99, "high")).toEqual(lookOf("plant", 0, "high"));
  });

  it("gives the three posters three colours", () => {
    const colours = VARIANTS.map(
      (v) => lookOf("poster", v, "high").find((p) => p.role === "art")!.color,
    );
    expect(new Set(colours).size).toBe(3);
  });

  it("drops the small details on low and keeps the rest", () => {
    for (const kind of ["desk", "chair", "counter", "plant", "sofa"] as const) {
      const high = lookOf(kind, 0, "high");
      const low = lookOf(kind, 0, "low");
      expect(low.length, kind).toBeLessThan(high.length);
      expect(triangleCount(low), kind).toBeLessThan(triangleCount(high));
      expect(low.length, kind).toBeGreaterThan(high.length / 4);
    }
  });

  it("stays inside the triangle budget of every kind, variant and level", () => {
    for (const kind of FURNITURE_KINDS)
      for (const variant of VARIANTS)
        for (const level of DETAIL_LEVELS)
          expect(
            triangleCount(lookOf(kind, variant, level)),
            `${kind} v${variant} ${level}`,
          ).toBeLessThanOrEqual(TRIANGLE_BUDGET[kind][level]);
  });
});

describe("partTriangles", () => {
  it("counts twelve for a box and the sides and caps of a cylinder", () => {
    const box = lookOf("desk", 0, "high").find((p) => p.shape === "box")!;
    expect(partTriangles(box)).toBe(12);
    const pot = lookOf("plant", 0, "high").find((p) => p.shape === "cylinder")!;
    expect(partTriangles(pot)).toBeGreaterThan(12);
  });
});

describe("the catalog", () => {
  it("still blocks what it blocked: the look never changes the footprint", () => {
    expect(footprint("desk")).toEqual({
      minX: -0.9,
      maxX: 0.9,
      minZ: -0.45,
      maxZ: 0.45,
    });
    expect(CATALOG.chair.pieces()[0].size).toEqual([0.5, 0.45, 0.5]);
  });
});
