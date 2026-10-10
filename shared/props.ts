import type { Box } from "./collision.ts";

/**
 * Your own 3D models placed in the office. To add one: save the .glb in
 * public/models/ and add a line to PROPS. See docs/MODELING.md.
 *
 * The client draws the model; the server only uses `footprint`, so what players
 * can walk through is decided here, not by the model's geometry.
 */
export interface PropPlacement {
  /** File name inside public/models, e.g. 'bookshelf.glb'. */
  model: string;
  /** Where the model's origin sits on the floor: [x, z] in meters. */
  at: readonly [x: number, z: number];
  /** Turn around the vertical axis, in degrees. 0 leaves the model's front facing +z. */
  rotationDeg?: number;
  /** Multiplies the model's size. Prefer modelling at real size and leaving this out. */
  scale?: number;
  /**
   * The floor area players cannot walk through, [width, depth] in meters, in
   * the world (after scale), centered on `at` and before the turn is applied.
   * Leave it out for things you can walk through (rugs, posters, ceiling lights).
   */
  footprint?: readonly [width: number, depth: number];
}

export const PROPS: PropPlacement[] = [
  // A bookshelf against the north wall, facing into the room
  { model: "bookshelf.glb", at: [4.3, -6.6], footprint: [1.6, 0.4] },
];

/** The axis-aligned box a prop blocks, or null for decorations. A turn grows the box to cover the whole object. */
export function footprintCollider(prop: PropPlacement): Box | null {
  if (!prop.footprint) return null;
  const [width, depth] = prop.footprint;
  const angle = ((prop.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const halfX = (width * cos + depth * sin) / 2;
  const halfZ = (width * sin + depth * cos) / 2;
  const [x, z] = prop.at;
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
}

export const PROP_COLLIDERS: Box[] = PROPS.flatMap(
  (prop) => footprintCollider(prop) ?? [],
);
