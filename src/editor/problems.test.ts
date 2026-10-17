import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL } from "../../shared/defaultShell.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../../shared/officeData.ts";
import type { Shell } from "../../shared/shell.ts";
import {
  blocking,
  editorProblems,
  structureKeys,
  structureKey,
} from "./problems";

const desk = { kind: "desk" as const, x: 0, z: 0, rotation: 0 as const };

describe("editorProblems", () => {
  it("finds nothing wrong with the default office", () => {
    expect(
      editorProblems(OFFICE_FURNITURE, OFFICE_MODELS, DEFAULT_SHELL),
    ).toEqual([]);
  });

  it("puts what is wrong with the shell first, as errors that point at the part", () => {
    const shell: Shell = {
      ...DEFAULT_SHELL,
      walls: [{ x: 0, z: 0, width: 0.01, depth: 4 }],
    };
    const problems = editorProblems([desk], [], shell);
    const first = problems[0];
    expect(first.level).toBe("error");
    expect(first.structure).toEqual([{ kind: "wall", index: 0 }]);
    expect(first.targets).toEqual([]);
  });

  it("reports furniture inside a new wall as a warning that points at the piece", () => {
    const shell: Shell = {
      ...DEFAULT_SHELL,
      walls: [{ x: 0, z: 0, width: 4, depth: 0.2 }],
    };
    const problems = editorProblems([desk], [], shell);
    const wall = problems.find((p) => /inside a wall/i.test(p.message));
    expect(wall).toMatchObject({
      level: "warning",
      targets: [{ list: "furniture", index: 0 }],
      structure: [],
    });
    expect(blocking(problems)).toBe(0);
  });

  it("counts only the errors as blocking", () => {
    const shell: Shell = {
      ...DEFAULT_SHELL,
      walls: [{ x: 0, z: 0, width: 4, depth: 0.2 }],
      zones: [
        ...DEFAULT_SHELL.zones,
        {
          id: "tiny",
          label: "Tiny",
          rect: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
        },
      ],
    };
    const problems = editorProblems([desk], [], shell);
    expect(blocking(problems)).toBeGreaterThan(0);
    expect(blocking(problems)).toBeLessThan(problems.length);
  });

  it("says a zone nobody can walk into is a warning, with nothing to point at but the rooms", () => {
    const shell: Shell = {
      ...DEFAULT_SHELL,
      glass: [],
      walls: [
        { x: -10.5, z: -2, width: 9, depth: 0.2 },
        { x: -6, z: -6, width: 0.2, depth: 8.2 },
        { x: -15, z: -6, width: 0.2, depth: 8.2 },
        { x: -10.5, z: -10, width: 9, depth: 0.2 },
      ],
    };
    const closed = editorProblems([], [], shell).find(
      (p) => p.targets.length === 0 && /nobody can walk/i.test(p.message),
    );
    expect(closed?.level).toBe("warning");
  });
});

describe("structureKeys", () => {
  it("lists the parts the problems are about, to outline them", () => {
    const shell: Shell = {
      ...DEFAULT_SHELL,
      walls: [{ x: 0, z: 0, width: 0.01, depth: 4 }],
    };
    const keys = structureKeys(editorProblems([], [], shell));
    expect(keys.has(structureKey({ kind: "wall", index: 0 }))).toBe(true);
    expect(keys.has(structureKey({ kind: "zone", index: 0 }))).toBe(false);
  });
});
