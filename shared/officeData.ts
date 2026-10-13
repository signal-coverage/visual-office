import type { Furniture } from "./furniture.ts";
import type { PropPlacement } from "./props.ts";

/**
 * Where everything stands. The office editor writes this file (run `npm run dev`,
 * then open /editor.html and press Save); editing it by hand works too.
 * Anything that is not a valid entry is ignored when the office is built.
 */
export const OFFICE_FURNITURE: Furniture[] = [
  { kind: "desk", x: -6, z: -3, rotation: 0 },
  { kind: "chair", x: -6, z: -2.05, rotation: 0 },
  { kind: "desk", x: -2, z: -3, rotation: 0 },
  { kind: "chair", x: -2, z: -2.05, rotation: 0 },
  { kind: "desk", x: 2, z: -3, rotation: 0 },
  { kind: "chair", x: 2, z: -2.05, rotation: 0 },
  { kind: "desk", x: -6, z: 3, rotation: 0 },
  { kind: "chair", x: -6, z: 3.95, rotation: 0 },
  { kind: "desk", x: -2, z: 3, rotation: 0 },
  { kind: "chair", x: -2, z: 3.95, rotation: 0 },
  { kind: "desk", x: 2, z: 3, rotation: 0 },
  { kind: "chair", x: 2, z: 3.95, rotation: 0 },
  { kind: "rug", x: 8, z: 0, rotation: 0 },
  { kind: "meeting-table", x: 8, z: 0, rotation: 0 },
  { kind: "chair", x: 6.9, z: -1.2, rotation: 180 },
  { kind: "chair", x: 9.1, z: -1.2, rotation: 0 },
  { kind: "chair", x: 6.9, z: 0, rotation: 180 },
  { kind: "chair", x: 9.1, z: 0, rotation: 0 },
  { kind: "chair", x: 6.9, z: 1.2, rotation: 180 },
  { kind: "chair", x: 9.1, z: 1.2, rotation: 0 },
  { kind: "plant", x: -9.1, z: -6.1, rotation: 0 },
  { kind: "plant", x: -9.1, z: 6.1, rotation: 0 },
  { kind: "plant", x: 9.1, z: -6.1, rotation: 0 },
  { kind: "plant", x: 9.1, z: 6.1, rotation: 0 },
  { kind: "poster", x: -6, z: -6.83, rotation: 0, variant: 0 },
  { kind: "poster", x: -2, z: -6.83, rotation: 0, variant: 1 },
  { kind: "poster", x: 2, z: -6.83, rotation: 0, variant: 2 },
  { kind: "light", x: -6, z: -3, rotation: 0 },
  { kind: "light", x: -6, z: 3, rotation: 0 },
  { kind: "light", x: -2, z: -3, rotation: 0 },
  { kind: "light", x: -2, z: 3, rotation: 0 },
  { kind: "light", x: 2, z: -3, rotation: 0 },
  { kind: "light", x: 2, z: 3, rotation: 0 },
  { kind: "light", x: 8, z: -1.5, rotation: 0 },
  { kind: "light", x: 8, z: 1.5, rotation: 0 },
];

export const OFFICE_MODELS: PropPlacement[] = [
  // A bookshelf against the north wall, facing into the room
  { model: "bookshelf.glb", at: [4.3, -6.6], footprint: [1.6, 0.4] },
];
