import { describe, expect, it } from "vitest";
import type { Furniture } from "./furniture.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import { findProblems } from "./officeProblems.ts";
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
      const problems = findProblems([item("desk", 9.6, 0)], []);
      expect(problems.map((p) => p.code)).toContain("outside");
      expect(problems[0].targets).toEqual([{ list: "furniture", index: 0 }]);
    });

    it("catches a ceiling light that sticks out too", () => {
      expect(codes([item("light", 9.8, 0)])).toContain("outside");
    });

    it("lets furniture touch the wall", () => {
      // A desk 1.8 wide against the west wall: its edge is exactly on the wall
      expect(codes([item("desk", -9.85 + 0.9, 0)])).not.toContain("outside");
    });

    it("catches a model past the wall", () => {
      const shelf: PropPlacement = {
        model: "s.glb",
        at: [9.9, 0],
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
    it("catches furniture standing inside the meeting room's divider", () => {
      const problems = codes([item("desk", 5.5, 4)]);
      expect(problems).toContain("wall");
    });

    it("lets furniture stand in the doorway gap if there is room (but it may block the way)", () => {
      expect(codes([item("chair", 5.5, 0)])).not.toContain("wall");
    });
  });

  describe("the spawn area", () => {
    it("catches furniture where people appear", () => {
      expect(codes([item("desk", -8, 0)])).toContain("spawn");
    });

    it("leaves furniture just outside it alone", () => {
      expect(codes([item("desk", -3, 5)])).not.toContain("spawn");
    });
  });

  describe("reaching the rooms", () => {
    it("catches a meeting room that nobody can walk into", () => {
      // A row of plants, too close together to squeeze between, west of the door
      const plants = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].map((z) =>
        item("plant", 5.0, z),
      );
      const problems = findProblems(plants, []);
      const unreachable = problems.find((p) => p.code === "unreachable")!;
      expect(unreachable.message).toMatch(/meeting room/i);
    });

    it("does not complain about a room that is only a little more cramped", () => {
      expect(codes([item("plant", 5.0, 0)])).not.toContain("unreachable");
    });
  });

  it("reports every problem, not just the first", () => {
    const found = codes([item("desk", 9.6, 0), item("desk", -8, 0)]);
    expect(found).toContain("outside");
    expect(found).toContain("spawn");
  });

  it("describes each problem in words a person can act on", () => {
    for (const problem of findProblems([item("desk", 9.6, 0)], [])) {
      expect(problem.message.trim().length).toBeGreaterThan(10);
    }
  });
});
