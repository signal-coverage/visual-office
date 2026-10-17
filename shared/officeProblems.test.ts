import { describe, expect, it } from "vitest";
import type { Furniture } from "./furniture.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { findProblems } from "./officeProblems.ts";
import type { Shell } from "./shell.ts";
import type { PropPlacement } from "./props.ts";

const item = (
  kind: Furniture["kind"],
  x: number,
  z: number,
  rotation: Furniture["rotation"] = 0,
): Furniture => ({ kind, x, z, rotation });

const codes = (furniture: Furniture[], models: PropPlacement[] = []) =>
  findProblems(furniture, models).map((problem) => problem.code);

describe("findProblems", () => {
  it("finds nothing wrong with the office as it is", () => {
    expect(findProblems(OFFICE_FURNITURE, OFFICE_MODELS)).toEqual([]);
  });

  it("finds nothing wrong with an empty office", () => {
    expect(findProblems([], [])).toEqual([]);
  });

  describe("outside", () => {
    it("catches furniture past the walls", () => {
      const problems = findProblems([item("desk", 14.6, 0)], []);
      expect(problems.map((p) => p.code)).toContain("outside");
      expect(problems[0].targets).toEqual([{ list: "furniture", index: 0 }]);
    });

    it("catches a ceiling light that sticks out too", () => {
      expect(codes([item("light", 14.8, 0)])).toContain("outside");
    });

    it("lets furniture touch the wall", () => {
      // A desk 1.8 wide against the west wall: its edge is exactly on the wall
      expect(codes([item("desk", -14.85 + 0.9, 0)])).not.toContain("outside");
    });

    it("catches a model past the wall", () => {
      const shelf: PropPlacement = {
        model: "s.glb",
        at: [14.9, 0],
        footprint: [1, 1],
      };
      const problems = findProblems([], [shelf]);
      expect(problems[0]).toMatchObject({
        code: "outside",
        targets: [{ list: "models", index: 0 }],
      });
    });
  });

  describe("overlap", () => {
    it("catches two things that are in the same place, and names both", () => {
      const problems = findProblems(
        [item("desk", -6, 0), item("desk", -5.5, 0)],
        [],
      );
      const overlap = problems.find((p) => p.code === "overlap")!;
      expect(overlap.targets).toEqual([
        { list: "furniture", index: 0 },
        { list: "furniture", index: 1 },
      ]);
    });

    it("lets things that touch without overlapping stand side by side", () => {
      // Two desks 1.8 wide, exactly 1.8 apart
      expect(codes([item("desk", -6, 0), item("desk", -4.2, 0)])).toEqual([]);
    });

    it("does not count decoration, so a rug can lie under a table", () => {
      expect(codes([item("rug", 8, 0), item("meeting-table", 8, 0)])).toEqual(
        [],
      );
      expect(
        codes([item("poster", 0, -6.83), item("desk", 0, -6.4)]),
      ).not.toContain("overlap");
    });

    it("catches furniture inside a model's footprint", () => {
      const shelf: PropPlacement = {
        model: "s.glb",
        at: [0, 0],
        footprint: [2, 2],
      };
      const problems = findProblems([item("chair", 0.5, 0.5)], [shelf]);
      expect(problems.find((p) => p.code === "overlap")?.targets).toEqual([
        { list: "furniture", index: 0 },
        { list: "models", index: 0 },
      ]);
    });

    it("notices a turn: a desk turned a quarter reaches further sideways", () => {
      const flat = [item("desk", 0, 0), item("chair", 1.2, 0)];
      expect(codes(flat)).not.toContain("overlap");
      const turned = [item("desk", 0, 0, 90), item("chair", 0.6, 0)];
      expect(codes(turned)).toContain("overlap");
    });
  });

  describe("walls", () => {
    it("catches furniture standing inside the meeting room's glass wall", () => {
      const problems = codes([item("desk", -6, -8)]);
      expect(problems).toContain("wall");
    });

    it("lets furniture stand in the doorway gap if there is room (but it may block the way)", () => {
      expect(codes([item("chair", -6, -3.5)])).not.toContain("wall");
    });
  });

  describe("the spawn area", () => {
    it("catches furniture where people appear", () => {
      expect(codes([item("desk", 0, 8.5)])).toContain("spawn");
    });

    it("leaves furniture just outside it alone", () => {
      expect(codes([item("desk", -3, 5)])).not.toContain("spawn");
    });
  });

  describe("reaching the rooms", () => {
    it("catches a meeting room that nobody can walk into", () => {
      // Plants too close together to squeeze between, filling the open corner that is its door
      const plants = [
        item("plant", -6, -4.5),
        item("plant", -6, -3.5),
        item("plant", -6, -2.5),
        item("plant", -6.5, -2),
        item("plant", -7.5, -2),
        item("plant", -8.5, -2),
      ];
      const problems = findProblems(plants, []);
      const unreachable = problems.find((p) => p.code === "unreachable")!;
      expect(unreachable.message).toMatch(/meeting room/i);
    });

    it("does not complain about a room that is only a little more cramped", () => {
      expect(codes([item("plant", -6, -3.5)])).not.toContain("unreachable");
    });
  });

  it("reports every problem, not just the first", () => {
    const found = codes([item("desk", 14.6, 0), item("desk", 0, 8.5)]);
    expect(found).toContain("outside");
    expect(found).toContain("spawn");
  });

  it("describes each problem in words a person can act on", () => {
    for (const problem of findProblems([item("desk", 14.6, 0)], [])) {
      expect(problem.message.trim().length).toBeGreaterThan(10);
    }
  });
});

describe("findProblems on another shell", () => {
  /** 24 by 16, a wall across the middle, a private room in the north-west corner and the spawn area in the south. */
  const shell: Shell = {
    width: 24,
    depth: 16,
    walls: [{ x: 4, z: 0, width: 0.2, depth: 6 }],
    glass: [
      { x: -4, z: -5.5, width: 0.15, depth: 4.65 },
      { x: -8, z: -2, width: 8, depth: 0.15 },
    ],
    floors: [],
    zones: [
      {
        id: "room",
        label: "Room",
        rect: { minX: -11.85, maxX: -4.075, minZ: -7.85, maxZ: -2.075 },
      },
    ],
    areas: [],
    boards: [],
    screens: [],
    spawn: { area: { minX: -2, maxX: 2, minZ: 5, maxZ: 6.5 }, yaw: 0 },
  };
  const on = (furniture: Furniture[], models: PropPlacement[] = []) =>
    findProblems(furniture, models, shell).map((problem) => problem.code);

  it("finds nothing wrong with an empty floor", () => {
    expect(on([])).toEqual([]);
  });

  it("measures the walls of that floor: a desk that is fine in the default office sticks out here", () => {
    expect(codes([item("desk", 13, 0)])).not.toContain("outside");
    expect(on([item("desk", 13, 0)])).toContain("outside");
  });

  it("catches furniture inside a wall of that shell", () => {
    expect(on([item("desk", 4, 0)])).toContain("wall");
    expect(on([item("desk", 8, 0)])).not.toContain("wall");
  });

  it("catches furniture where people appear in that shell, and not where they appear by default", () => {
    expect(on([item("desk", 0, 6)])).toContain("spawn");
    expect(on([item("desk", 0, 8.5)])).not.toContain("spawn");
    expect(codes([item("desk", 0, 6)])).not.toContain("spawn");
  });

  it("catches a private room nobody can walk into, by that shell's zones", () => {
    const plants = [item("plant", -4, -2.9), item("plant", -4, -2.35)];
    const found = findProblems(plants, [], shell).find(
      (problem) => problem.code === "unreachable",
    );
    expect(found?.message).toMatch(/room/i);
  });

  it("does not look for rooms a shell does not have", () => {
    const open: Shell = { ...shell, glass: [], zones: [], walls: [] };
    expect(
      findProblems([item("plant", -4, -3)], [], open).map((p) => p.code),
    ).not.toContain("unreachable");
  });
});
