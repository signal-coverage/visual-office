import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT, OFFICE_DEPTH, WALL_THICKNESS } from "./constants.ts";
import { BOARDS } from "./boards.ts";
import { SCREENS, screenById, zoneHasScreen } from "./screens.ts";
import { zoneById } from "./zones.ts";

describe("the screens", () => {
  it("each belong to a real zone and sit inside it", () => {
    for (const screen of SCREENS) {
      const area = zoneById(screen.zone)!.area;
      expect(zoneById(screen.zone)).toBeDefined();
      expect(screen.center.x - screen.width / 2).toBeGreaterThanOrEqual(
        area.minX,
      );
      expect(screen.center.x + screen.width / 2).toBeLessThanOrEqual(area.maxX);
    }
  });

  it("face into the room, away from their wall", () => {
    for (const screen of SCREENS) {
      const area = zoneById(screen.zone)!.area;
      const inFront = screen.center.z + screen.normal.z;
      expect(inFront).toBeGreaterThan(area.minZ);
      expect(inFront).toBeLessThan(area.maxZ);
      expect(
        Math.hypot(screen.normal.x, screen.normal.y, screen.normal.z),
      ).toBeCloseTo(1);
    }
  });

  it("hang on the wall: off the floor, below the ceiling, not inside the wall", () => {
    for (const screen of SCREENS) {
      expect(screen.center.y - screen.height / 2).toBeGreaterThan(0.5);
      expect(screen.center.y + screen.height / 2).toBeLessThan(OFFICE_HEIGHT);
      expect(Math.abs(screen.center.z)).toBeLessThan(
        OFFICE_DEPTH / 2 - WALL_THICKNESS / 2,
      );
    }
  });

  it("are widescreen, like what people share", () => {
    for (const screen of SCREENS) {
      expect(screen.width / screen.height).toBeCloseTo(16 / 9, 1);
    }
  });

  it("do not hide a whiteboard", () => {
    for (const screen of SCREENS) {
      for (const board of BOARDS) {
        // On different walls, so the planes cannot overlap: their normals differ
        const same =
          screen.normal.x * board.normal.x + screen.normal.z * board.normal.z >
          0.9;
        expect(same).toBe(false);
      }
    }
  });

  it("tell which zones have one", () => {
    expect(zoneHasScreen("meeting")).toBe(true);
    expect(zoneHasScreen("lounge")).toBe(false);
    expect(zoneHasScreen("")).toBe(false);
  });

  it("have unique ids and can be found", () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
    expect(screenById("meeting")).toBe(SCREENS[0]);
    expect(screenById("nowhere")).toBeUndefined();
  });
});
