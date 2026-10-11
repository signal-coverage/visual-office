import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH, PLAYER_RADIUS } from "./constants.ts";
import { moveWithCollisions } from "./collision.ts";
import { OFFICE_COLLIDERS } from "./layout.ts";
import { ZONES, ZONE_MARGIN, zoneAt, zoneById, zoneLabel } from "./zones.ts";

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
  it("finds the meeting room around its table, and nothing in the open plan", () => {
    expect(zoneAt(8, 0, null)).toBe("meeting");
    expect(zoneAt(-8, 0, null)).toBeNull();
    expect(zoneAt(0, 3, null)).toBeNull();
  });

  it("does not confuse the open plan with the room when standing at the door", () => {
    // The door gap sits in the divider itself: neither side yet
    expect(zoneAt(5.5, 0, null)).toBeNull();
    expect(zoneAt(5.5, 0, "meeting")).toBe("meeting");
  });

  it("needs a few steps inside to enter, and a few outside to leave", () => {
    const enter = meeting.minX + ZONE_MARGIN;
    expect(zoneAt(enter - 0.05, 0, null)).toBeNull();
    expect(zoneAt(enter + 0.05, 0, null)).toBe("meeting");

    const leave = meeting.minX - ZONE_MARGIN;
    expect(zoneAt(leave + 0.05, 0, "meeting")).toBe("meeting");
    expect(zoneAt(leave - 0.05, 0, "meeting")).toBeNull();
  });

  it("does not flicker when the position jitters around the doorway", () => {
    const edge = meeting.minX + ZONE_MARGIN;
    let zone: ReturnType<typeof zoneAt> = null;
    let changes = 0;
    for (let i = 0; i < 200; i++) {
      const jitter = Math.sin(i * 1.7) * 0.2;
      const next = zoneAt(edge + jitter, 0, zone);
      if (next !== zone) changes++;
      zone = next;
    }
    // Wobbling +-20 cm around the entry line may flip once, never back and forth
    expect(changes).toBeLessThanOrEqual(1);
  });

  it("puts a player pressed against either side of the divider in the right place", () => {
    // Walk into the real divider from both sides: this is as close as anybody can get
    for (const z of [-5, 5]) {
      const fromOutside = moveWithCollisions(
        { x: 0, z },
        { x: 8, z: 0 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      );
      const fromInside = moveWithCollisions(
        { x: 8, z },
        { x: -5, z: 0 },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      );
      // They really are stopped by the wall, on opposite sides of it
      expect(fromOutside.x).toBeLessThan(5.5);
      expect(fromInside.x).toBeGreaterThan(5.5);

      // Never inside from the open plan side, even when they were inside a moment ago...
      expect(zoneAt(fromOutside.x, fromOutside.z, null)).toBeNull();
      expect(zoneAt(fromOutside.x, fromOutside.z, "meeting")).toBeNull();
      // ...and always inside on the other side of the very same wall
      expect(zoneAt(fromInside.x, fromInside.z, null)).toBe("meeting");
    }
  });

  it("keeps a player standing against the far walls of the room inside it", () => {
    const eastWall = meeting.maxX - PLAYER_RADIUS;
    const northWall = meeting.minZ + PLAYER_RADIUS;
    const southWall = meeting.maxZ - PLAYER_RADIUS;
    expect(zoneAt(eastWall, 0, null)).toBe("meeting");
    expect(zoneAt(8, northWall, null)).toBe("meeting");
    expect(zoneAt(8, southWall, null)).toBe("meeting");
  });
});
