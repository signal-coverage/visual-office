import type { FloorPreview } from "../../shared/floorPreview.ts";
import { OFFICE_DEPTH, OFFICE_WIDTH } from "../../shared/constants.ts";
import { MIN_RECT_PX } from "./consts";

export type DrawKind = "floor" | "zone" | "item" | "glass" | "wall";

export interface DrawRect {
  kind: DrawKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawnPlan {
  width: number;
  height: number;
  rects: DrawRect[];
}

/**
 * A plan as rectangles in a card of `size` pixels: the whole office fits with
 * `padding` to spare, keeps its proportions and is centred. Back to front:
 * floor, zones, furniture, glass, walls. A missing plan is just the floor.
 */
export function drawPreview(
  preview: FloorPreview | null,
  size: { width: number; height: number },
  padding: number,
): DrawnPlan {
  const worldWidth = preview?.width ?? OFFICE_WIDTH;
  const worldDepth = preview?.depth ?? OFFICE_DEPTH;
  const scale = Math.min(
    (size.width - padding * 2) / worldWidth,
    (size.height - padding * 2) / worldDepth,
  );
  const left = (size.width - worldWidth * scale) / 2;
  const top = (size.height - worldDepth * scale) / 2;

  const rects: DrawRect[] = [
    {
      kind: "floor",
      x: left,
      y: top,
      width: worldWidth * scale,
      height: worldDepth * scale,
    },
  ];
  const add = (kind: DrawKind, list: FloorPreview["walls"]) => {
    for (const [minX, minZ, maxX, maxZ] of list) {
      const x = left + (minX + worldWidth / 2) * scale;
      const y = top + (minZ + worldDepth / 2) * scale;
      const width = Math.max(MIN_RECT_PX, (maxX - minX) * scale);
      const height = Math.max(MIN_RECT_PX, (maxZ - minZ) * scale);
      // Clamped so a rectangle at the very edge still fits the card
      const fx = Math.min(Math.max(0, x), size.width - width);
      const fy = Math.min(Math.max(0, y), size.height - height);
      rects.push({ kind, x: fx, y: fy, width, height });
    }
  };
  if (preview) {
    add("zone", preview.zones);
    add("item", preview.items);
    add("glass", preview.glass);
    add("wall", preview.walls);
  }
  return { width: size.width, height: size.height, rects };
}
