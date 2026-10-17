import { DEFAULT_SHELL } from "./defaultShell.ts";
import type { Furniture, Rotation } from "./furniture.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "./officeData.ts";
import type { PropPlacement } from "./props.ts";
import type { Shell } from "./shell.ts";

/**
 * The floors a room can start from: a shell and the furniture that goes with
 * it. A new room is made from one (the admin picks it when making the room) and
 * its first published layout is the template's. Changing the template of a room
 * that exists is for the editor, later.
 */
export interface FloorTemplate {
  id: string;
  /** What the admin sees in the list. */
  name: string;
  /** One line about it. */
  description: string;
  shell: Shell;
  furniture: Furniture[];
  models: PropPlacement[];
}

/** The template a room is made from when none is asked for: the office every floor used to be. */
export const DEFAULT_TEMPLATE_ID = "office";

const piece = (
  kind: Furniture["kind"],
  x: number,
  z: number,
  rotation: Rotation = 0,
): Furniture => ({ kind, x, z, rotation });

/** A desk with its chair on the south side, as the open area of the main office has them. */
const workstation = (x: number, z: number): Furniture[] => [
  piece("desk", x, z),
  piece("chair", x, z + 0.95),
];

/** A conference table with three chairs on each long side. */
const conference = (x: number, z: number): Furniture[] => [
  piece("conference-table", x, z),
  ...[-1.2, 0, 1.2].flatMap((dx) => [
    piece("chair", x + dx, z - 1.1, 180),
    piece("chair", x + dx, z + 1.1),
  ]),
];

const plants = (...at: Array<[number, number]>): Furniture[] =>
  at.map(([x, z]) => piece("plant", x, z));

const lights = (...at: Array<[number, number]>): Furniture[] =>
  at.map(([x, z]) => piece("light", x, z));

const OPEN_FLOOR_SHELL: Shell = {
  width: 24,
  depth: 16,
  walls: [],
  glass: [],
  floors: [],
  zones: [],
  areas: [
    {
      id: "desks",
      label: "Desk area",
      rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 4.5 },
    },
    {
      id: "entrance",
      label: "Entrance",
      rect: { minX: -12, maxX: 12, minZ: 4.5, maxZ: 8 },
    },
    {
      id: "open-floor",
      label: "Open floor",
      rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 },
    },
  ],
  boards: [
    {
      id: "wall-west",
      zone: null,
      facing: "south",
      face: -7.85,
      along: -6,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
    {
      id: "wall-east",
      zone: null,
      facing: "south",
      face: -7.85,
      along: 6,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
  ],
  screens: [],
  spawn: { area: { minX: -3, maxX: 3, minZ: 5.8, maxZ: 7 }, yaw: 0 },
};

const OPEN_FLOOR_FURNITURE: Furniture[] = [
  ...[-4.5, -1, 2.5].flatMap((z) =>
    [-7.5, -2.5, 2.5, 7.5].flatMap((x) => workstation(x, z)),
  ),
  ...plants([-11, -7.2], [0, -7.2], [11, -7.2], [-11, 7.2], [11, 7.2]),
  ...lights([-6, -3], [0, -3], [6, -3], [-6, 3], [0, 3], [6, 3]),
];

const MEETING_FLOOR_SHELL: Shell = {
  width: 36,
  depth: 20,
  walls: [],
  glass: [
    // Between the rooms, from the north wall to the south glass
    { x: -6, z: -6, width: 0.15, depth: 8 },
    { x: 6, z: -6, width: 0.15, depth: 8 },
    // The south side of each room, leaving a doorway at the corner next to the glass between them
    { x: -13.5, z: -2, width: 9, depth: 0.15 },
    { x: -1.5, z: -2, width: 9, depth: 0.15 },
    { x: 13.5, z: -2, width: 9, depth: 0.15 },
  ],
  floors: [
    { x: -12, z: -6, width: 11.7, depth: 7.7, tone: "meeting" },
    { x: 0, z: -6, width: 11.7, depth: 7.7, tone: "meeting" },
    { x: 12, z: -6, width: 11.7, depth: 7.7, tone: "meeting" },
    { x: 12, z: 6.4, width: 10, depth: 6.9, tone: "lounge" },
  ],
  zones: [
    {
      id: "room-a",
      label: "Meeting room A",
      rect: { minX: -17.85, maxX: -6.075, minZ: -9.85, maxZ: -2.075 },
    },
    {
      id: "room-b",
      label: "Meeting room B",
      rect: { minX: -5.925, maxX: 5.925, minZ: -9.85, maxZ: -2.075 },
    },
    {
      id: "room-c",
      label: "Meeting room C",
      rect: { minX: 6.075, maxX: 17.85, minZ: -9.85, maxZ: -2.075 },
    },
  ],
  areas: [
    {
      id: "room-a",
      label: "Meeting room A",
      rect: { minX: -18, maxX: -6, minZ: -10, maxZ: -2 },
    },
    {
      id: "room-b",
      label: "Meeting room B",
      rect: { minX: -6, maxX: 6, minZ: -10, maxZ: -2 },
    },
    {
      id: "room-c",
      label: "Meeting room C",
      rect: { minX: 6, maxX: 18, minZ: -10, maxZ: -2 },
    },
    {
      id: "lounge",
      label: "Lounge",
      rect: { minX: 7, maxX: 18, minZ: 3, maxZ: 10 },
    },
    {
      id: "reception",
      label: "Reception",
      rect: { minX: -18, maxX: -8, minZ: 3, maxZ: 10 },
    },
    {
      id: "open-area",
      label: "Open area",
      rect: { minX: -18, maxX: 18, minZ: -10, maxZ: 10 },
    },
  ],
  boards: [
    {
      id: "room-a",
      zone: "room-a",
      facing: "east",
      face: -17.85,
      along: -6,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
    {
      id: "room-b",
      zone: "room-b",
      facing: "south",
      face: -9.85,
      along: -3.2,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
    {
      id: "room-c",
      zone: "room-c",
      facing: "west",
      face: 17.85,
      along: -6,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    },
  ],
  screens: [
    {
      id: "room-a",
      zone: "room-a",
      facing: "south",
      face: -9.85,
      along: -12,
      y: 1.8,
      width: 3.3,
    },
    {
      id: "room-b",
      zone: "room-b",
      facing: "south",
      face: -9.85,
      along: 3,
      y: 1.8,
      width: 3.3,
    },
    {
      id: "room-c",
      zone: "room-c",
      facing: "south",
      face: -9.85,
      along: 12,
      y: 1.8,
      width: 3.3,
    },
  ],
  spawn: { area: { minX: -4, maxX: 4, minZ: 7.2, maxZ: 8.8 }, yaw: 0 },
};

const MEETING_FLOOR_FURNITURE: Furniture[] = [
  ...conference(-12, -6),
  ...conference(0, -6),
  ...conference(12, -6),
  ...plants(
    [-17.2, -9.2],
    [-17.2, -2.9],
    [-5.2, -9.2],
    [5.2, -9.2],
    [17.2, -9.2],
    [17.2, -2.9],
  ),
  // The lounge in the south-east corner
  piece("rug", 12, 6.4),
  piece("sofa", 12, 9.05),
  piece("island", 12, 5.2),
  ...plants([16.8, 3.4], [16.8, 9.2], [7.4, 9.2]),
  // The reception in the south-west corner
  piece("reception-desk", -12, 8.5),
  ...plants([-17.2, 9.2], [-17.2, 3.4]),
  ...lights([-12, -6], [0, -6], [12, -6], [-12, 4], [0, 4], [12, 4]),
];

const LOUNGE_SHELL: Shell = {
  width: 28,
  depth: 18,
  walls: [],
  glass: [],
  floors: [{ x: 4.5, z: -0.5, width: 17, depth: 12, tone: "lounge" }],
  zones: [],
  areas: [
    {
      id: "bar",
      label: "Bar",
      rect: { minX: -14, maxX: -4, minZ: -9, maxZ: -2 },
    },
    {
      id: "seating",
      label: "Seating",
      rect: { minX: 3, maxX: 14, minZ: -6.5, maxZ: 6 },
    },
    {
      id: "entrance",
      label: "Entrance",
      rect: { minX: -14, maxX: 14, minZ: 6, maxZ: 9 },
    },
    {
      id: "lounge",
      label: "Lounge",
      rect: { minX: -14, maxX: 14, minZ: -9, maxZ: 9 },
    },
  ],
  boards: [],
  screens: [],
  spawn: { area: { minX: -3, maxX: 3, minZ: 6.4, maxZ: 7.9 }, yaw: 0 },
};

const LOUNGE_FURNITURE: Furniture[] = [
  piece("counter", -9.2, -8.3),
  piece("island", -9.2, -5.4),
  piece("rug", 7, -0.5),
  piece("sofa", 7, -4.2, 180),
  piece("sofa", 7, 3.2),
  piece("sofa", 12.4, -0.5, 90),
  piece("sofa", -8, 7.9),
  ...plants(
    [-13.3, -1],
    [-13.3, 8.2],
    [13.3, 8.2],
    [13.3, -8.2],
    [0, -8.3],
    [0, 3],
  ),
  ...lights([-8, -4], [0, -4], [8, -4], [-8, 3], [0, 3], [8, 3]),
];

export const FLOOR_TEMPLATES: readonly FloorTemplate[] = [
  {
    id: DEFAULT_TEMPLATE_ID,
    name: "Open office",
    description:
      "The classic office: open desks, a glass meeting room, a kitchen, a lounge and a reception.",
    shell: DEFAULT_SHELL,
    furniture: OFFICE_FURNITURE,
    models: OFFICE_MODELS,
  },
  {
    id: "open",
    name: "Open floor",
    description:
      "One big open space with rows of desks and boards on a wall. No private rooms.",
    shell: OPEN_FLOOR_SHELL,
    furniture: OPEN_FLOOR_FURNITURE,
    models: [],
  },
  {
    id: "meeting",
    name: "Meeting floor",
    description:
      "Three private meeting rooms with glass walls, a board and a screen each, and a small lounge.",
    shell: MEETING_FLOOR_SHELL,
    furniture: MEETING_FLOOR_FURNITURE,
    models: [],
  },
  {
    id: "lounge",
    name: "Lounge",
    description:
      "A relaxed floor with sofas, a counter and plants. No private rooms.",
    shell: LOUNGE_SHELL,
    furniture: LOUNGE_FURNITURE,
    models: [],
  },
];

/** The template with this id, or undefined. */
export function templateById(id: string): FloorTemplate | undefined {
  return FLOOR_TEMPLATES.find((template) => template.id === id);
}

/**
 * The template a request asks for: none means the default one, and anything
 * that is not the id of a template is refused (null).
 */
export function sanitizeTemplateId(raw: unknown): string | null {
  if (raw === undefined) return DEFAULT_TEMPLATE_ID;
  if (typeof raw !== "string") return null;
  return templateById(raw) ? raw : null;
}
