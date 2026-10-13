import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "./constants.ts";
import {
  footprintCollider,
  isModelFileName,
  MAX_MODELS,
  PROPS,
  sanitizeModels,
  toModelFileName,
  type PropPlacement,
} from "./props.ts";
import { SPAWN_AREA } from "./spawn.ts";

const shelf: PropPlacement = {
  model: "shelf.glb",
  at: [4, -6],
  footprint: [1.6, 0.4],
};

describe("footprintCollider", () => {
  it("centers the footprint on the placement", () => {
    expect(footprintCollider(shelf)).toEqual({
      minX: 3.2,
      maxX: 4.8,
      minZ: -6.2,
      maxZ: -5.8,
    });
  });

  it("swaps width and depth when turned a quarter turn", () => {
    const box = footprintCollider({ ...shelf, rotationDeg: 90 })!;
    expect(box.maxX - box.minX).toBeCloseTo(0.4);
    expect(box.maxZ - box.minZ).toBeCloseTo(1.6);
  });

  it("covers the whole turned rectangle at an angle (never smaller than the object)", () => {
    const box = footprintCollider({ ...shelf, rotationDeg: 45 })!;
    // A 1.6 x 0.4 rectangle turned 45 degrees spans (1.6 + 0.4) / sqrt(2) on each axis
    expect(box.maxX - box.minX).toBeCloseTo((1.6 + 0.4) / Math.SQRT2);
    expect(box.maxZ - box.minZ).toBeCloseTo((1.6 + 0.4) / Math.SQRT2);
  });

  it("treats a turn of 180 degrees like no turn", () => {
    const a = footprintCollider(shelf)!;
    const b = footprintCollider({ ...shelf, rotationDeg: 180 })!;
    expect(b.minX).toBeCloseTo(a.minX);
    expect(b.maxZ).toBeCloseTo(a.maxZ);
  });

  it("gives decorations without a footprint no collider", () => {
    expect(footprintCollider({ model: "poster.glb", at: [0, 0] })).toBeNull();
  });
});

describe("isModelFileName", () => {
  it("accepts a plain .glb name", () => {
    for (const name of [
      "a.glb",
      "my-sofa.glb",
      "Sofa_2.v3.glb",
      "9lives.glb",
    ]) {
      expect(isModelFileName(name), name).toBe(true);
    }
  });

  it("refuses folders, other kinds of file and odd names", () => {
    for (const name of [
      "../a.glb",
      "a/b.glb",
      "a\\b.glb",
      "a.gltf",
      "a.GLB",
      ".glb",
      "-a.glb",
      "a b.glb",
      "",
      "x".repeat(70) + ".glb",
    ]) {
      expect(isModelFileName(name), name).toBe(false);
    }
  });
});

describe("toModelFileName", () => {
  it("leaves a good name as it is", () => {
    expect(toModelFileName("my-sofa.glb")).toBe("my-sofa.glb");
  });

  it("turns spaces into dashes and keeps the capitals", () => {
    expect(toModelFileName("My Sofa.glb")).toBe("My-Sofa.glb");
  });

  it("writes the extension in lower case", () => {
    expect(toModelFileName("sofa.GLB")).toBe("sofa.glb");
  });

  it("keeps only the file's own name, not the folders it came from", () => {
    expect(toModelFileName("../../evil.glb")).toBe("evil.glb");
    expect(toModelFileName("C:\\Users\\me\\Downloads\\chair.glb")).toBe(
      "chair.glb",
    );
  });

  it("replaces letters that are not allowed, without leaving a mess of dashes", () => {
    expect(toModelFileName("ñandú café.glb")).toBe("and-caf.glb");
  });

  it("refuses what is not a .glb, or has no name left", () => {
    for (const name of [
      "sofa.gltf",
      "photo.png",
      "sofa",
      ".glb",
      "---.glb",
      "ñ.glb",
      "",
    ]) {
      expect(toModelFileName(name), name).toBeNull();
    }
  });

  it("refuses a name too long to be accepted rather than cutting it", () => {
    expect(toModelFileName("x".repeat(80) + ".glb")).toBeNull();
  });

  it("only ever gives a name the game accepts", () => {
    for (const name of ["a b c.glb", "Ünï.cödé.glb", "x--y__z.glb", "..glb"]) {
      const result = toModelFileName(name);
      if (result !== null) expect(isModelFileName(result), name).toBe(true);
    }
  });
});

describe("sanitizeModels", () => {
  it("keeps a well-formed placement exactly as it is", () => {
    const full: PropPlacement = {
      model: "sofa-2.glb",
      at: [1, -2],
      rotationDeg: 90,
      scale: 1.5,
      footprint: [2, 0.9],
    };
    expect(sanitizeModels([full, shelf])).toEqual([full, shelf]);
  });

  it("only takes a plain .glb file name: no folders, no other kinds of file", () => {
    const names = [
      "../secret.glb",
      "a/b.glb",
      "a\\b.glb",
      "shelf.png",
      "shelf",
      ".glb",
      "",
      "x".repeat(200) + ".glb",
      5,
    ];
    for (const model of names) {
      expect(sanitizeModels([{ ...shelf, model }]), String(model)).toEqual([]);
    }
  });

  it("drops entries without a usable position", () => {
    for (const at of [[NaN, 0], [0], "x", [1e9, 0], [0, "1"], null]) {
      expect(sanitizeModels([{ ...shelf, at }])).toEqual([]);
    }
  });

  it("ignores optional fields that make no sense, keeping the placement", () => {
    const [prop] = sanitizeModels([
      { ...shelf, rotationDeg: "left", scale: -3, footprint: [0, 1] },
    ]);
    expect(prop).toEqual({ model: "shelf.glb", at: [4, -6] });
  });

  it("drops anything extra", () => {
    const [prop] = sanitizeModels([{ ...shelf, admin: true }]);
    expect(Object.keys(prop).sort()).toEqual(["at", "footprint", "model"]);
  });

  it("returns nothing for something that is not a list, and skips what is not an entry", () => {
    expect(sanitizeModels(undefined)).toEqual([]);
    expect(sanitizeModels({})).toEqual([]);
    expect(sanitizeModels([null, 3, "x", shelf])).toEqual([shelf]);
  });

  it("drops an exact copy in the very same place, and keeps the first", () => {
    const moved: PropPlacement = { ...shelf, at: [4.5, -6] };
    expect(sanitizeModels([shelf, shelf, moved])).toEqual([shelf, moved]);
  });

  it("keeps the same model turned another way", () => {
    expect(sanitizeModels([shelf, { ...shelf, rotationDeg: 90 }])).toHaveLength(
      2,
    );
  });

  it("caps how many it takes", () => {
    const many: PropPlacement[] = Array.from(
      { length: MAX_MODELS + 20 },
      (_, i) => ({ ...shelf, at: [i % 40, Math.floor(i / 40)] }),
    );
    expect(sanitizeModels(many)).toHaveLength(MAX_MODELS);
  });
});

describe("the configured props", () => {
  it.each(PROPS)(
    "$model at $at stays inside the office and off the spawn area",
    (prop) => {
      const [x, z] = prop.at;
      expect(Math.abs(x)).toBeLessThan(OFFICE_WIDTH / 2);
      expect(Math.abs(z)).toBeLessThan(OFFICE_DEPTH / 2);

      const box = footprintCollider(prop);
      if (!box) return;
      const overlapsSpawn =
        box.maxX > SPAWN_AREA.minX - 0.4 &&
        box.minX < SPAWN_AREA.maxX + 0.4 &&
        box.maxZ > SPAWN_AREA.minZ - 0.4 &&
        box.minZ < SPAWN_AREA.maxZ + 0.4;
      expect(overlapsSpawn, "a prop blocks where players appear").toBe(false);
    },
  );
});
