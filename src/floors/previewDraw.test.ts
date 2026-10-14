import { describe, expect, it } from "vitest";
import type { FloorPreview } from "../../shared/floorPreview.ts";
import { drawPreview } from "./previewDraw";

const preview: FloorPreview = {
  id: "office",
  width: 30,
  depth: 20,
  walls: [[-15, -10, 15, -9.7]],
  glass: [[-6, -10, -5.9, -5]],
  zones: [[-14, -9, -6, -2]],
  items: [[-3, -6, -1, -5]],
};

const CARD = { width: 240, height: 160 };

const floorOf = (card: { width: number; height: number }) =>
  drawPreview(preview, card, 4).rects.find((rect) => rect.kind === "floor")!;

describe("drawPreview", () => {
  it("fits every rectangle inside the card", () => {
    const { rects } = drawPreview(preview, CARD, 8);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(CARD.width + 1e-9);
      expect(rect.y + rect.height).toBeLessThanOrEqual(CARD.height + 1e-9);
    }
  });

  it("keeps the proportions of the office, whatever the card", () => {
    for (const card of [
      CARD,
      { width: 100, height: 300 },
      { width: 300, height: 90 },
    ]) {
      const floor = floorOf(card);
      expect(floor.width / floor.height).toBeCloseTo(30 / 20, 6);
    }
  });

  it("centres the plan in the card", () => {
    const floor = floorOf({ width: 300, height: 90 });
    expect(floor.x + floor.width / 2).toBeCloseTo(150, 6);
    expect(floor.y + floor.height / 2).toBeCloseTo(45, 6);
  });

  it("draws the floor first and the walls last, so walls are never hidden", () => {
    const kinds = drawPreview(preview, CARD, 8).rects.map((rect) => rect.kind);
    expect(kinds[0]).toBe("floor");
    expect(kinds.at(-1)).toBe("wall");
    expect(kinds.indexOf("zone")).toBeLessThan(kinds.indexOf("item"));
  });

  it("gives the floor, and every wall, glass, zone and item, a rectangle", () => {
    expect(drawPreview(preview, CARD, 8).rects).toHaveLength(5);
  });

  it("never makes a rectangle too thin to see", () => {
    for (const rect of drawPreview(preview, CARD, 8).rects) {
      expect(rect.width).toBeGreaterThanOrEqual(1);
      expect(rect.height).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic", () => {
    expect(drawPreview(preview, CARD, 8)).toEqual(
      drawPreview(preview, CARD, 8),
    );
  });

  it("draws an empty plan when the preview is missing", () => {
    const { rects } = drawPreview(null, CARD, 8);
    expect(rects).toHaveLength(1);
    expect(rects[0].kind).toBe("floor");
  });
});
