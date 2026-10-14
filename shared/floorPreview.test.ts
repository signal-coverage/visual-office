import { describe, expect, it } from "vitest";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "./constants.ts";
import { MAX_PREVIEW_RECTS, previewOf } from "./floorPreview.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";

const layout = { furniture: OFFICE_FURNITURE, models: OFFICE_MODELS };

describe("previewOf", () => {
  it("carries the office size, the walls, the glass and the zones", () => {
    const preview = previewOf("office", layout);
    expect(preview.id).toBe("office");
    expect(preview.width).toBe(OFFICE_WIDTH);
    expect(preview.depth).toBe(OFFICE_DEPTH);
    expect(preview.walls).toHaveLength(4);
    expect(preview.glass).toHaveLength(2);
    expect(preview.zones).toHaveLength(1);
  });

  it("draws furniture footprints but not ceiling lights or rugs", () => {
    const withLight = previewOf("a", {
      furniture: [{ kind: "light", x: 0, z: 0, rotation: 0 }],
      models: [],
    });
    expect(withLight.items).toHaveLength(0);
    const withDesk = previewOf("a", {
      furniture: [{ kind: "desk", x: 0, z: 0, rotation: 0 }],
      models: [],
    });
    expect(withDesk.items.length).toBeGreaterThan(0);
  });

  it("includes the footprint of a model and leaves out decorations", () => {
    const preview = previewOf("a", {
      furniture: [],
      models: [
        { model: "a.glb", at: [0, 0], footprint: [2, 1] },
        { model: "b.glb", at: [4, 4] },
      ],
    });
    expect(preview.items).toEqual([[-1, -0.5, 1, 0.5]]);
  });

  it("rounds every number to a tenth of a metre", () => {
    const preview = previewOf("a", {
      furniture: [{ kind: "desk", x: 1.2345, z: 2.3456, rotation: 0 }],
      models: [],
    });
    for (const rect of preview.items)
      for (const n of rect) expect(Math.round(n * 10) / 10).toBe(n);
  });

  it("keeps no file names, ids or names", () => {
    const text = JSON.stringify(
      previewOf("a", {
        furniture: [],
        models: [{ model: "secret-plan.glb", at: [0, 0], footprint: [1, 1] }],
      }),
    );
    expect(text).not.toContain("secret");
    expect(text).not.toContain("glb");
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      "depth",
      "glass",
      "id",
      "items",
      "walls",
      "width",
      "zones",
    ]);
  });

  it("is bounded", () => {
    const furniture = Array.from({ length: 400 }, (_, i) => ({
      kind: "desk" as const,
      x: (i % 20) - 10,
      z: Math.floor(i / 20) - 10,
      rotation: 0 as const,
    }));
    const preview = previewOf("a", { furniture, models: [] });
    expect(preview.items.length).toBeLessThanOrEqual(MAX_PREVIEW_RECTS);
  });

  it("is deterministic", () => {
    expect(previewOf("office", layout)).toEqual(previewOf("office", layout));
  });
});
