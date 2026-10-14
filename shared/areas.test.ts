import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "./constants.ts";
import { AREAS, areaAt, HALLWAY } from "./areas.ts";
import { zoneById } from "./zones.ts";

describe("the named areas", () => {
  it("are the prototype's rooms, with its names and its rectangles", () => {
    expect(AREAS.map((a) => a.label)).toEqual([
      "Meeting room",
      "Kitchen",
      "Lounge",
      "Reception",
      "Open area",
    ]);
    const box = (label: string) => AREAS.find((a) => a.label === label)!.area;
    expect(box("Meeting room")).toEqual({
      minX: -15,
      maxX: -6,
      minZ: -10,
      maxZ: -2,
    });
    expect(box("Kitchen")).toEqual({ minX: 6, maxX: 15, minZ: -10, maxZ: -2 });
    expect(box("Lounge")).toEqual({ minX: 6, maxX: 15, minZ: 3, maxZ: 10 });
    expect(box("Reception")).toEqual({
      minX: -15,
      maxX: -6,
      minZ: 3,
      maxZ: 10,
    });
    expect(box("Open area")).toEqual({
      minX: -15,
      maxX: 15,
      minZ: -10,
      maxZ: 10,
    });
  });

  it("cover the whole floor of the office, the way the prototype's do", () => {
    const open = AREAS.find((a) => a.label === "Open area")!.area;
    expect(open.maxX - open.minX).toBe(OFFICE_WIDTH);
    expect(open.maxZ - open.minZ).toBe(OFFICE_DEPTH);
  });
});

describe("areaAt", () => {
  it("names the room somebody is in", () => {
    expect(areaAt(-10.5, -6)).toBe("Meeting room");
    expect(areaAt(10.5, -6)).toBe("Kitchen");
    expect(areaAt(10.5, 6.5)).toBe("Lounge");
    expect(areaAt(-10.5, 6)).toBe("Reception");
  });

  it("calls everywhere else the open area", () => {
    expect(areaAt(0, 0)).toBe("Open area");
    expect(areaAt(0, 8.5)).toBe("Open area");
    expect(areaAt(-7, 0)).toBe("Open area");
  });

  it("takes the edges as inside, and prefers the more specific room", () => {
    expect(areaAt(-6, -2)).toBe("Meeting room");
    expect(areaAt(6, -2)).toBe("Kitchen");
    expect(areaAt(-5.99, -2)).toBe("Open area");
  });

  it("calls anything past the floor the hallway", () => {
    expect(areaAt(OFFICE_WIDTH, 0)).toBe(HALLWAY);
    expect(HALLWAY).toBe("Hallway");
  });

  it("agrees with the private zone: its middle is the meeting room", () => {
    const { area, label } = zoneById("meeting")!;
    const x = (area.minX + area.maxX) / 2;
    const z = (area.minZ + area.maxZ) / 2;
    expect(areaAt(x, z)).toBe(label);
  });
});
