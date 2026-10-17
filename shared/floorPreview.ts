import type { Box } from "./collision.ts";
import { furnitureExtent, isFlat } from "./furniture.ts";
import { sceneFor, type Layout } from "./layout.ts";
import { footprintCollider } from "./props.ts";

/** A rectangle seen from above, in meters: [minX, minZ, maxX, maxZ], to a tenth. */
export type PreviewRect = readonly [
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
];

/**
 * A floor as a simplified plan, for the map of rooms: footprints only. It says
 * nothing about which model, which furniture, what can be used or who is there.
 */
export interface FloorPreview {
  id: string;
  width: number;
  depth: number;
  walls: PreviewRect[];
  glass: PreviewRect[];
  zones: PreviewRect[];
  items: PreviewRect[];
}

/** The most furniture and model footprints a plan carries, so the answer stays small. */
export const MAX_PREVIEW_RECTS = 300;

/** Kinds seen from above that are not floor space: lights hang, posters are on a wall, rugs are flat. */
const NOT_FOOTPRINTS = new Set(["light", "poster"]);

const tenth = (value: number) => Math.round(value * 10) / 10;

const rectOf = (box: Box): PreviewRect => [
  tenth(box.minX),
  tenth(box.minZ),
  tenth(box.maxX),
  tenth(box.maxZ),
];

const unique = (rects: PreviewRect[]): PreviewRect[] => {
  const seen = new Set<string>();
  return rects.filter((rect) => {
    const key = rect.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The simplified plan of a floor, from its layout. */
export function previewOf(id: string, layout: Layout): FloorPreview {
  const scene = sceneFor(layout);
  const boxOf = (piece: { size: readonly number[]; at: readonly number[] }) =>
    rectOf({
      minX: piece.at[0] - piece.size[0] / 2,
      maxX: piece.at[0] + piece.size[0] / 2,
      minZ: piece.at[2] - piece.size[2] / 2,
      maxZ: piece.at[2] + piece.size[2] / 2,
    });
  const items: PreviewRect[] = [];
  for (const item of scene.furniture) {
    if (NOT_FOOTPRINTS.has(item.kind) || isFlat(item.kind)) continue;
    for (const box of furnitureExtent(item)) items.push(rectOf(box));
  }
  for (const prop of scene.models) {
    const box = footprintCollider(prop);
    if (box) items.push(rectOf(box));
  }
  return {
    id,
    width: scene.shell.width,
    depth: scene.shell.depth,
    walls: scene.shellPieces
      .filter((piece) => piece.solid && piece.opacity === undefined)
      .map(boxOf),
    glass: scene.shellPieces
      .filter((piece) => piece.opacity !== undefined)
      .map(boxOf),
    zones: scene.zones.map((zone) => rectOf(zone.area)),
    items: unique(items).slice(0, MAX_PREVIEW_RECTS),
  };
}
