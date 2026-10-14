import { describe, expect, it } from "vitest";
import {
  CATALOG,
  FURNITURE_KINDS,
  furnitureColliders,
  MAX_FURNITURE,
  piecesOf,
  sanitizeFurniture,
  type Furniture,
} from "./furniture.ts";

const at = (
  kind: Furniture["kind"],
  x: number,
  z: number,
  rotation: Furniture["rotation"] = 0,
  variant?: number,
): Furniture => ({
  kind,
  x,
  z,
  rotation,
  ...(variant === undefined ? {} : { variant }),
});

describe("the catalog", () => {
  it("describes every kind with a name people can read", () => {
    for (const kind of FURNITURE_KINDS) {
      expect(CATALOG[kind].label.trim()).not.toBe("");
    }
  });

  it("has solid pieces for things you bump into, and none for decoration", () => {
    const solid = (kind: Furniture["kind"]) =>
      piecesOf(at(kind, 0, 0)).some((p) => p.solid) ||
      furnitureColliders(at(kind, 0, 0)).length > 0;
    for (const kind of ["desk", "chair", "meeting-table", "plant"] as const)
      expect(solid(kind), kind).toBe(true);
    for (const kind of ["rug", "poster", "light"] as const)
      expect(solid(kind), kind).toBe(false);
  });

  it("gives every piece a real size", () => {
    for (const kind of FURNITURE_KINDS) {
      for (const piece of piecesOf(at(kind, 0, 0))) {
        for (const side of piece.size) expect(side).toBeGreaterThan(0);
      }
    }
  });
});

describe("piecesOf", () => {
  it("puts a desk where it was placed, with its monitor behind it", () => {
    const pieces = piecesOf(at("desk", -6, -3));
    const top = pieces.find((p) => p.solid)!;
    expect(top.at).toEqual([-6, 0.375, -3]);
    expect(top.size).toEqual([1.8, 0.75, 0.9]);
    const monitor = pieces.find((p) => !p.solid)!;
    expect(monitor.at[0]).toBeCloseTo(-6);
    expect(monitor.at[2]).toBeCloseTo(-3.2);
  });

  it("turns a quarter turn: sizes swap and what was behind moves round", () => {
    const pieces = piecesOf(at("desk", 0, 0, 90));
    const top = pieces.find((p) => p.solid)!;
    expect(top.size[0]).toBeCloseTo(0.9);
    expect(top.size[2]).toBeCloseTo(1.8);
    // The monitor was at -z (z = -0.2); a quarter turn puts it at +x or -x, never still on z
    const monitor = pieces.find((p) => !p.solid)!;
    expect(Math.abs(monitor.at[0])).toBeCloseTo(0.2);
    expect(monitor.at[2]).toBeCloseTo(0);
  });

  it("turns a half turn: a chair's back goes to the other side", () => {
    const back = (rotation: Furniture["rotation"]) =>
      piecesOf(at("chair", 0, 0, rotation)).find((p) => !p.solid)!.at[2];
    expect(back(0)).toBeCloseTo(0.21);
    expect(back(180)).toBeCloseTo(-0.21);
  });

  it("comes back to the start after four quarter turns", () => {
    const original = piecesOf(at("chair", 2, 3, 0));
    let item = at("chair", 2, 3, 0);
    for (let i = 0; i < 4; i++)
      item = {
        ...item,
        rotation: ((item.rotation + 90) % 360) as Furniture["rotation"],
      };
    const again = piecesOf(item);
    expect(
      again.map((p) => p.at.map((n) => Math.round(n * 1e6) / 1e6)),
    ).toEqual(original.map((p) => p.at.map((n) => Math.round(n * 1e6) / 1e6)));
  });

  it("keeps heights as they are when turning", () => {
    const heights = (rotation: Furniture["rotation"]) =>
      piecesOf(at("desk", 0, 0, rotation)).map((p) => [p.at[1], p.size[1]]);
    expect(heights(90)).toEqual(heights(0));
  });

  it("uses the variant to pick a poster's colour", () => {
    const colors = [0, 1, 2].map(
      (v) => piecesOf(at("poster", 0, 0, 0, v))[0].color,
    );
    expect(new Set(colors).size).toBe(3);
  });

  it("falls back to the first variant for one that does not exist", () => {
    expect(piecesOf(at("poster", 0, 0, 0, 99))[0].color).toBe(
      piecesOf(at("poster", 0, 0, 0, 0))[0].color,
    );
  });
});

describe("furnitureColliders", () => {
  it("is the footprint of the solid pieces only", () => {
    const [box] = furnitureColliders(at("desk", 1, 2));
    expect(box.minX).toBeCloseTo(0.1);
    expect(box.maxX).toBeCloseTo(1.9);
    expect(box.minZ).toBeCloseTo(1.55);
    expect(box.maxZ).toBeCloseTo(2.45);
    expect(furnitureColliders(at("rug", 0, 0))).toEqual([]);
  });

  it("swaps width and depth with a quarter turn", () => {
    const [box] = furnitureColliders(at("desk", 0, 0, 90));
    expect(box.maxX - box.minX).toBeCloseTo(0.9);
    expect(box.maxZ - box.minZ).toBeCloseTo(1.8);
  });

  it("gives a plant its own small box", () => {
    const [box] = furnitureColliders(at("plant", 3, 4));
    expect(box.maxX - box.minX).toBeCloseTo(0.5);
    expect(box.maxZ - box.minZ).toBeCloseTo(0.5);
  });
});

describe("sanitizeFurniture", () => {
  it("keeps what is valid", () => {
    const items = [
      at("desk", 1, 2),
      at("chair", 3, 4, 180),
      at("poster", 5, 6, 0, 2),
    ];
    expect(sanitizeFurniture(items)).toEqual(items);
  });

  it("drops what is not an item, instead of failing for everything", () => {
    const good = at("desk", 1, 2);
    const result = sanitizeFurniture([
      good,
      null,
      "desk",
      { kind: "spaceship", x: 0, z: 0, rotation: 0 },
      { kind: "desk", x: NaN, z: 0, rotation: 0 },
      { kind: "desk", x: 0, z: "1", rotation: 0 },
      { kind: "desk", x: 0, z: 0, rotation: 45 },
      { kind: "desk", x: 1e9, z: 0, rotation: 0 },
    ]);
    expect(result).toEqual([good]);
  });

  it("treats a missing rotation as none", () => {
    expect(sanitizeFurniture([{ kind: "desk", x: 1, z: 1 }])).toEqual([
      at("desk", 1, 1),
    ]);
  });

  it("drops a variant that is not a whole number, and anything extra", () => {
    const [item] = sanitizeFurniture([
      { kind: "poster", x: 0, z: 0, rotation: 0, variant: 1.5, admin: true },
    ]);
    expect(item).toEqual(at("poster", 0, 0));
    expect(Object.keys(item).sort()).toEqual(["kind", "rotation", "x", "z"]);
  });

  it("drops an exact copy standing in the very same place, and keeps the first", () => {
    const result = sanitizeFurniture([
      at("desk", 1, 2),
      at("desk", 1, 2),
      at("chair", 1, 2),
      at("desk", 1, 2.5),
      at("desk", 1, 2, 90),
    ]);
    expect(result).toEqual([
      at("desk", 1, 2),
      at("chair", 1, 2),
      at("desk", 1, 2.5),
      at("desk", 1, 2, 90),
    ]);
  });

  it("treats a different version of the same kind as another piece", () => {
    const result = sanitizeFurniture([
      at("poster", 0, 0, 0, 0),
      at("poster", 0, 0, 0, 1),
    ]);
    expect(result).toHaveLength(2);
  });

  it("treats no version and version 0 as the same piece", () => {
    const result = sanitizeFurniture([
      at("poster", 0, 0),
      at("poster", 0, 0, 0, 0),
    ]);
    expect(result).toHaveLength(1);
  });

  it("returns nothing for something that is not a list", () => {
    for (const raw of [undefined, null, 5, "x", {}]) {
      expect(sanitizeFurniture(raw)).toEqual([]);
    }
  });

  it("caps how many items it will take", () => {
    // Each in a place of its own: exact copies would be dropped before the cap mattered
    const many = Array.from({ length: MAX_FURNITURE + 50 }, (_, i) =>
      at("chair", i % 40, Math.floor(i / 40)),
    );
    expect(sanitizeFurniture(many)).toHaveLength(MAX_FURNITURE);
  });
});
