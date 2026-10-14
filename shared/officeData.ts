import type { Furniture } from "./furniture.ts";
import type { PropPlacement } from "./props.ts";

/**
 * Where everything stands. The office editor writes this file (run `npm run dev`,
 * then open /editor.html and press Save); editing it by hand works too.
 * Anything that is not a valid entry is ignored when the office is built.
 */
export const OFFICE_FURNITURE: Furniture[] = [
  // The open area: three columns of desks, each with its chair
  { kind: "desk", x: -3, z: -6, rotation: 0 },
  { kind: "chair", x: -3, z: -5.05, rotation: 0 },
  { kind: "desk", x: 0, z: -6, rotation: 0 },
  { kind: "chair", x: 0, z: -5.05, rotation: 0 },
  { kind: "desk", x: 3, z: -6, rotation: 0 },
  { kind: "chair", x: 3, z: -5.05, rotation: 0 },
  { kind: "desk", x: -3, z: -3, rotation: 0 },
  { kind: "chair", x: -3, z: -2.05, rotation: 0 },
  { kind: "desk", x: 0, z: -3, rotation: 0 },
  { kind: "chair", x: 0, z: -2.05, rotation: 0 },
  { kind: "desk", x: 3, z: -3, rotation: 0 },
  { kind: "chair", x: 3, z: -2.05, rotation: 0 },
  { kind: "desk", x: -3, z: 2, rotation: 0 },
  { kind: "chair", x: -3, z: 2.95, rotation: 0 },
  { kind: "desk", x: 0, z: 2, rotation: 0 },
  { kind: "chair", x: 0, z: 2.95, rotation: 0 },
  { kind: "desk", x: 3, z: 2, rotation: 0 },
  { kind: "chair", x: 3, z: 2.95, rotation: 0 },
  { kind: "desk", x: -3, z: 5, rotation: 0 },
  { kind: "chair", x: -3, z: 5.95, rotation: 0 },
  { kind: "desk", x: 0, z: 5, rotation: 0 },
  { kind: "chair", x: 0, z: 5.95, rotation: 0 },
  { kind: "desk", x: 3, z: 5, rotation: 0 },
  { kind: "chair", x: 3, z: 5.95, rotation: 0 },
  // The meeting room
  { kind: "conference-table", x: -10.5, z: -6, rotation: 0 },
  { kind: "chair", x: -11.7, z: -7.1, rotation: 180 },
  { kind: "chair", x: -11.7, z: -4.9, rotation: 0 },
  { kind: "chair", x: -10.5, z: -7.1, rotation: 180 },
  { kind: "chair", x: -10.5, z: -4.9, rotation: 0 },
  { kind: "chair", x: -9.3, z: -7.1, rotation: 180 },
  { kind: "chair", x: -9.3, z: -4.9, rotation: 0 },
  // The kitchen, the lounge and the reception
  { kind: "counter", x: 10.5, z: -9.2, rotation: 0 },
  { kind: "island", x: 10.5, z: -5, rotation: 0 },
  { kind: "sofa", x: 10.5, z: 7, rotation: 0 },
  { kind: "reception-desk", x: -10.5, z: 6, rotation: 0 },
  // Plants
  { kind: "plant", x: -14, z: 9, rotation: 0 },
  { kind: "plant", x: 14, z: 9, rotation: 0 },
  { kind: "plant", x: -14, z: -1, rotation: 0 },
  { kind: "plant", x: 14, z: -1, rotation: 0 },
  { kind: "plant", x: -5.5, z: 0, rotation: 0 },
  { kind: "plant", x: 5.5, z: 0, rotation: 0 },
  { kind: "plant", x: -6.4, z: -2.6, rotation: 0 },
  // Ceiling lights
  { kind: "light", x: -8, z: -5, rotation: 0 },
  { kind: "light", x: -8, z: 5, rotation: 0 },
  { kind: "light", x: 0, z: -5, rotation: 0 },
  { kind: "light", x: 0, z: 5, rotation: 0 },
  { kind: "light", x: 8, z: -5, rotation: 0 },
  { kind: "light", x: 8, z: 5, rotation: 0 },
];

export const OFFICE_MODELS: PropPlacement[] = [
  // A bookshelf against the north wall, facing into the room
  { model: "bookshelf.glb", at: [0, -9.6], footprint: [1.6, 0.4] },
];
