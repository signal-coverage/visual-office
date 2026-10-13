import type { Box } from "./collision.ts";
import { OFFICE_HEIGHT } from "./constants.ts";
import { COLORS, type BoxPiece } from "./pieces.ts";

/**
 * The things you can put in the office. A kind says what it looks like (a few
 * boxes) and what it blocks; where each one stands is data, in officeData.ts,
 * which the office editor writes. Everything is placed on a quarter-turn grid.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface Furniture {
  kind: FurnitureKind;
  /** Where its middle stands on the floor, in meters. */
  x: number;
  z: number;
  /** A turn around the vertical axis. At 0 everything "behind" it is toward +z. */
  rotation: Rotation;
  /** Which version of the kind (posters have three colours). */
  variant?: number;
}

/** A box of a kind, as measured with the kind turned 0° and standing at the origin. */
interface PieceSpec {
  size: readonly [number, number, number];
  /** [dx, y, dz]: y is the height of its middle, dx and dz are from the item's middle. */
  at: readonly [number, number, number];
  color: number;
  solid: boolean;
  emissive?: number;
  shadows: boolean;
}

interface CatalogEntry {
  label: string;
  pieces: (variant: number) => PieceSpec[];
  /** For a kind that is drawn some other way (the plant): the floor box it blocks, [width, depth]. */
  collider?: readonly [number, number];
  /** A decal lying on the floor: it may run under a wall without it being a mistake. */
  flat?: boolean;
}

const POSTER_COLORS = [0x5b8cff, 0xffb347, 0x6bcf8f];

export const CATALOG = {
  desk: {
    label: "Desk",
    pieces: () => [
      {
        size: [1.8, 0.75, 0.9],
        at: [0, 0.375, 0],
        color: COLORS.desk,
        solid: true,
        shadows: true,
      },
      {
        // The monitor stands on the far side: the chair goes on the other
        size: [0.6, 0.4, 0.05],
        at: [0, 1.0, -0.2],
        color: COLORS.monitor,
        solid: false,
        shadows: true,
      },
    ],
  },
  chair: {
    label: "Chair",
    pieces: () => [
      {
        size: [0.5, 0.45, 0.5],
        at: [0, 0.225, 0],
        color: COLORS.chair,
        solid: true,
        shadows: true,
      },
      {
        // The backrest is toward +z at 0°
        size: [0.5, 0.5, 0.08],
        at: [0, 0.7, 0.21],
        color: COLORS.chair,
        solid: false,
        shadows: true,
      },
    ],
  },
  "meeting-table": {
    label: "Meeting table",
    pieces: () => [
      {
        size: [1.2, 0.75, 3.2],
        at: [0, 0.375, 0],
        color: COLORS.meetingTable,
        solid: true,
        shadows: true,
      },
    ],
  },
  rug: {
    label: "Rug",
    flat: true,
    pieces: () => [
      {
        size: [4.2, 0.02, 4.8],
        at: [0, 0.011, 0],
        color: COLORS.rug,
        solid: false,
        shadows: false,
      },
    ],
  },
  plant: {
    label: "Plant",
    // The client draws it (a pot and leaves); here it only blocks the floor
    pieces: () => [],
    collider: [0.5, 0.5],
  },
  poster: {
    label: "Poster",
    pieces: (variant) => [
      {
        size: [0.9, 1.2, 0.03],
        at: [0, 1.7, 0],
        color: POSTER_COLORS[variant] ?? POSTER_COLORS[0],
        solid: false,
        shadows: false,
      },
    ],
  },
  light: {
    label: "Ceiling light",
    pieces: () => [
      {
        size: [1.4, 0.05, 0.5],
        at: [0, OFFICE_HEIGHT - 0.03, 0],
        color: COLORS.light,
        solid: false,
        shadows: false,
        emissive: COLORS.light,
      },
    ],
  },
} as const satisfies Record<string, CatalogEntry>;

export type FurnitureKind = keyof typeof CATALOG;
export const FURNITURE_KINDS = Object.keys(CATALOG) as FurnitureKind[];

export const MAX_FURNITURE = 400;
const MAX_COORDINATE = 50;
const MAX_VARIANT = 20;

const TURNS: Record<Rotation, { cos: number; sin: number }> = {
  0: { cos: 1, sin: 0 },
  90: { cos: 0, sin: 1 },
  180: { cos: -1, sin: 0 },
  270: { cos: 0, sin: -1 },
};

/** The boxes of an item where it stands, turned as it is turned. */
export function piecesOf(item: Furniture): BoxPiece[] {
  const { cos, sin } = TURNS[item.rotation];
  const swap = item.rotation === 90 || item.rotation === 270;
  const entry: CatalogEntry = CATALOG[item.kind];
  return entry.pieces(item.variant ?? 0).map((spec) => {
    const [dx, y, dz] = spec.at;
    const [w, h, d] = spec.size;
    return {
      size: swap ? [d, h, w] : [w, h, d],
      // The same turn about the vertical axis that three.js applies to a model
      at: [item.x + dx * cos + dz * sin, y, item.z - dx * sin + dz * cos],
      color: spec.color,
      solid: spec.solid,
      emissive: spec.emissive,
      shadows: spec.shadows,
    };
  });
}

/** The floor boxes an item blocks: its solid pieces, or the entry's own box. */
export function furnitureColliders(item: Furniture): Box[] {
  const entry: CatalogEntry = CATALOG[item.kind];
  const boxes = piecesOf(item)
    .filter((piece) => piece.solid)
    .map((piece) => ({
      minX: piece.at[0] - piece.size[0] / 2,
      maxX: piece.at[0] + piece.size[0] / 2,
      minZ: piece.at[2] - piece.size[2] / 2,
      maxZ: piece.at[2] + piece.size[2] / 2,
    }));
  if (entry.collider) {
    const [width, depth] = entry.collider;
    const swap = item.rotation === 90 || item.rotation === 270;
    const [w, d] = swap ? [depth, width] : [width, depth];
    boxes.push({
      minX: item.x - w / 2,
      maxX: item.x + w / 2,
      minZ: item.z - d / 2,
      maxZ: item.z + d / 2,
    });
  }
  return boxes;
}

/** Whether a kind is a decal on the floor (a rug), which things can stand on top of. */
export function isFlat(kind: FurnitureKind): boolean {
  return (CATALOG[kind] as CatalogEntry).flat === true;
}

/** Every floor box an item covers, decoration included: what you would see from above. */
export function furnitureExtent(item: Furniture): Box[] {
  const pieces = piecesOf(item).map((piece): Box => ({
    minX: piece.at[0] - piece.size[0] / 2,
    maxX: piece.at[0] + piece.size[0] / 2,
    minZ: piece.at[2] - piece.size[2] / 2,
    maxZ: piece.at[2] + piece.size[2] / 2,
  }));
  // A plant has no pieces: the box it blocks is all there is
  return [...pieces, ...furnitureColliders(item)];
}

const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAX_COORDINATE;

/**
 * Reads a list of furniture from somewhere untrusted (a file somebody edited
 * by hand, the editor): whatever is not a well-formed item is dropped, so one
 * bad entry never takes the whole office down.
 */
export function sanitizeFurniture(raw: unknown): Furniture[] {
  if (!Array.isArray(raw)) return [];
  const items: Furniture[] = [];
  // Two identical pieces in the same place are never on purpose: they would be
  // drawn on top of each other and block twice
  const seen = new Set<string>();
  for (const entry of raw) {
    if (items.length >= MAX_FURNITURE) break;
    if (typeof entry !== "object" || entry === null) continue;
    const {
      kind,
      x,
      z,
      rotation = 0,
      variant,
    } = entry as Record<string, unknown>;

    if (
      typeof kind !== "string" ||
      !FURNITURE_KINDS.includes(kind as FurnitureKind)
    )
      continue;
    if (!isCoordinate(x) || !isCoordinate(z)) continue;
    if (
      rotation !== 0 &&
      rotation !== 90 &&
      rotation !== 180 &&
      rotation !== 270
    )
      continue;

    const item: Furniture = { kind: kind as FurnitureKind, x, z, rotation };
    if (
      typeof variant === "number" &&
      Number.isInteger(variant) &&
      variant >= 0 &&
      variant <= MAX_VARIANT
    )
      item.variant = variant;

    const key = `${item.kind}|${x}|${z}|${rotation}|${item.variant ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}
