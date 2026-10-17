import type { Box } from "./collision.ts";
import { OFFICE_HEIGHT, PLAYER_RADIUS, WALL_THICKNESS } from "./constants.ts";

/**
 * The shell of a floor as data: its size, the walls and the glass, the private
 * zones (voice rooms), the named areas, the whiteboards and screens that hang
 * on walls, and where people appear. Everything that used to be fixed code
 * (the same shell on every floor) reads it from here, so a floor can differ in
 * shape from the others. It travels with the floor's layout version.
 *
 * Every number is in meters, rounded to a millimetre. `sanitizeShell` makes
 * untrusted input into a shell (or says it is not one) and `findShellProblems`
 * says what would make a shell unusable.
 */

/** A rectangle on the floor given by its middle and its size. */
export interface Slab {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** The way a flat surface looks: the direction of the arrow that comes out of it. */
export type Facing = "north" | "south" | "east" | "west";

export const FACINGS: readonly Facing[] = ["north", "south", "east", "west"];

/** A private zone: whoever is inside talks only with the others inside (its own voice room). */
export interface ShellZone {
  id: string;
  label: string;
  rect: Box;
}

/** A named part of the floor, only so people can say where they are: it changes nothing about who hears whom. */
export interface ShellArea {
  id: string;
  label: string;
  rect: Box;
}

/**
 * A whiteboard on a wall. It belongs to a zone: only the people in it see what
 * is drawn. With no zone (`null`) it belongs to the open floor: everybody who is
 * in no private zone sees it, and anybody there can draw on it.
 */
export interface ShellBoard {
  id: string;
  zone: string | null;
  facing: Facing;
  /** The coordinate of the wall face it hangs on: z for a board facing north or south, x for east or west. */
  face: number;
  /** Where its middle is along the wall: x for a board facing north or south, z for east or west. */
  along: number;
  /** The height of its middle above the floor. */
  y: number;
  /** The part that can be drawn on. */
  width: number;
  height: number;
}

/** A screen on a wall that shows what somebody in its zone is sharing. 16:9. */
export interface ShellScreen {
  id: string;
  zone: string;
  facing: Facing;
  face: number;
  along: number;
  y: number;
  /** The width of the picture. */
  width: number;
}

/** What the floor of a part is made of: a flat patch laid over the wooden floor. */
export type FloorTone = "meeting" | "lounge";

export const FLOOR_TONES: readonly FloorTone[] = ["meeting", "lounge"];

export interface ShellFloor extends Slab {
  tone: FloorTone;
}

export interface ShellSpawn {
  /** Where people appear: each one at a random spot of it. */
  area: Box;
  /** The way they look at first; 0 looks north. */
  yaw: number;
}

export interface Shell {
  /** West to east, in meters. */
  width: number;
  /** North to south. */
  depth: number;
  /** Fixed at 3.2 m for now: the lights, the posters and the camera are tuned to it. */
  height?: number;
  /** Walls inside the outer ones (which every floor has). */
  walls: Slab[];
  /** Glass walls: they block like walls and let the light through. */
  glass: Slab[];
  floors: ShellFloor[];
  zones: ShellZone[];
  areas: ShellArea[];
  boards: ShellBoard[];
  screens: ShellScreen[];
  spawn: ShellSpawn;
}

export const SHELL_LIMITS = {
  minWidth: 16,
  maxWidth: 48,
  minDepth: 12,
  maxDepth: 36,
  walls: 40,
  glass: 40,
  floors: 12,
  zones: 8,
  areas: 12,
  boards: 6,
  screens: 6,
  idLength: 24,
  labelLength: 32,
  /** The thickest and thinnest a wall may be. */
  minThickness: 0.05,
  maxThickness: 1,
  /** The smallest side of a zone, so somebody fits in it. */
  minZoneSide: 2,
  minSpawnWidth: 1,
  minSpawnDepth: 0.5,
} as const;

/** The thickness of the outer walls, which stand with their middle on the edge of the floor. */
export const OUTER_WALL = WALL_THICKNESS;

/** How far a board's frame stands from the wall face, and the layers on top of it. */
export const BOARD_FRAME_GAP = 0.03;
export const BOARD_PANEL_GAP = 0.01;
export const BOARD_FRAME_THICKNESS = 0.04;
export const BOARD_PANEL_THICKNESS = 0.05;
export const BOARD_PANEL_HALF = 0.025;
export const BOARD_SURFACE_GAP = 0.004;
export const BOARD_FRAME_MARGIN = 0.1;
export const SCREEN_FRAME_THICKNESS = 0.06;
export const SCREEN_SURFACE_GAP = 0.004;
export const SCREEN_FRAME_MARGIN = 0.1;
export const SCREEN_FRAME_PAD = 0.14;
export const SCREEN_MIN_FRAME_HEIGHT = 2;

const BOARD_WIDTH = { min: 1, max: 5 } as const;
const BOARD_HEIGHT = { min: 0.6, max: 2.4 } as const;
const SCREEN_WIDTH = { min: 1.5, max: 4.5 } as const;
/** How far a zone's rectangle may be from the wall a board or screen hangs on, so people can reach it. */
const MOUNT_REACH = 0.5;
const TOLERANCE = 0.021;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** The kinds of part a shell is made of, the way the editor points at them. */
export type ShellKind =
  "wall" | "glass" | "floor" | "zone" | "area" | "board" | "screen" | "spawn";

/** One part of a shell: its kind and its place in that kind's list (the spawn is always 0). */
export interface ShellRef {
  kind: ShellKind;
  index: number;
}

export interface ShellProblem {
  /** What the problem is about, when it is about particular parts (not the size, the counts). */
  refs?: ShellRef[];
  code:
    | "size"
    | "count"
    | "bounds"
    | "duplicate"
    | "zone"
    | "area"
    | "mount"
    | "spawn";
  /** In words a person can act on. */
  message: string;
}

const NORMALS: Record<Facing, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 },
};

/** To the right of somebody who looks at a surface that faces them. */
const RIGHTS: Record<Facing, { x: number; z: number }> = {
  north: { x: -1, z: 0 },
  south: { x: 1, z: 0 },
  east: { x: 0, z: -1 },
  west: { x: 0, z: 1 },
};

export const normalOf = (facing: Facing) => NORMALS[facing];
export const rightOf = (facing: Facing) => RIGHTS[facing];

const round = (value: number) => Math.round(value * 1000) / 1000;

export function slabBox(slab: Slab): Box {
  return {
    minX: slab.x - slab.width / 2,
    maxX: slab.x + slab.width / 2,
    minZ: slab.z - slab.depth / 2,
    maxZ: slab.z + slab.depth / 2,
  };
}

/** The walls every floor has around it, with their middle on the edge of the floor. */
export function outerWalls(shell: Pick<Shell, "width" | "depth">): Slab[] {
  const { width, depth } = shell;
  return [
    { x: 0, z: -depth / 2, width, depth: OUTER_WALL },
    { x: 0, z: depth / 2, width, depth: OUTER_WALL },
    { x: -width / 2, z: 0, width: OUTER_WALL, depth },
    { x: width / 2, z: 0, width: OUTER_WALL, depth },
  ];
}

/** The floor inside the outer walls: the furniture has to stay within it. */
export function shellFloorBox(shell: Pick<Shell, "width" | "depth">): Box {
  return {
    minX: -shell.width / 2 + OUTER_WALL / 2,
    maxX: shell.width / 2 - OUTER_WALL / 2,
    minZ: -shell.depth / 2 + OUTER_WALL / 2,
    maxZ: shell.depth / 2 - OUTER_WALL / 2,
  };
}

/** Where a board's frame, its panel and the surface that is drawn on stand, as a distance from the wall face along its normal. */
export function boardLayers(board: ShellBoard) {
  const n = normalOf(board.facing);
  const along = board.facing === "east" || board.facing === "west" ? "x" : "z";
  const sign = n[along];
  const frame = board.face + sign * BOARD_FRAME_GAP;
  const panel = frame + sign * BOARD_PANEL_GAP;
  const surface = panel + sign * BOARD_PANEL_HALF + sign * BOARD_SURFACE_GAP;
  return { frame, panel, surface };
}

/** The same for a screen: its frame, and the picture just in front of it. */
export function screenLayers(screen: ShellScreen) {
  const n = normalOf(screen.facing);
  const axis = screen.facing === "east" || screen.facing === "west" ? "x" : "z";
  const sign = n[axis];
  const frame = screen.face + sign * BOARD_FRAME_GAP;
  const surface =
    screen.face + sign * SCREEN_FRAME_THICKNESS + sign * SCREEN_SURFACE_GAP;
  return { frame, surface };
}

/** A screen's picture is 16:9. */
export const screenPictureHeight = (screen: ShellScreen) =>
  (screen.width * 9) / 16;

/** The height of a screen's frame: a little more than its picture, never less than two meters. */
export const screenFrameHeight = (screen: ShellScreen) =>
  Math.max(
    SCREEN_MIN_FRAME_HEIGHT,
    round(screenPictureHeight(screen) + SCREEN_FRAME_PAD),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function num(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return round(value);
}

/** A name for people: no control characters, single spaces, short. Null when nothing is left. */
function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SHELL_LIMITS.labelLength)
    .trim();
  return label || null;
}

function cleanId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < 1 || raw.length > SHELL_LIMITS.idLength) return null;
  return SLUG.test(raw) ? raw : null;
}

const COORD = 60;

function slabOf(raw: unknown): Slab | null {
  if (!isRecord(raw)) return null;
  const x = num(raw.x, -COORD, COORD);
  const z = num(raw.z, -COORD, COORD);
  const width = num(raw.width, 0.01, 2 * COORD);
  const depth = num(raw.depth, 0.01, 2 * COORD);
  if (x === null || z === null || width === null || depth === null) return null;
  return { x, z, width, depth };
}

function boxOf(raw: unknown): Box | null {
  if (!isRecord(raw)) return null;
  const minX = num(raw.minX, -COORD, COORD);
  const maxX = num(raw.maxX, -COORD, COORD);
  const minZ = num(raw.minZ, -COORD, COORD);
  const maxZ = num(raw.maxZ, -COORD, COORD);
  if (minX === null || maxX === null || minZ === null || maxZ === null)
    return null;
  return { minX, maxX, minZ, maxZ };
}

function listOf<T>(
  raw: unknown,
  limit: number,
  one: (item: unknown) => T | null,
) {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    if (out.length >= limit) break;
    const clean = one(item);
    if (clean) out.push(clean);
  }
  return out;
}

const facingOf = (raw: unknown): Facing | null =>
  FACINGS.find((facing) => facing === raw) ?? null;

function mountOf(raw: Record<string, unknown>, orFloor: boolean) {
  const id = cleanId(raw.id);
  const zone =
    orFloor && raw.zone === null ? null : (cleanId(raw.zone) ?? undefined);
  const facing = facingOf(raw.facing);
  const face = num(raw.face, -COORD, COORD);
  const along = num(raw.along, -COORD, COORD);
  const y = num(raw.y, 0, 10);
  if (
    !id ||
    zone === undefined ||
    !facing ||
    face === null ||
    along === null ||
    y === null
  )
    return null;
  return { id, zone, facing, face, along, y };
}

function boardOf(raw: unknown): ShellBoard | null {
  if (!isRecord(raw)) return null;
  const mount = mountOf(raw, true);
  const width = num(raw.width, BOARD_WIDTH.min, BOARD_WIDTH.max);
  const height = num(raw.height, BOARD_HEIGHT.min, BOARD_HEIGHT.max);
  if (!mount || width === null || height === null) return null;
  return { ...mount, width, height };
}

function screenOf(raw: unknown): ShellScreen | null {
  if (!isRecord(raw)) return null;
  const mount = mountOf(raw, false);
  const width = num(raw.width, SCREEN_WIDTH.min, SCREEN_WIDTH.max);
  if (!mount || mount.zone === null || width === null) return null;
  return { ...mount, zone: mount.zone, width };
}

function namedRect(raw: unknown): ShellZone | null {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  const label = cleanLabel(raw.label);
  const rect = boxOf(raw.rect);
  if (!id || !label || !rect) return null;
  return { id, label, rect };
}

function floorOf(raw: unknown): ShellFloor | null {
  const slab = slabOf(raw);
  if (!slab || !isRecord(raw)) return null;
  const tone = FLOOR_TONES.find((candidate) => candidate === raw.tone);
  return tone ? { ...slab, tone } : null;
}

/**
 * Makes untrusted input into a shell: numbers are checked and rounded to a
 * millimetre, texts are cleaned, and whatever is not a valid entry of a list
 * is left out (so a bad stored shell cannot break a floor). Null when it is
 * not a shell at all: no size, or nowhere for people to appear. A shell that
 * comes out of this can still have problems: see `findShellProblems`.
 */
export function sanitizeShell(raw: unknown): Shell | null {
  if (!isRecord(raw)) return null;
  const width = num(raw.width, SHELL_LIMITS.minWidth, SHELL_LIMITS.maxWidth);
  const depth = num(raw.depth, SHELL_LIMITS.minDepth, SHELL_LIMITS.maxDepth);
  const area = isRecord(raw.spawn) ? boxOf(raw.spawn.area) : null;
  const yaw =
    isRecord(raw.spawn) &&
    typeof raw.spawn.yaw === "number" &&
    Number.isFinite(raw.spawn.yaw)
      ? raw.spawn.yaw
      : null;
  if (width === null || depth === null || !area || yaw === null) return null;
  const shell: Shell = {
    width,
    depth,
    walls: listOf(raw.walls, SHELL_LIMITS.walls, slabOf),
    glass: listOf(raw.glass, SHELL_LIMITS.glass, slabOf),
    floors: listOf(raw.floors, SHELL_LIMITS.floors, floorOf),
    zones: listOf(raw.zones, SHELL_LIMITS.zones, namedRect),
    areas: listOf(raw.areas, SHELL_LIMITS.areas, namedRect),
    boards: listOf(raw.boards, SHELL_LIMITS.boards, boardOf),
    screens: listOf(raw.screens, SHELL_LIMITS.screens, screenOf),
    spawn: { area, yaw },
  };
  if (raw.height !== undefined) {
    const height = num(raw.height, 0, 20);
    if (height === null) return null;
    shell.height = height;
  }
  return shell;
}

const overlaps = (a: Box, b: Box, margin = 0) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > margin &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > margin;

const inside = (box: Box, floor: Box) =>
  box.minX >= floor.minX - TOLERANCE &&
  box.maxX <= floor.maxX + TOLERANCE &&
  box.minZ >= floor.minZ - TOLERANCE &&
  box.maxZ <= floor.maxZ + TOLERANCE;

const proper = (box: Box) => box.maxX > box.minX && box.maxZ > box.minZ;

/** Every wall that blocks: the outer ones, the walls inside, and the glass. */
export function wallBoxes(shell: Shell): Box[] {
  return [
    ...outerWalls(shell).map(slabBox),
    ...shell.walls.map(slabBox),
    ...shell.glass.map(slabBox),
  ];
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const again = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) again.add(value);
    seen.add(value);
  }
  return [...again];
}

/** The wall boxes a board or a screen may hang on (glass does not count). */
const solidWalls = (shell: Shell): Box[] => [
  ...outerWalls(shell).map(slabBox),
  ...shell.walls.map(slabBox),
];

/** Whether a surface of `span` meters around `along`, facing `facing`, is on a face of one of the walls. */
function onAWall(
  walls: Box[],
  mount: { facing: Facing; face: number; along: number },
  span: number,
): boolean {
  const half = span / 2;
  return walls.some((wall) => {
    const sideAxis = mount.facing === "east" || mount.facing === "west";
    const [min, max] = sideAxis
      ? [wall.minZ, wall.maxZ]
      : [wall.minX, wall.maxX];
    if (mount.along - half < min - TOLERANCE) return false;
    if (mount.along + half > max + TOLERANCE) return false;
    const plane =
      mount.facing === "east"
        ? wall.maxX
        : mount.facing === "west"
          ? wall.minX
          : mount.facing === "south"
            ? wall.maxZ
            : wall.minZ;
    return Math.abs(plane - mount.face) <= TOLERANCE;
  });
}

/** How far a point is from a rectangle (0 inside it). */
function distanceTo(box: Box, x: number, z: number): number {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dz = Math.max(z - box.maxZ, box.minZ - z, 0);
  return Math.hypot(dx, dz);
}

/**
 * Everything wrong with a shell: sizes and counts outside what the game can
 * draw, parts past the walls, repeated ids or names, zones that overlap or are
 * too small, boards and screens that hang on no wall or face away from their
 * zone, and a spawn area that is blocked. Empty when the shell is usable.
 */
export function findShellProblems(shell: Shell): ShellProblem[] {
  const problems: ShellProblem[] = [];
  const add = (
    code: ShellProblem["code"],
    message: string,
    refs?: ShellRef[],
  ) => problems.push(refs ? { code, message, refs } : { code, message });
  const L = SHELL_LIMITS;

  if (
    !(shell.width >= L.minWidth && shell.width <= L.maxWidth) ||
    !(shell.depth >= L.minDepth && shell.depth <= L.maxDepth)
  )
    add(
      "size",
      `The floor must be ${L.minWidth} to ${L.maxWidth} m wide and ${L.minDepth} to ${L.maxDepth} m deep.`,
    );
  if (shell.height !== undefined && shell.height !== OFFICE_HEIGHT)
    add("size", `The height is fixed at ${OFFICE_HEIGHT} m for now.`);

  const counts: Array<[string, number, number]> = [
    ["walls", shell.walls.length, L.walls],
    ["glass walls", shell.glass.length, L.glass],
    ["floor patches", shell.floors.length, L.floors],
    ["private zones", shell.zones.length, L.zones],
    ["areas", shell.areas.length, L.areas],
    ["boards", shell.boards.length, L.boards],
    ["screens", shell.screens.length, L.screens],
  ];
  for (const [what, count, limit] of counts)
    if (count > limit)
      add("count", `At most ${limit} ${what} (there are ${count}).`);

  const floor = shellFloorBox(shell);
  /** Walls and areas go from the middle of the outer walls, so they may cover their thickness. */
  const edge: Box = {
    minX: -shell.width / 2,
    maxX: shell.width / 2,
    minZ: -shell.depth / 2,
    maxZ: shell.depth / 2,
  };

  const checkSlabs = (
    what: string,
    kind: ShellKind,
    slabs: Slab[],
    within: Box,
  ) => {
    slabs.forEach((slab, index) => {
      const box = slabBox(slab);
      const thin = Math.min(slab.width, slab.depth);
      const refs = [{ kind, index }];
      if (!(slab.width > 0 && slab.depth > 0) || thin < L.minThickness)
        add(
          "bounds",
          `The ${what} ${index + 1} is too thin or has no size.`,
          refs,
        );
      else if (what !== "floor patch" && thin > L.maxThickness)
        add("bounds", `The ${what} ${index + 1} is too thick.`, refs);
      if (!inside(box, within))
        add(
          "bounds",
          `The ${what} ${index + 1} sticks out past the floor.`,
          refs,
        );
    });
  };
  checkSlabs("wall", "wall", shell.walls, edge);
  checkSlabs("glass wall", "glass", shell.glass, edge);
  checkSlabs("floor patch", "floor", shell.floors, floor);

  const checkRects = (
    what: "zone" | "area",
    list: Array<{ id: string; label: string; rect: Box }>,
  ) => {
    const refsOf = (match: (entry: { id: string; label: string }) => boolean) =>
      list.flatMap((entry, index) =>
        match(entry) ? [{ kind: what, index }] : [],
      );
    for (const id of duplicates(list.map((entry) => entry.id)))
      add(
        "duplicate",
        `Two ${what}s have the id "${id}".`,
        refsOf((entry) => entry.id === id),
      );
    for (const label of duplicates(
      list.map((entry) => entry.label.toLowerCase()),
    ))
      add(
        "duplicate",
        `Two ${what}s are called "${label}".`,
        refsOf((entry) => entry.label.toLowerCase() === label),
      );
    list.forEach((entry, index) => {
      const refs = [{ kind: what, index }];
      if (!SLUG.test(entry.id) || entry.id.length > L.idLength)
        add(
          what,
          `The ${what} id "${entry.id}" must be lowercase letters, digits and single hyphens (up to ${L.idLength}).`,
          refs,
        );
      if (!entry.label.trim() || entry.label.length > L.labelLength)
        add(
          what,
          `The ${what} "${entry.id}" needs a name of up to ${L.labelLength} characters.`,
          refs,
        );
      if (!proper(entry.rect))
        add(what, `The ${what} "${entry.label}" has no area.`, refs);
      else if (!inside(entry.rect, what === "zone" ? floor : edge))
        add(
          what,
          `The ${what} "${entry.label}" sticks out past the floor.`,
          refs,
        );
    });
  };
  checkRects("zone", shell.zones);
  checkRects("area", shell.areas);

  shell.zones.forEach((zone, index) => {
    const { rect } = zone;
    if (
      proper(rect) &&
      (rect.maxX - rect.minX < L.minZoneSide ||
        rect.maxZ - rect.minZ < L.minZoneSide)
    )
      add(
        "zone",
        `The zone "${zone.label}" is too small: each side must be at least ${L.minZoneSide} m.`,
        [{ kind: "zone", index }],
      );
  });
  for (let a = 0; a < shell.zones.length; a++)
    for (let b = a + 1; b < shell.zones.length; b++)
      if (overlaps(shell.zones[a].rect, shell.zones[b].rect, 0.01))
        add(
          "zone",
          `The zones "${shell.zones[a].label}" and "${shell.zones[b].label}" overlap.`,
          [
            { kind: "zone", index: a },
            { kind: "zone", index: b },
          ],
        );

  const walls = solidWalls(shell);
  const checkMounts = (
    what: "board" | "screen",
    list: Array<ShellBoard | ShellScreen>,
  ) => {
    for (const id of duplicates(list.map((entry) => entry.id)))
      add(
        "duplicate",
        `Two ${what}s have the id "${id}".`,
        list.flatMap((entry, index) =>
          entry.id === id ? [{ kind: what, index }] : [],
        ),
      );
    list.forEach((mount, index) => {
      const refs = [{ kind: what, index }];
      const named = `The ${what} "${mount.id}"`;
      if (!SLUG.test(mount.id) || mount.id.length > L.idLength)
        add(
          "mount",
          `${named} needs an id of lowercase letters, digits and hyphens.`,
          refs,
        );
      const zone =
        mount.zone === null
          ? null
          : shell.zones.find((candidate) => candidate.id === mount.zone);
      if (zone === undefined) {
        add(
          "mount",
          `${named} belongs to a zone that does not exist ("${mount.zone}").`,
          refs,
        );
        return;
      }
      const span = mount.width;
      const height =
        what === "board"
          ? (mount as ShellBoard).height
          : screenPictureHeight(mount as ShellScreen);
      if (!onAWall(walls, mount, span))
        add("mount", `${named} does not hang on a wall.`, refs);
      if (
        mount.y - height / 2 < 0 ||
        mount.y + height / 2 > (shell.height ?? OFFICE_HEIGHT)
      )
        add("mount", `${named} sticks out above or below the wall.`, refs);
      const sideAxis = mount.facing === "east" || mount.facing === "west";
      const point = sideAxis
        ? { x: mount.face, z: mount.along }
        : { x: mount.along, z: mount.face };
      const normal = normalOf(mount.facing);
      if (zone === null) {
        // Of the open floor: it must not be inside a private room, where only that room could reach it
        const reached = shell.zones.find(
          (candidate) =>
            distanceTo(candidate.rect, point.x, point.z) <= MOUNT_REACH,
        );
        if (reached)
          add(
            "mount",
            `${named} is for the open floor but hangs in "${reached.label}".`,
            refs,
          );
        return;
      }
      const center = {
        x: (zone.rect.minX + zone.rect.maxX) / 2,
        z: (zone.rect.minZ + zone.rect.maxZ) / 2,
      };
      const towards =
        (center.x - point.x) * normal.x + (center.z - point.z) * normal.z;
      if (towards <= 0)
        add(
          "mount",
          `${named} faces away from its zone "${zone.label}".`,
          refs,
        );
      if (distanceTo(zone.rect, point.x, point.z) > MOUNT_REACH)
        add(
          "mount",
          `${named} is too far from its zone "${zone.label}" to be reached.`,
          refs,
        );
    });
  };
  checkMounts("board", shell.boards);
  checkMounts("screen", shell.screens);

  const spawnRef: ShellRef[] = [{ kind: "spawn", index: 0 }];
  const { area } = shell.spawn;
  if (!proper(area) || !inside(area, floor))
    add(
      "spawn",
      "The place where people appear must be on the floor.",
      spawnRef,
    );
  else {
    if (
      area.maxX - area.minX < L.minSpawnWidth ||
      area.maxZ - area.minZ < L.minSpawnDepth
    )
      add("spawn", "The place where people appear is too small.", spawnRef);
    const clear: Box = {
      minX: area.minX - PLAYER_RADIUS,
      maxX: area.maxX + PLAYER_RADIUS,
      minZ: area.minZ - PLAYER_RADIUS,
      maxZ: area.maxZ + PLAYER_RADIUS,
    };
    if (wallBoxes(shell).some((wall) => overlaps(wall, clear, 1e-6)))
      add(
        "spawn",
        "The place where people appear is blocked by a wall.",
        spawnRef,
      );
    if (shell.zones.some((zone) => overlaps(zone.rect, area, 1e-6)))
      add("spawn", "People would appear inside a private zone.", spawnRef);
  }
  if (!Number.isFinite(shell.spawn.yaw))
    add(
      "spawn",
      "The way people look when they appear is not a number.",
      spawnRef,
    );

  return problems;
}
