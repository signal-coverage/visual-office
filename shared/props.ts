import type { Box } from "./collision.ts";
import { OFFICE_MODELS } from "./officeData.ts";

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

export const MAX_MODELS = 200;
const MAX_COORDINATE = 50;
const MAX_FOOTPRINT = 30;
const MAX_SCALE = 10;
/** A plain file name inside public/models: no folders, nothing but a .glb. */
const MODEL_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.glb$/;

export function isModelFileName(name: unknown): name is string {
  return typeof name === "string" && MODEL_FILE.test(name);
}

/**
 * The name a file picked by a person will be saved under: only its own name
 * (never the folders it came from), with spaces and unusual letters turned into
 * single dashes. Null when it is not a .glb or nothing usable is left.
 */
export function toModelFileName(original: string): string | null {
  const base = original.split(/[\\/]/).pop() ?? "";
  const match = /^(.*)\.glb$/i.exec(base);
  if (!match) return null;
  const stem = match[1]
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[-._]+$/, "");
  const name = `${stem}.glb`;
  return stem !== "" && isModelFileName(name) ? name : null;
}

const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAX_COORDINATE;

/**
 * Reads model placements from somewhere untrusted (a file edited by hand, the
 * editor). What is not a well-formed placement is dropped; an optional field
 * that makes no sense is left out and the placement is kept.
 */
export function sanitizeModels(raw: unknown): PropPlacement[] {
  if (!Array.isArray(raw)) return [];
  const props: PropPlacement[] = [];
  const seen = new Set<string>(); // exact copies in the same place are never on purpose
  for (const entry of raw) {
    if (props.length >= MAX_MODELS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const { model, at, rotationDeg, scale, footprint } = entry as Record<
      string,
      unknown
    >;

    if (!isModelFileName(model)) continue;
    if (!Array.isArray(at) || at.length !== 2) continue;
    if (!isCoordinate(at[0]) || !isCoordinate(at[1])) continue;

    const prop: PropPlacement = { model, at: [at[0], at[1]] };
    if (typeof rotationDeg === "number" && Number.isFinite(rotationDeg))
      prop.rotationDeg = rotationDeg;
    if (
      typeof scale === "number" &&
      Number.isFinite(scale) &&
      scale > 0 &&
      scale <= MAX_SCALE
    )
      prop.scale = scale;
    if (
      Array.isArray(footprint) &&
      footprint.length === 2 &&
      footprint.every(
        (side) =>
          typeof side === "number" &&
          Number.isFinite(side) &&
          side > 0 &&
          side <= MAX_FOOTPRINT,
      )
    )
      prop.footprint = [footprint[0], footprint[1]];

    const key = `${model}|${at[0]}|${at[1]}|${prop.rotationDeg ?? 0}|${prop.scale ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    props.push(prop);
  }
  return props;
}

/** Your own models, from officeData.ts. */
export const PROPS: PropPlacement[] = sanitizeModels(OFFICE_MODELS);

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
