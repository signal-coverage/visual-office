import { describe, expect, it } from "vitest";
import type { Box } from "./collision.ts";
import type { Furniture } from "./furniture.ts";
import {
  aimedInteractable,
  hintFor,
  interactablesOf,
  INTERACT_RANGE,
  panelFor,
  panelUsesMouse,
  PLANT_INFO,
  type Interactable,
} from "./interactions.ts";
import type { PropPlacement } from "./props.ts";

const item = (
  kind: Furniture["kind"],
  x: number,
  z: number,
  rotation: Furniture["rotation"] = 0,
  variant?: number,
): Furniture => ({ kind, x, z, rotation, ...(variant ? { variant } : {}) });

const shelf = (over: Partial<PropPlacement> = {}): PropPlacement => ({
  model: "bookshelf.glb",
  at: [0, -9.6],
  footprint: [1.6, 0.4],
  ...over,
});

const only = (furniture: Furniture[], models: PropPlacement[] = []) =>
  interactablesOf({ furniture, models });

describe("interactablesOf", () => {
  it("maps chairs, desks and plants, and leaves the rest alone", () => {
    const found = only([
      item("desk", 0, 0),
      item("chair", 0, 1),
      item("poster", 3, 3),
      item("plant", 5, 5),
      item("light", 0, 0),
      item("sofa", 8, 8),
    ]);
    expect(found.map(({ id, kind }) => [id, kind])).toEqual([
      ["desk:0", "computer"],
      ["chair:1", "sit"],
      ["plant:3", "inspect"],
    ]);
  });

  it("derives the same ids from the same layout, however many times it is asked", () => {
    const furniture = [item("chair", 1, 2), item("desk", 3, 4)];
    expect(only(furniture)).toEqual(only(structuredClone(furniture)));
  });

  it("numbers by position in the list, counting what cannot be used", () => {
    const found = only([item("rug", 0, 0), item("chair", 0, 0)]);
    expect(found.map(({ id }) => id)).toEqual(["chair:1"]);
  });

  it("makes a bookshelf model something to read, with the file in its id", () => {
    const found = only([item("chair", 0, 0)], [shelf()]);
    expect(found.map(({ id, kind }) => [id, kind])).toEqual([
      ["chair:0", "sit"],
      ["bookshelf.glb:0", "book"],
    ]);
  });

  it("leaves out models that are not known and models with nothing to aim at", () => {
    expect(only([], [shelf({ model: "plant-big.glb" })])).toEqual([]);
    expect(only([], [shelf({ footprint: undefined })])).toEqual([]);
  });

  it("keeps the shelf's own index among the models", () => {
    const found = only(
      [],
      [{ model: "rug.glb", at: [0, 0] }, shelf({ at: [5, 5] })],
    );
    expect(found.map(({ id }) => id)).toEqual(["bookshelf.glb:1"]);
  });
});

describe("seats", () => {
  const seatOf = (rotation: Furniture["rotation"]) =>
    only([item("chair", 1, 2, rotation)])[0].seat!;

  it("sits at the middle of the chair, whatever turn it has", () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const { x, z } = seatOf(rotation);
      expect(x).toBe(1);
      expect(z).toBe(2);
    }
  });

  it("faces away from the backrest: toward -z at 0 degrees", () => {
    expect(seatOf(0).yaw).toBeCloseTo(0);
    expect(seatOf(90).yaw).toBeCloseTo(Math.PI / 2);
    expect(seatOf(180).yaw).toBeCloseTo(Math.PI);
    expect(seatOf(270).yaw).toBeCloseTo((3 * Math.PI) / 2);
  });

  it("looks where the camera looks: forward is (-sin yaw, -cos yaw), away from the backrest", () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const { yaw } = seatOf(rotation);
      const radians = (rotation * Math.PI) / 180;
      // The backrest stands at +z of the chair, turned like the chair
      const back = { x: Math.sin(radians), z: Math.cos(radians) };
      expect(-Math.sin(yaw)).toBeCloseTo(-back.x);
      expect(-Math.cos(yaw)).toBeCloseTo(-back.z);
    }
  });

  it("knows when it sits at a table or a desk", () => {
    const withDesk = only([item("desk", 0, -6), item("chair", 0, -5.05)]);
    expect(withDesk[1].seat?.atDesk).toBe(true);
    const turned = only([
      item("conference-table", -10.5, -6),
      item("chair", -10.5, -7.1, 180),
      item("chair", -10.5, -4.9, 0),
    ]);
    expect(turned[0].seat?.atDesk).toBe(true);
    expect(turned[1].seat?.atDesk).toBe(true);
  });

  it("does not sit at a desk when it is only beside it or has its back to it", () => {
    expect(only([item("chair", 0, 0)])[0].seat?.atDesk).toBe(false);
    const away = only([item("desk", 0, -6), item("chair", 0, -5.05, 180)]);
    expect(away[1].seat?.atDesk).toBe(false);
  });

  it("only chairs have a seat", () => {
    const found = only([item("desk", 0, 0), item("plant", 4, 4)]);
    expect(found.every((entry) => entry.seat === undefined)).toBe(true);
  });
});

describe("anchors", () => {
  it("puts a chair's anchor on its seat", () => {
    const [chair] = only([item("chair", 1, 2, 90)]);
    expect(chair.anchor).toEqual({
      x: 1,
      z: 2,
      yaw: chair.seat!.yaw,
    });
  });

  it("stands in front of a desk: on the chair side, facing it", () => {
    const [desk] = only([item("desk", 0, 0)]);
    expect(desk.anchor.x).toBeCloseTo(0);
    expect(desk.anchor.z).toBeGreaterThan(0.9);
    expect(desk.anchor.yaw).toBeCloseTo(0);
  });

  it("turns the standing spot with the piece", () => {
    const [east] = only([item("desk", 0, 0, 90)]);
    expect(east.anchor.x).toBeGreaterThan(0.9);
    expect(east.anchor.z).toBeCloseTo(0);
    expect(east.anchor.yaw).toBeCloseTo(Math.PI / 2);
    const [south] = only([item("desk", 0, 0, 180)]);
    expect(south.anchor.z).toBeLessThan(-0.9);
    expect(south.anchor.yaw).toBeCloseTo(Math.PI);
  });

  it("stands in front of a plant at arm's length", () => {
    const [plant] = only([item("plant", 4, 4)]);
    expect(Math.hypot(plant.anchor.x - 4, plant.anchor.z - 4)).toBeCloseTo(0.9);
  });

  it("stands in front of a shelf, which faces +z at 0 degrees, and follows its turn", () => {
    const [flat] = only([], [shelf()]);
    expect(flat.anchor.x).toBeCloseTo(0);
    expect(flat.anchor.z).toBeCloseTo(-9.6 + 0.2 + 0.65);
    expect(flat.anchor.yaw).toBeCloseTo(0);
    const [turned] = only([], [shelf({ rotationDeg: 90 })]);
    expect(turned.anchor.x).toBeCloseTo(0.85);
    expect(turned.anchor.z).toBeCloseTo(-9.6);
    expect(turned.anchor.yaw).toBeCloseTo(Math.PI / 2);
  });
});

describe("boxes", () => {
  it("covers a chair with its backrest, turned with it", () => {
    const [flat] = only([item("chair", 0, 0)]);
    expect(flat.box.minX).toBeCloseTo(-0.25);
    expect(flat.box.maxZ).toBeCloseTo(0.25);
    expect(flat.box.maxY).toBeCloseTo(0.95);
    const [turned] = only([item("desk", 0, 0, 90)]);
    expect(turned.box.maxX - turned.box.minX).toBeCloseTo(0.9);
    expect(turned.box.maxZ - turned.box.minZ).toBeCloseTo(1.8);
  });

  it("gives a plant, which has no boxes of its own, the height of its leaves", () => {
    const [plant] = only([item("plant", 2, 3)]);
    expect(plant.box).toMatchObject({ minX: 1.75, maxX: 2.25, minY: 0 });
    expect(plant.box.maxY).toBeGreaterThan(1);
  });

  it("covers the footprint of a shelf", () => {
    const [found] = only([], [shelf()]);
    expect(found.box.minX).toBeCloseTo(-0.8);
    expect(found.box.maxX).toBeCloseTo(0.8);
    expect(found.box.maxY).toBeGreaterThan(1.5);
  });
});

describe("aimedInteractable", () => {
  const low = { x: 0, y: 0.8, z: 0 };
  const head = { x: 0, y: 1.65, z: 0 };
  const forward = { x: 0, y: 0, z: -1 };
  const chairAhead = only([item("chair", 0, -2)]);

  it("finds what is in front of the eyes, with how far it is", () => {
    const aim = aimedInteractable(chairAhead, low, forward, []);
    expect(aim?.interactable.id).toBe("chair:0");
    expect(aim?.distance).toBeGreaterThan(1.6);
    expect(aim?.distance).toBeLessThan(2);
  });

  it("looks down onto a chair that is below the eyes", () => {
    const down = { x: 0, y: -0.55, z: -0.83 };
    expect(aimedInteractable(chairAhead, head, down, [])).not.toBeNull();
  });

  it("finds nothing when looking elsewhere or over it", () => {
    expect(
      aimedInteractable(chairAhead, low, { x: 1, y: 0, z: 0 }, []),
    ).toBeNull();
    expect(aimedInteractable(chairAhead, head, forward, [])).toBeNull();
  });

  it("does not reach past the range", () => {
    const far = only([item("plant", 0, -(INTERACT_RANGE + 1))]);
    expect(aimedInteractable(far, low, forward, [])).toBeNull();
    const near = only([item("plant", 0, -(INTERACT_RANGE - 0.5))]);
    expect(aimedInteractable(near, low, forward, [])?.interactable.kind).toBe(
      "inspect",
    );
  });

  it("does not look behind", () => {
    expect(
      aimedInteractable(chairAhead, low, { x: 0, y: 0, z: 1 }, []),
    ).toBeNull();
  });

  it("does not look at a zero direction", () => {
    expect(
      aimedInteractable(chairAhead, low, { x: 0, y: 0, z: 0 }, []),
    ).toBeNull();
  });

  it("takes the nearest when two are in line", () => {
    const line = only([item("plant", 0, -2), item("plant", 0, -1)]);
    expect(aimedInteractable(line, low, forward, [])?.interactable.id).toBe(
      "plant:1",
    );
  });

  it("is not fooled through a wall, but is by the own collider of the thing", () => {
    const wall: Box = { minX: -2, maxX: 2, minZ: -1.2, maxZ: -1 };
    expect(aimedInteractable(chairAhead, low, forward, [wall])).toBeNull();
    const own: Box = { minX: -0.25, maxX: 0.25, minZ: -2.25, maxZ: -1.75 };
    expect(aimedInteractable(chairAhead, low, forward, [own])).not.toBeNull();
  });

  it("is a bit forgiving at the edge of a small thing", () => {
    // The chair is 0.5 wide: at its front this ray is 0.3 m to the side, 5 cm off it
    const aside = { x: 0.3 / 1.75, y: 0, z: -1 };
    const found = aimedInteractable(chairAhead, low, aside, []);
    expect(found?.interactable.id).toBe("chair:0");
    const wide = { x: 0.5 / 1.75, y: 0, z: -1 };
    expect(aimedInteractable(chairAhead, low, wide, [])).toBeNull();
  });
});

describe("hintFor", () => {
  const hint = (entry: Interactable) => hintFor(entry);

  it("tells what clicking does, in a few words", () => {
    const [chair, desk, plant] = only([
      item("chair", 0, 0),
      item("desk", 4, 0),
      item("plant", 8, 0),
    ]);
    expect(hint(chair)).toBe("Click or F · Sit down");
    expect(hint(desk)).toBe("Click or F · Use the computer");
    expect(hint(plant)).toBe("Click or F · Look at the plant");
    expect(hint(only([], [shelf()])[0])).toBe("Click or F · Read a book");
  });
});

describe("panelFor", () => {
  it("says a computer is not set up yet, and a shelf has no books", () => {
    const [desk] = only([item("desk", 0, 0)]);
    expect(panelFor(desk)).toEqual({
      kind: "computer",
      title: "Computer",
      body: "This computer is not set up yet",
    });
    expect(panelFor(only([], [shelf()])[0])).toEqual({
      kind: "book",
      title: "Bookshelf",
      body: "This shelf has no books yet",
    });
  });

  it("describes a plant from the table, by its variant", () => {
    const [first, second] = only([
      item("plant", 0, 0),
      item("plant", 3, 0, 0, 1),
    ]);
    expect(panelFor(first)).toEqual({
      kind: "inspect",
      title: PLANT_INFO[0].name,
      body: PLANT_INFO[0].text,
    });
    expect(panelFor(second).title).toBe(PLANT_INFO[1].name);
  });

  it("falls back to the first plant for a variant the table does not have", () => {
    const [plant] = only([item("plant", 0, 0, 0, 17)]);
    expect(panelFor(plant).title).toBe(PLANT_INFO[0].name);
  });
});

describe("panelUsesMouse", () => {
  it("is for what the admins fill in: computers and bookshelves, not plants", () => {
    expect(panelUsesMouse("computer")).toBe(true);
    expect(panelUsesMouse("book")).toBe(true);
    expect(panelUsesMouse("inspect")).toBe(false);
    expect(panelUsesMouse("sit")).toBe(false);
  });
});
