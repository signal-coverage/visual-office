import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH, PLAYER_RADIUS } from "./constants.ts";
import { moveWithCollisions } from "./collision.ts";
import { OFFICE_COLLIDERS } from "./layout.ts";
import {
  ZONES,
  ZONE_MARGIN,
  zoneAt,
  zoneById,
  zoneLabel,
  zonesOf,
} from "./zones.ts";

const meeting = zoneById("meeting")!.area;

describe("zones", () => {
  it("fit inside the office", () => {
    for (const { area } of ZONES) {
      expect(area.minX).toBeGreaterThanOrEqual(-OFFICE_WIDTH / 2);
      expect(area.maxX).toBeLessThanOrEqual(OFFICE_WIDTH / 2);
      expect(area.minZ).toBeGreaterThanOrEqual(-OFFICE_DEPTH / 2);
      expect(area.maxZ).toBeLessThanOrEqual(OFFICE_DEPTH / 2);
    }
  });

  it("have unique ids and readable labels", () => {
    expect(new Set(ZONES.map((zone) => zone.id)).size).toBe(ZONES.length);
    for (const zone of ZONES) expect(zone.label.trim()).not.toBe("");
  });

  it("do not overlap each other", () => {
    for (const a of ZONES) {
      for (const b of ZONES) {
        if (a === b) continue;
        const apart =
          a.area.maxX <= b.area.minX ||
          b.area.maxX <= a.area.minX ||
          a.area.maxZ <= b.area.minZ ||
          b.area.maxZ <= a.area.minZ;
        expect(apart).toBe(true);
      }
    }
  });
});

describe("zoneLabel", () => {
  it("names the zones for the screen", () => {
    expect(zoneLabel("meeting")).toBe("Meeting room");
  });

  it("shows an id it does not know as it is, instead of nothing", () => {
    expect(zoneLabel("rooftop")).toBe("rooftop");
  });
});

describe("zoneAt", () => {
  it("finds the meeting room around its table, and nothing in the rest of the office", () => {
    expect(zoneAt(-10.5, -6, null)).toBe("meeting");
    expect(zoneAt(0, 3, null)).toBeNull();
    expect(zoneAt(10.5, -6, null)).toBeNull();
    expect(zoneAt(-10.5, 6, null)).toBeNull();
  });

  it("does not confuse the rest of the office with the room when standing at the door", () => {
    // The door is the open corner of the room, in line with its glass walls: neither side yet
    expect(zoneAt(-6, -3.5, null)).toBeNull();
    expect(zoneAt(-6, -3.5, "meeting")).toBe("meeting");
    expect(zoneAt(-7.5, -2, null)).toBeNull();
    expect(zoneAt(-7.5, -2, "meeting")).toBe("meeting");
  });

  it("needs a few steps inside to enter, and a few outside to leave", () => {
    const enter = meeting.maxX - ZONE_MARGIN;
    expect(zoneAt(enter + 0.05, -8, null)).toBeNull();
    expect(zoneAt(enter - 0.05, -8, null)).toBe("meeting");

    const leave = meeting.maxX + ZONE_MARGIN;
    expect(zoneAt(leave - 0.05, -8, "meeting")).toBe("meeting");
    expect(zoneAt(leave + 0.05, -8, "meeting")).toBeNull();
  });

  it("does not flicker when the position jitters around the doorway", () => {
    const edge = meeting.maxX - ZONE_MARGIN;
    let zone: ReturnType<typeof zoneAt> = null;
    let changes = 0;
    for (let i = 0; i < 200; i++) {
      const jitter = Math.sin(i * 1.7) * 0.2;
      const next = zoneAt(edge + jitter, -8, zone);
      if (next !== zone) changes++;
      zone = next;
    }
    // Wobbling +-20 cm around the entry line may flip once, never back and forth
    expect(changes).toBeLessThanOrEqual(1);
  });

  it("puts a player pressed against either side of a glass wall in the right place", () => {
    // Walk into the real glass walls from both sides: this is as close as anybody can get
    const east = {
      outside: moveWithCollisions(
        { x: -3, z: -8 },
        { x: -9, z: 0 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      ),
      inside: moveWithCollisions(
        { x: -9, z: -8 },
        { x: 9, z: 0 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      ),
    };
    const south = {
      outside: moveWithCollisions(
        { x: -14, z: 1 },
        { x: 0, z: -7 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      ),
      inside: moveWithCollisions(
        { x: -14, z: -8 },
        { x: 0, z: 7 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      ),
    };
    // They really are stopped by the wall, on opposite sides of it
    expect(east.outside.x).toBeGreaterThan(-6);
    expect(east.inside.x).toBeLessThan(-6);
    expect(south.outside.z).toBeGreaterThan(-2);
    expect(south.inside.z).toBeLessThan(-2);

    for (const { outside, inside } of [east, south]) {
      // Never inside from the outside, even when they were inside a moment ago...
      expect(zoneAt(outside.x, outside.z, null)).toBeNull();
      expect(zoneAt(outside.x, outside.z, "meeting")).toBeNull();
      // ...and always inside on the other side of the very same wall
      expect(zoneAt(inside.x, inside.z, null)).toBe("meeting");
    }
  });

  it("keeps a player standing against the far walls of the room inside it", () => {
    const westWall = meeting.minX + PLAYER_RADIUS;
    const northWall = meeting.minZ + PLAYER_RADIUS;
    const southWall = meeting.maxZ - PLAYER_RADIUS;
    expect(zoneAt(westWall, -8, null)).toBe("meeting");
    expect(zoneAt(-14, northWall, null)).toBe("meeting");
    expect(zoneAt(-14, southWall, null)).toBe("meeting");
  });
});

describe("zones of another shell", () => {
  const zones = [
    {
      id: "a",
      label: "Room A",
      area: { minX: -10, maxX: -4, minZ: -6, maxZ: -2 },
    },
    {
      id: "b",
      label: "Room B",
      area: { minX: 4, maxX: 10, minZ: -6, maxZ: -2 },
    },
  ];

  it("finds the zone a point is in among the zones it is given", () => {
    expect(zoneAt(-7, -4, null, zones)).toBe("a");
    expect(zoneAt(7, -4, null, zones)).toBe("b");
    expect(zoneAt(0, -4, null, zones)).toBeNull();
    // The default meeting room is not there
    expect(zoneAt(-10.5, -6, null, zones)).toBeNull();
  });

  it("keeps the hysteresis at the edge of any zone", () => {
    expect(zoneAt(-3.8, -4, null, zones)).toBeNull();
    expect(zoneAt(-3.8, -4, "a", zones)).toBe("a");
  });

  it("names a zone from the list, and shows an id it does not know as it is", () => {
    expect(zoneLabel("b", zones)).toBe("Room B");
    expect(zoneLabel("meeting", zones)).toBe("meeting");
    expect(zoneById("a", zones)?.label).toBe("Room A");
    expect(zoneById("meeting", zones)).toBeUndefined();
  });

  it("makes zones of a shell", () => {
    expect(
      zonesOf({
        zones: [
          {
            id: "a",
            label: "Room A",
            rect: { minX: 0, maxX: 3, minZ: 0, maxZ: 3 },
          },
        ],
      }),
    ).toEqual([
      {
        id: "a",
        label: "Room A",
        area: { minX: 0, maxX: 3, minZ: 0, maxZ: 3 },
      },
    ]);
  });
});
