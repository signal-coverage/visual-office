import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "./constants.ts";
import { footprintCollider, PROPS, type PropPlacement } from "./props.ts";
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
