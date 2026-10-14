import { segmentBlocked, type Box } from "./collision.ts";
import {
  furnitureColliders,
  isFlat,
  piecesOf,
  type Furniture,
  type FurnitureKind,
} from "./furniture.ts";
import { footprintCollider, type PropPlacement } from "./props.ts";

/**
 * What can be done with the things that stand in a floor. A kind of furniture,
 * or a model, says what it offers; where it stands comes from the layout, so
 * the client and the server work out the same list from the same layout.
 */

export type InteractionKind = "sit" | "computer" | "book" | "inspect";

/** A box in the air: the thing as it fills the space, to aim at it. */
export interface Box3 extends Box {
  minY: number;
  maxY: number;
}

/** A place on the floor and where to look from it (yaw as the camera has it: 0 looks toward -z). */
export interface Anchor {
  x: number;
  z: number;
  yaw: number;
}

export interface Seat extends Anchor {
  /** Whether it faces a desk or a table: the arms go forward to it. */
  atDesk: boolean;
}

export interface Interactable {
  /** What it is and its place in the layout's list: the same on the client and on the server. */
  id: string;
  kind: InteractionKind;
  /** What it is called, for the panel and the hint. */
  subject: string;
  /** The variant of the furniture, which tells one plant from another. */
  variant?: number;
  box: Box3;
  /** Where to stand to use it (for a chair, the seat itself). */
  anchor: Anchor;
  seat?: Seat;
}

/** How far, in meters, the eyes reach what they aim at. */
export const INTERACT_RANGE = 2.5;
/** Small things are hard to hit: the box is this much larger on every side. */
const AIM_PADDING = 0.05;
/** How far in front of a piece one stands to use it, from its edge. */
const STAND_GAP = 0.65;
const PLANT_HEIGHT = 1.15;
const SHELF_HEIGHT = 2;
/** How far ahead of a seat to look for the desk it faces, and how much slack the desk gets. */
const DESK_PROBE = 0.6;
const DESK_SLACK = 0.15;

const FURNITURE_INTERACTIONS: Partial<
  Record<FurnitureKind, { kind: InteractionKind; subject: string }>
> = {
  chair: { kind: "sit", subject: "Chair" },
  desk: { kind: "computer", subject: "Computer" },
  plant: { kind: "inspect", subject: "Plant" },
};

/** The models that offer something. Any other model is only decoration. */
const MODEL_INTERACTIONS: Readonly<
  Record<string, { kind: InteractionKind; subject: string }>
> = {
  "bookshelf.glb": { kind: "book", subject: "Bookshelf" },
};

/** What a seat can face and count as sitting at it. */
const DESK_KINDS: ReadonlySet<FurnitureKind> = new Set([
  "desk",
  "meeting-table",
  "conference-table",
  "reception-desk",
  "island",
  "counter",
]);

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The same turn about the vertical axis that furniture and three.js apply. */
function turn(angle: number, dx: number, dz: number) {
  const cos = Math.round(Math.cos(angle) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(angle) * 1e12) / 1e12;
  return { x: dx * cos + dz * sin, z: -dx * sin + dz * cos };
}

function hull(boxes: Box[]): Box {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}

function boxOf(item: Furniture): Box3 {
  const pieces = piecesOf(item).filter(
    (piece) => piece.solid || !isFlat(item.kind),
  );
  if (pieces.length === 0)
    return { ...hull(furnitureColliders(item)), minY: 0, maxY: PLANT_HEIGHT };
  const floor = pieces.map((piece) => ({
    minX: piece.at[0] - piece.size[0] / 2,
    maxX: piece.at[0] + piece.size[0] / 2,
    minZ: piece.at[2] - piece.size[2] / 2,
    maxZ: piece.at[2] + piece.size[2] / 2,
  }));
  return {
    ...hull(floor),
    minY: Math.min(...pieces.map((piece) => piece.at[1] - piece.size[1] / 2)),
    maxY: Math.max(...pieces.map((piece) => piece.at[1] + piece.size[1] / 2)),
  };
}

/** How far the piece reaches toward its own front (+z when not turned). */
function frontReach(item: Furniture): number {
  return boxOf({ ...item, x: 0, z: 0, rotation: 0 }).maxZ;
}

function standingSpot(
  x: number,
  z: number,
  angle: number,
  reach: number,
): Anchor {
  const offset = turn(angle, 0, reach + STAND_GAP);
  return { x: x + offset.x, z: z + offset.z, yaw: angle };
}

function facesDesk(seat: Anchor, furniture: Furniture[]): boolean {
  const ahead = turn(seat.yaw, 0, -DESK_PROBE);
  const probe = { x: seat.x + ahead.x, z: seat.z + ahead.z };
  return furniture
    .filter((other) => DESK_KINDS.has(other.kind))
    .some((other) =>
      furnitureColliders(other).some(
        (b) =>
          probe.x >= b.minX - DESK_SLACK &&
          probe.x <= b.maxX + DESK_SLACK &&
          probe.z >= b.minZ - DESK_SLACK &&
          probe.z <= b.maxZ + DESK_SLACK,
      ),
    );
}

/**
 * Everything that can be used in a layout. The ids come from the list the
 * layout holds (`chair:3` is the fourth piece, a chair), so both sides that
 * read the same layout name the same piece the same way.
 */
export function interactablesOf(layout: {
  furniture: Furniture[];
  models: PropPlacement[];
}): Interactable[] {
  const found: Interactable[] = [];

  layout.furniture.forEach((item, index) => {
    const offer = FURNITURE_INTERACTIONS[item.kind];
    if (!offer) return;
    const angle = radians(item.rotation);
    const entry: Interactable = {
      id: `${item.kind}:${index}`,
      kind: offer.kind,
      subject: offer.subject,
      box: boxOf(item),
      anchor: standingSpot(item.x, item.z, angle, frontReach(item)),
    };
    if (item.variant !== undefined) entry.variant = item.variant;
    if (offer.kind === "sit") {
      const pose = { x: item.x, z: item.z, yaw: angle };
      entry.anchor = pose;
      entry.seat = { ...pose, atDesk: facesDesk(pose, layout.furniture) };
    }
    found.push(entry);
  });

  layout.models.forEach((prop, index) => {
    const offer = MODEL_INTERACTIONS[prop.model];
    const footprint = footprintCollider(prop);
    if (!offer || !footprint || !prop.footprint) return;
    const angle = radians(prop.rotationDeg ?? 0);
    found.push({
      id: `${prop.model}:${index}`,
      kind: offer.kind,
      subject: offer.subject,
      box: { ...footprint, minY: 0, maxY: SHELF_HEIGHT },
      anchor: standingSpot(
        prop.at[0],
        prop.at[1],
        angle,
        prop.footprint[1] / 2,
      ),
    });
  });

  return found;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The distance along a ray at which it first meets a box, or null. */
function rayHit(eye: Vec3, direction: Vec3, box: Box3): number | null {
  let enter = 0;
  let leave = Infinity;
  const axes = [
    [eye.x, direction.x, box.minX - AIM_PADDING, box.maxX + AIM_PADDING],
    [eye.y, direction.y, box.minY - AIM_PADDING, box.maxY + AIM_PADDING],
    [eye.z, direction.z, box.minZ - AIM_PADDING, box.maxZ + AIM_PADDING],
  ] as const;
  for (const [start, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    const t1 = (min - start) / delta;
    const t2 = (max - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return null;
  }
  return enter;
}

export interface Aim {
  interactable: Interactable;
  distance: number;
}

/**
 * What the eyes point at within reach: the nearest thing the line of sight meets,
 * unless something solid (a wall, a desk) stands in between. `direction` need not be of length 1.
 */
export function aimedInteractable(
  interactables: Interactable[],
  eye: Vec3,
  direction: Vec3,
  colliders: Box[],
  range: number = INTERACT_RANGE,
): Aim | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length === 0) return null;
  const unit = {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
  let best: Aim | null = null;
  for (const interactable of interactables) {
    const distance = rayHit(eye, unit, interactable.box);
    if (distance === null || distance > range) continue;
    if (best && distance >= best.distance) continue;
    const hit = {
      x: eye.x + unit.x * distance,
      z: eye.z + unit.z * distance,
    };
    if (segmentBlocked({ x: eye.x, z: eye.z }, hit, colliders)) continue;
    best = { interactable, distance };
  }
  return best;
}

const HINT_VERBS: Readonly<
  Record<InteractionKind, (subject: string) => string>
> = {
  sit: () => "Sit down",
  computer: () => "Use the computer",
  book: () => "Read a book",
  inspect: (subject) => `Look at the ${subject.toLowerCase()}`,
};

/** The line that tells what clicking does. */
export function hintFor(interactable: Interactable): string {
  return `Click or F · ${HINT_VERBS[interactable.kind](interactable.subject)}`;
}

/** What a plant is, by its variant. The first one is for any the table does not have. */
export const PLANT_INFO: readonly { name: string; text: string }[] = [
  {
    name: "Fiddle-leaf fig",
    text: "Ficus lyrata. Large, glossy leaves. It likes bright light and a little water every week.",
  },
  {
    name: "Swiss cheese plant",
    text: "Monstera deliciosa. The holes in its leaves let light through to the ones below.",
  },
  {
    name: "Snake plant",
    text: "Dracaena trifasciata. Hard to kill: it copes with little light and watering every few weeks.",
  },
];

export interface PanelContent {
  /** What is being used: a computer and a shelf show what the admins set up, and want the mouse. */
  kind: InteractionKind;
  title: string;
  body: string;
}

/** Whether the panel of this kind is for clicking and scrolling, so the mouse is freed while it is open. */
export function panelUsesMouse(kind: InteractionKind): boolean {
  return kind === "computer" || kind === "book";
}

/** What to show about something that is looked at or used, when it is not a seat. */
export function panelFor(interactable: Interactable): PanelContent {
  switch (interactable.kind) {
    case "computer":
      return {
        kind: "computer",
        title: interactable.subject,
        body: "This computer is not set up yet",
      };
    case "book":
      return {
        kind: "book",
        title: interactable.subject,
        body: "This shelf has no books yet",
      };
    case "inspect": {
      const plant = PLANT_INFO[interactable.variant ?? 0] ?? PLANT_INFO[0];
      return { kind: "inspect", title: plant.name, body: plant.text };
    }
    case "sit":
      return { kind: "sit", title: interactable.subject, body: "" };
  }
}
