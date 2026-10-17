import { describe, expect, it } from "vitest";
import type { Box } from "./collision.ts";
import { PLAYER_RADIUS } from "./constants.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import {
  DEFAULT_TEMPLATE_ID,
  FLOOR_TEMPLATES,
  sanitizeTemplateId,
  templateById,
  type FloorTemplate,
} from "./floorTemplates.ts";
import {
  furnitureColliders,
  furnitureExtent,
  isFlat,
  MAX_FURNITURE,
  sanitizeFurniture,
} from "./furniture.ts";
import { sceneFor } from "./layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { findProblems } from "./officeProblems.ts";
import { sanitizeModels } from "./props.ts";
import { findShellProblems, SHELL_LIMITS } from "./shell.ts";
import { shellColliders } from "./shellGeometry.ts";
import { zoneAt } from "./zones.ts";

const template = (id: string): FloorTemplate => {
  const found = templateById(id);
  if (!found) throw new Error(`No template ${id}`);
  return found;
};

const sceneOf = (t: FloorTemplate) =>
  sceneFor({ furniture: t.furniture, models: t.models, shell: t.shell });

const overlaps = (a: Box, b: Box) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-6 &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 1e-6;

describe("the catalogue", () => {
  it("offers the open office first, as the default, then the three others", () => {
    expect(FLOOR_TEMPLATES.map((t) => t.id)).toEqual([
      "office",
      "open",
      "meeting",
      "lounge",
    ]);
    expect(DEFAULT_TEMPLATE_ID).toBe("office");
  });

  it("gives each a name and a one-line description", () => {
    for (const t of FLOOR_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(2);
      expect(t.name.length).toBeLessThanOrEqual(24);
      expect(t.description.trim().length).toBeGreaterThan(20);
      expect(t.description.length).toBeLessThanOrEqual(110);
      expect(t.description).not.toContain("\n");
    }
  });

  it("finds a template by id and says no to anything else", () => {
    expect(templateById("meeting")?.id).toBe("meeting");
    expect(templateById("nope")).toBeUndefined();
    expect(templateById("__proto__")).toBeUndefined();
    expect(templateById("constructor")).toBeUndefined();
  });

  it("reads the template of a request: none means the default, a wrong one is refused", () => {
    expect(sanitizeTemplateId(undefined)).toBe("office");
    expect(sanitizeTemplateId("lounge")).toBe("lounge");
    expect(sanitizeTemplateId("nope")).toBeNull();
    expect(sanitizeTemplateId(3)).toBeNull();
    expect(sanitizeTemplateId(null)).toBeNull();
    expect(sanitizeTemplateId("")).toBeNull();
    expect(sanitizeTemplateId("toString")).toBeNull();
  });

  it("is plain data: it survives JSON", () => {
    for (const t of FLOOR_TEMPLATES)
      expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe("the open office template is the default floor, exactly", () => {
  it("has the default shell and the default furniture", () => {
    const office = template("office");
    expect(office.shell).toEqual(DEFAULT_SHELL);
    expect(office.furniture).toEqual(OFFICE_FURNITURE);
    expect(office.models).toEqual(OFFICE_MODELS);
  });
});

/** One wall that closes a side of a zone, and the two places somebody can be pressed against it. */
interface Pressing {
  inside: { x: number; z: number };
  outside: { x: number; z: number };
}

/** Every place somebody can stand pressed against a wall that closes a side of the zone, from inside and from outside. */
function pressings(zone: Box, walls: Box[]): Pressing[] {
  const R = PLAYER_RADIUS;
  const { minX, maxX, minZ, maxZ } = zone;
  const found: Pressing[] = [];
  const span = (a1: number, a2: number, b1: number, b2: number) => {
    const lo = Math.max(a1, b1);
    const hi = Math.min(a2, b2);
    return hi - lo >= 1 ? (lo + hi) / 2 : null;
  };
  for (const wall of walls) {
    if (Math.abs(wall.maxX - minX) < 0.01) {
      const z = span(wall.minZ, wall.maxZ, minZ, maxZ);
      if (z !== null)
        found.push({
          inside: { x: minX + R, z },
          outside: { x: wall.minX - R, z },
        });
    }
    if (Math.abs(wall.minX - maxX) < 0.01) {
      const z = span(wall.minZ, wall.maxZ, minZ, maxZ);
      if (z !== null)
        found.push({
          inside: { x: maxX - R, z },
          outside: { x: wall.maxX + R, z },
        });
    }
    if (Math.abs(wall.maxZ - minZ) < 0.01) {
      const x = span(wall.minX, wall.maxX, minX, maxX);
      if (x !== null)
        found.push({
          inside: { x, z: minZ + R },
          outside: { x, z: wall.minZ - R },
        });
    }
    if (Math.abs(wall.minZ - maxZ) < 0.01) {
      const x = span(wall.minX, wall.maxX, minX, maxX);
      if (x !== null)
        found.push({
          inside: { x, z: maxZ - R },
          outside: { x, z: wall.maxZ + R },
        });
    }
  }
  return found;
}

describe.each(FLOOR_TEMPLATES.map((t) => [t.id, t] as const))(
  "the %s template",
  (_id, t) => {
    const scene = sceneOf(t);

    it("has a good shell", () => {
      expect(findShellProblems(t.shell)).toEqual([]);
    });

    it("is used as it is: sceneFor keeps its shell instead of falling back to the default", () => {
      expect(scene.shell).toEqual(t.shell);
    });

    it("has a layout with no problem: nothing outside, in a wall, on the spawn, overlapping or closing a room off", () => {
      expect(findProblems(t.furniture, t.models, t.shell)).toEqual([]);
    });

    it("loses nothing when the furniture and models are sanitized", () => {
      expect(sanitizeFurniture(t.furniture)).toEqual(t.furniture);
      expect(sanitizeModels(t.models)).toEqual(t.models);
      expect(t.furniture.length).toBeLessThanOrEqual(MAX_FURNITURE);
    });

    it("stays within what the renderer, the editor and the plans can handle", () => {
      expect(t.shell.width).toBeGreaterThanOrEqual(SHELL_LIMITS.minWidth);
      expect(t.shell.width).toBeLessThanOrEqual(SHELL_LIMITS.maxWidth);
      expect(t.shell.depth).toBeGreaterThanOrEqual(SHELL_LIMITS.minDepth);
      expect(t.shell.depth).toBeLessThanOrEqual(SHELL_LIMITS.maxDepth);
    });

    it("puts every piece of furniture inside the floor and what blocks out of the walls", () => {
      const walls = shellColliders(t.shell);
      const { floor } = scene;
      t.furniture.forEach((item, index) => {
        const what = `${item.kind} #${index} at ${item.x}, ${item.z}`;
        if (!isFlat(item.kind))
          for (const box of furnitureExtent(item)) {
            expect(box.minX, what).toBeGreaterThanOrEqual(floor.minX - 0.01);
            expect(box.maxX, what).toBeLessThanOrEqual(floor.maxX + 0.01);
            expect(box.minZ, what).toBeGreaterThanOrEqual(floor.minZ - 0.01);
            expect(box.maxZ, what).toBeLessThanOrEqual(floor.maxZ + 0.01);
          }
        for (const box of furnitureColliders(item))
          for (const wall of walls)
            expect(overlaps(box, wall), `${what} is inside a wall`).toBe(false);
      });
    });

    it("leaves the place where people appear free all over, with room for a body, and out of any zone", () => {
      const { minX, maxX, minZ, maxZ } = t.shell.spawn.area;
      for (let x = minX; x <= maxX + 1e-9; x += 0.25)
        for (let z = minZ; z <= maxZ + 1e-9; z += 0.25) {
          const blocked = scene.colliders.some(
            (b) =>
              x + PLAYER_RADIUS > b.minX &&
              x - PLAYER_RADIUS < b.maxX &&
              z + PLAYER_RADIUS > b.minZ &&
              z - PLAYER_RADIUS < b.maxZ,
          );
          expect(blocked, `blocked at ${x}, ${z}`).toBe(false);
          expect(zoneAt(x, z, null, scene.zones)).toBeNull();
        }
    });

    it("names the places people can be in, ending with one that holds the whole floor", () => {
      expect(t.shell.areas.length).toBeGreaterThan(0);
      const last = t.shell.areas.at(-1)!.rect;
      expect(last.minX).toBeLessThanOrEqual(-t.shell.width / 2 + 0.2);
      expect(last.maxX).toBeGreaterThanOrEqual(t.shell.width / 2 - 0.2);
      expect(last.minZ).toBeLessThanOrEqual(-t.shell.depth / 2 + 0.2);
      expect(last.maxZ).toBeGreaterThanOrEqual(t.shell.depth / 2 - 0.2);
    });

    it("puts somebody pressed against a wall of a zone on the right side of it", () => {
      const walls = shellColliders(t.shell);
      for (const zone of scene.zones) {
        const found = pressings(zone.area, walls);
        expect(found.length, `walls around ${zone.label}`).toBeGreaterThan(0);
        for (const { inside, outside } of found) {
          expect(zoneAt(inside.x, inside.z, null, scene.zones)).toBe(zone.id);
          expect(zoneAt(inside.x, inside.z, zone.id, scene.zones)).toBe(
            zone.id,
          );
          const onFloor =
            Math.abs(outside.x) < t.shell.width / 2 - 0.3 &&
            Math.abs(outside.z) < t.shell.depth / 2 - 0.3;
          if (!onFloor) continue;
          expect(zoneAt(outside.x, outside.z, null, scene.zones)).not.toBe(
            zone.id,
          );
          expect(zoneAt(outside.x, outside.z, zone.id, scene.zones)).not.toBe(
            zone.id,
          );
        }
      }
    });
  },
);

describe("the open floor template", () => {
  const open = template("open");

  it("is one big open space: no private zone, no glass, no screen", () => {
    expect(open.shell.zones).toEqual([]);
    expect(open.shell.glass).toEqual([]);
    expect(open.shell.screens).toEqual([]);
  });

  it("has desks with their chairs, and a few plants", () => {
    const count = (kind: string) =>
      open.furniture.filter((item) => item.kind === kind).length;
    expect(count("desk")).toBeGreaterThanOrEqual(8);
    expect(count("chair")).toBeGreaterThanOrEqual(count("desk"));
    expect(count("plant")).toBeGreaterThanOrEqual(3);
  });

  it("has boards on a wall, for everybody on the floor", () => {
    expect(open.shell.boards.length).toBeGreaterThanOrEqual(1);
    for (const board of open.shell.boards) expect(board.zone).toBeNull();
  });

  it("is not the size of the main office", () => {
    expect([open.shell.width, open.shell.depth]).not.toEqual([30, 20]);
  });
});

describe("the meeting floor template", () => {
  const meeting = template("meeting");
  const scene = sceneOf(meeting);

  it("has two to four private rooms closed with glass", () => {
    expect(meeting.shell.zones.length).toBeGreaterThanOrEqual(2);
    expect(meeting.shell.zones.length).toBeLessThanOrEqual(4);
    expect(meeting.shell.glass.length).toBeGreaterThanOrEqual(
      meeting.shell.zones.length,
    );
  });

  it("gives every room a screen and a board of its own, on walls", () => {
    for (const zone of meeting.shell.zones) {
      expect(
        meeting.shell.screens.some((screen) => screen.zone === zone.id),
        `a screen in ${zone.label}`,
      ).toBe(true);
      expect(
        meeting.shell.boards.some((board) => board.zone === zone.id),
        `a board in ${zone.label}`,
      ).toBe(true);
    }
  });

  it("has a table and chairs in each room, and a small lounge with a sofa", () => {
    expect(meeting.furniture.some((item) => item.kind === "sofa")).toBe(true);
    expect(meeting.shell.areas.some((area) => /lounge/i.test(area.label))).toBe(
      true,
    );
    for (const zone of scene.zones) {
      const inside = meeting.furniture.filter(
        (item) =>
          item.x > zone.area.minX &&
          item.x < zone.area.maxX &&
          item.z > zone.area.minZ &&
          item.z < zone.area.maxZ,
      );
      expect(
        inside.some((item) => /table/.test(item.kind)),
        `a table in ${zone.label}`,
      ).toBe(true);
      expect(
        inside.filter((item) => item.kind === "chair").length,
        `chairs in ${zone.label}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("is bigger than the main office", () => {
    expect(meeting.shell.width * meeting.shell.depth).toBeGreaterThan(30 * 20);
  });

  it("lets people walk into every room from where they appear, even with nothing inside", () => {
    expect(
      findProblems([], [], meeting.shell).map((problem) => problem.code),
    ).toEqual([]);
  });
});

describe("the lounge template", () => {
  const lounge = template("lounge");

  it("has no private zone and no screen", () => {
    expect(lounge.shell.zones).toEqual([]);
    expect(lounge.shell.screens).toEqual([]);
  });

  it("is made of sofas, a counter and plants, with no desks", () => {
    const count = (kind: string) =>
      lounge.furniture.filter((item) => item.kind === kind).length;
    expect(count("sofa")).toBeGreaterThanOrEqual(2);
    expect(count("counter")).toBeGreaterThanOrEqual(1);
    expect(count("plant")).toBeGreaterThanOrEqual(3);
    expect(count("desk")).toBe(0);
  });

  it("paints a floor of its own under the seating", () => {
    expect(lounge.shell.floors.some((patch) => patch.tone === "lounge")).toBe(
      true,
    );
  });
});
