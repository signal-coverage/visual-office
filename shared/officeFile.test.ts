import { describe, expect, it } from "vitest";
import type { Furniture } from "./furniture.ts";
import { officeDataSource } from "./officeFile.ts";
import type { PropPlacement } from "./props.ts";

const desk: Furniture = { kind: "desk", x: -6, z: -3, rotation: 0 };
const chair: Furniture = { kind: "chair", x: 6.9, z: 0, rotation: 180 };
const poster: Furniture = {
  kind: "poster",
  x: -2,
  z: -6.83,
  rotation: 0,
  variant: 1,
};
const shelf: PropPlacement = {
  model: "bookshelf.glb",
  at: [4.3, -6.6],
  footprint: [1.6, 0.4],
};

/** The list written after `export const NAME ... =`, read back as data. */
function listIn(source: string, name: string): unknown {
  const match = new RegExp(
    `export const ${name}[^=]*= (\\[[\\s\\S]*?\\]);`,
  ).exec(source);
  if (!match) throw new Error(`${name} not found in:\n${source}`);
  return JSON.parse(match[1]);
}

describe("officeDataSource", () => {
  it("writes both lists, so reading them back gives what was saved", () => {
    const source = officeDataSource([desk, chair, poster], [shelf]);
    expect(listIn(source, "OFFICE_FURNITURE")).toEqual([desk, chair, poster]);
    expect(listIn(source, "OFFICE_MODELS")).toEqual([shelf]);
  });

  it("writes an empty office as empty lists", () => {
    const source = officeDataSource([], []);
    expect(listIn(source, "OFFICE_FURNITURE")).toEqual([]);
    expect(listIn(source, "OFFICE_MODELS")).toEqual([]);
  });

  it("only writes what is valid: it never saves what the game would ignore", () => {
    const source = officeDataSource(
      [
        desk,
        { kind: "spaceship", x: 0, z: 0, rotation: 0 },
      ] as unknown as Furniture[],
      [shelf, { model: "../x.glb", at: [0, 0] }],
    );
    expect(listIn(source, "OFFICE_FURNITURE")).toEqual([desk]);
    expect(listIn(source, "OFFICE_MODELS")).toEqual([shelf]);
  });

  it("is a TypeScript module that names the types it uses", () => {
    const source = officeDataSource([desk], []);
    expect(source).toContain('import type { Furniture } from "./furniture.ts"');
    expect(source).toContain('import type { PropPlacement } from "./props.ts"');
    expect(source).toContain("export const OFFICE_FURNITURE: Furniture[] =");
    expect(source).toContain("export const OFFICE_MODELS: PropPlacement[] =");
  });

  it("says who writes it, so nobody wonders", () => {
    expect(officeDataSource([], [])).toMatch(/office editor/i);
  });

  it("cannot be tricked into writing code through a model name", () => {
    const source = officeDataSource(
      [],
      [{ model: 'a.glb"; process.exit(); //', at: [0, 0] }],
    );
    expect(source).not.toContain("process.exit");
  });

  it("ends with a newline, like every other file here", () => {
    expect(officeDataSource([], []).endsWith("\n")).toBe(true);
  });
});
