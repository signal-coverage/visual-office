import type { Box } from "../../shared/collision.ts";
import {
  furnitureExtent,
  isFlat,
  type Furniture,
} from "../../shared/furniture.ts";
import { footprintCollider, type PropPlacement } from "../../shared/props.ts";
import {
  findShellProblems,
  normalOf,
  outerWalls,
  SHELL_LIMITS,
  shellFloorBox,
  slabBox,
  type Facing,
  type FloorTone,
  type Shell,
  type ShellBoard,
  type ShellKind,
  type ShellRef,
  type ShellScreen,
  type Slab,
} from "../../shared/shell.ts";
import { snap } from "./snap";

/** A point on the floor: x east, z south, in meters. */
export type Point = readonly [number, number];

/** What adding a part gives: the new shell and the part, or the reason it was not added. */
export type Edit = { shell: Shell; ref: ShellRef } | { error: string };

/** What changing a part gives: the new shell, or the reason it was not changed. */
export type Change = { shell: Shell } | { error: string };

export type MountKind = "board" | "screen";

/** How thick a wall or a glass wall is when it is drawn as a line. */
export const THICKNESS = { wall: 0.2, glass: 0.15 } as const;
/** The shortest wall that is worth drawing: anything less is a click. */
const MIN_LENGTH = 0.25;
/** A drag with a side shorter than this is a click. */
const CLICK_SIDE = 0.2;
/** A drag across a wall's thickness: below it, jitter (a line); up to the thickest a wall may be, a block. */
const BLOCK_FROM = 0.5;
/** The least that makes a room, an area or a patch, by kind. */
export const MIN_SIDES = {
  zone: { width: SHELL_LIMITS.minZoneSide, depth: SHELL_LIMITS.minZoneSide },
  area: { width: 1, depth: 1 },
  floor: { width: 1, depth: 1 },
  spawn: {
    width: SHELL_LIMITS.minSpawnWidth,
    depth: SHELL_LIMITS.minSpawnDepth,
  },
} as const;

const BOARD = { width: 2.6, height: 1.3, y: 1.6, min: 1 } as const;
const SCREEN = { width: 3.3, y: 1.8, min: 1.5 } as const;
/** How far from a wall a click still hangs a board or a screen on it. */
const ATTACH_REACH = 1.5;
/** How far a dragged board or screen is looked for a wall. */
const DROP_REACH = 2;
/** How far from a thin wall or a board the pointer still picks it. */
const PICK_MARGIN = 0.15;
const PICK_BOARD = 0.3;
/** How far out of a wall face a board stands, for what it may not run into. */
const STRIP = 0.1;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const round = (value: number) => Math.round(value * 1000) / 1000 + 0;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const proper = (box: Box) => box.maxX > box.minX && box.maxZ > box.minZ;

/** A name the way the game keeps it: no control characters, single spaces. */
function cleanName(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

/** A name as an id: lowercase letters, digits and single hyphens, as long as an id may be. Empty when nothing is left. */
export function slugOf(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SHELL_LIMITS.idLength)
    .replace(/-+$/, "");
}

/** `base`, or `base-2`, `base-3`… the first that is not in `taken`. */
export function uniqueId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = `${base.slice(0, SHELL_LIMITS.idLength - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.includes(id)) return id;
  }
}

/** The box a wall may reach: the middle of the outer walls. */
export function edgeOf(shell: Pick<Shell, "width" | "depth">): Box {
  return {
    minX: -shell.width / 2,
    maxX: shell.width / 2,
    minZ: -shell.depth / 2,
    maxZ: shell.depth / 2,
  };
}

const clampPoint = (point: Point, within: Box): Point => [
  clamp(point[0], within.minX, within.maxX),
  clamp(point[1], within.minZ, within.maxZ),
];

/**
 * A wall drawn by dragging from one corner to another. It is a line along the
 * longer side of the drag, snapped to the grid and to the axis, as thick as
 * `thickness`; a drag that is already between 0.5 m and 1 m across is the thick
 * wall that was drawn. Null for a click or a drag too short to be a wall.
 */
export function lineFromDrag(
  from: Point,
  to: Point,
  opts: { step: number; thickness: number; within: Box },
): Slab | null {
  const { step, thickness, within } = opts;
  const [ax, az] = clampPoint(
    [snap(from[0], step), snap(from[1], step)],
    within,
  );
  const [bx, bz] = clampPoint([snap(to[0], step), snap(to[1], step)], within);
  const dx = Math.abs(bx - ax);
  const dz = Math.abs(bz - az);
  const along = Math.max(dx, dz);
  const across = Math.min(dx, dz);
  if (along < MIN_LENGTH) return null;
  const alongX = dx >= dz;
  const block = across >= BLOCK_FROM && across <= SHELL_LIMITS.maxThickness;
  const crossStart = alongX ? az : ax;
  const crossEnd = alongX ? bz : bx;
  const thick = block ? across : thickness;
  const cross = block ? (crossStart + crossEnd) / 2 : crossStart;
  const middle = ((alongX ? ax : az) + (alongX ? bx : bz)) / 2;
  return alongX
    ? {
        x: round(middle),
        z: round(cross),
        width: round(along),
        depth: round(thick),
      }
    : {
        x: round(cross),
        z: round(middle),
        width: round(thick),
        depth: round(along),
      };
}

/**
 * A rectangle drawn by dragging from one corner to another: in whichever order,
 * snapped, kept inside `within`, and grown (away from where it started) to the
 * least side that kind of part needs. Null for a click.
 */
export function rectFromDrag(
  from: Point,
  to: Point,
  opts: {
    step: number;
    within: Box;
    min: { readonly width: number; readonly depth: number };
  },
): Box | null {
  const { step, within, min } = opts;
  const [ax, az] = clampPoint(
    [snap(from[0], step), snap(from[1], step)],
    within,
  );
  const [bx, bz] = clampPoint([snap(to[0], step), snap(to[1], step)], within);
  if (Math.abs(bx - ax) < CLICK_SIDE && Math.abs(bz - az) < CLICK_SIDE)
    return null;
  const side = (
    start: number,
    end: number,
    least: number,
    low: number,
    high: number,
  ): [number, number] => {
    let [lo, hi] = start <= end ? [start, end] : [end, start];
    if (hi - lo < least) {
      if (end >= start) hi = lo + least;
      else lo = hi - least;
    }
    if (hi > high) [lo, hi] = [high - (hi - lo), high];
    if (lo < low) [lo, hi] = [low, low + (hi - lo)];
    return [round(lo), round(hi)];
  };
  const [minX, maxX] = side(ax, bx, min.width, within.minX, within.maxX);
  const [minZ, maxZ] = side(az, bz, min.depth, within.minZ, within.maxZ);
  return { minX, maxX, minZ, maxZ };
}

const slabOfBox = (
  box: Box,
  tone?: FloorTone,
): Slab & { tone?: FloorTone } => ({
  x: round((box.minX + box.maxX) / 2),
  z: round((box.minZ + box.maxZ) / 2),
  width: round(box.maxX - box.minX),
  depth: round(box.maxZ - box.minZ),
  ...(tone ? { tone } : {}),
});

const taken = (shell: Shell, kind: "zone" | "area") =>
  (kind === "zone" ? shell.zones : shell.areas).map((entry) => entry.id);

/** Adds a wall or a glass wall. */
export function addWall(
  shell: Shell,
  kind: "wall" | "glass",
  slab: Slab,
): Edit {
  const list = kind === "wall" ? shell.walls : shell.glass;
  const limit = kind === "wall" ? SHELL_LIMITS.walls : SHELL_LIMITS.glass;
  if (list.length >= limit)
    return {
      error: `At most ${limit} ${kind === "wall" ? "walls" : "glass walls"}.`,
    };
  const next = [...list, { ...slab }];
  return {
    shell:
      kind === "wall" ? { ...shell, walls: next } : { ...shell, glass: next },
    ref: { kind, index: next.length - 1 },
  };
}

/** Why a name cannot be given to a zone or an area (or null when it can). `ignore` is the part that has it now. */
export function labelProblem(
  shell: Shell,
  kind: "zone" | "area",
  label: string,
  ignore?: number,
): string | null {
  const clean = cleanName(label);
  if (!clean) return "Give it a name.";
  if (clean.length > SHELL_LIMITS.labelLength)
    return `Use at most ${SHELL_LIMITS.labelLength} characters.`;
  const list = kind === "zone" ? shell.zones : shell.areas;
  const same = list.some(
    (entry, index) =>
      index !== ignore && entry.label.toLowerCase() === clean.toLowerCase(),
  );
  return same ? `There is already a ${kind} called "${clean}".` : null;
}

function addNamed(
  shell: Shell,
  kind: "zone" | "area",
  rect: Box,
  label: string,
): Edit {
  const list = kind === "zone" ? shell.zones : shell.areas;
  const limit = kind === "zone" ? SHELL_LIMITS.zones : SHELL_LIMITS.areas;
  if (list.length >= limit)
    return {
      error: `At most ${limit} ${kind === "zone" ? "private zones" : "areas"}.`,
    };
  if (!proper(rect)) return { error: `The ${kind} has no area.` };
  const problem = labelProblem(shell, kind, label);
  if (problem) return { error: problem };
  const clean = cleanName(label);
  const entry = {
    id: uniqueId(slugOf(clean) || kind, taken(shell, kind)),
    label: clean,
    rect: { ...rect },
  };
  const next = [...list, entry];
  return {
    shell:
      kind === "zone" ? { ...shell, zones: next } : { ...shell, areas: next },
    ref: { kind, index: next.length - 1 },
  };
}

/** A private room: whoever is in it talks only with the others in it. The id is made from the name. */
export const addZone = (shell: Shell, rect: Box, label: string): Edit =>
  addNamed(shell, "zone", rect, label);

/** A named part of the floor that changes nothing but the words people use. */
export const addArea = (shell: Shell, rect: Box, label: string): Edit =>
  addNamed(shell, "area", rect, label);

/** A patch of another floor material. */
export function addFloorPatch(shell: Shell, rect: Box, tone: FloorTone): Edit {
  if (shell.floors.length >= SHELL_LIMITS.floors)
    return { error: `At most ${SHELL_LIMITS.floors} floor patches.` };
  if (!proper(rect)) return { error: "The floor patch has no area." };
  const floors = [
    ...shell.floors,
    { ...slabOfBox(rect), tone } as Shell["floors"][number],
  ];
  return {
    shell: { ...shell, floors },
    ref: { kind: "floor", index: floors.length - 1 },
  };
}

/** Moves the place where people appear: its way of looking stays. */
export const setSpawnArea = (shell: Shell, area: Box): Shell => ({
  ...shell,
  spawn: { ...shell.spawn, area: { ...area } },
});

export const setSpawnYaw = (shell: Shell, yaw: number): Shell =>
  Number.isFinite(yaw) ? { ...shell, spawn: { ...shell.spawn, yaw } } : shell;

/** Every box that blocks, by whether it is solid (a board may hang on it) or glass. */
function blockers(shell: Shell): Array<{ box: Box; glass: boolean }> {
  return [
    ...outerWalls(shell).map((wall) => ({ box: slabBox(wall), glass: false })),
    ...shell.walls.map((wall) => ({ box: slabBox(wall), glass: false })),
    ...shell.glass.map((wall) => ({ box: slabBox(wall), glass: true })),
  ];
}

type Interval = [number, number];

function without(list: Interval[], [a, b]: Interval): Interval[] {
  return list.flatMap(([lo, hi]): Interval[] =>
    b <= lo || a >= hi
      ? [[lo, hi]]
      : [
          ...(a > lo ? [[lo, a] as Interval] : []),
          ...(b < hi ? [[b, hi] as Interval] : []),
        ],
  );
}

const overlapBy = (a: Box, b: Box) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-6 &&
  Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 1e-6;

const sideways = (facing: Facing) => facing === "north" || facing === "south";

/** A place a board may hang: a face of a wall, and the stretches of it that nothing else covers. */
interface Spot {
  facing: Facing;
  face: number;
  stretch: Interval;
  /** How far the click was from it. */
  distance: number;
  /** Where along the face the click is closest. */
  closest: number;
}

/** The faces of the solid walls that look into the floor, with what is free of them, nearest the click first. */
function spotsAt(
  shell: Shell,
  click: Point,
  span: number,
  reach: number,
): Spot[] {
  const floor = shellFloorBox(shell);
  const all = blockers(shell);
  const spots: Spot[] = [];
  all.forEach(({ box, glass }, own) => {
    if (glass) return;
    for (const facing of ["north", "south", "east", "west"] as const) {
      const n = normalOf(facing);
      const along = sideways(facing)
        ? ([box.minX, box.maxX] as Interval)
        : ([box.minZ, box.maxZ] as Interval);
      const plane =
        facing === "north"
          ? box.minZ
          : facing === "south"
            ? box.maxZ
            : facing === "east"
              ? box.maxX
              : box.minX;
      const strip: Box = sideways(facing)
        ? {
            minX: along[0],
            maxX: along[1],
            minZ: Math.min(plane, plane + n.z * STRIP),
            maxZ: Math.max(plane, plane + n.z * STRIP),
          }
        : {
            minX: Math.min(plane, plane + n.x * STRIP),
            maxX: Math.max(plane, plane + n.x * STRIP),
            minZ: along[0],
            maxZ: along[1],
          };
      const outside = sideways(facing)
        ? strip.minZ < floor.minZ - 1e-6 || strip.maxZ > floor.maxZ + 1e-6
        : strip.minX < floor.minX - 1e-6 || strip.maxX > floor.maxX + 1e-6;
      if (outside) continue;
      let free: Interval[] = [along];
      all.forEach((other, index) => {
        if (index === own || !overlapBy(other.box, strip)) return;
        free = without(
          free,
          sideways(facing)
            ? [other.box.minX, other.box.maxX]
            : [other.box.minZ, other.box.maxZ],
        );
      });
      const [clickAlong, clickAcross] = sideways(facing)
        ? [click[0], click[1]]
        : [click[1], click[0]];
      const front = (clickAcross - plane) * (sideways(facing) ? n.z : n.x);
      const thickness = sideways(facing)
        ? box.maxZ - box.minZ
        : box.maxX - box.minX;
      const away = front >= 0 ? front : -front > thickness ? 5 - front : -front;
      for (const stretch of free) {
        if (stretch[1] - stretch[0] + 1e-9 < span) continue;
        const closest = clamp(clickAlong, stretch[0], stretch[1]);
        const distance = Math.hypot(clickAlong - closest, away);
        if (distance <= reach)
          spots.push({ facing, face: plane, stretch, distance, closest });
      }
    }
  });
  return spots.sort((a, b) => a.distance - b.distance);
}

/** Where on a spot a mount of this width goes, as near the click as the wall allows. */
const alongOn = (spot: Spot, click: Point, width: number, step: number) => {
  const at = sideways(spot.facing) ? click[0] : click[1];
  const half = width / 2;
  const [lo, hi] = spot.stretch;
  return round(clamp(snap(at, step), lo + half, hi - half));
};

const sizeOfFree = (spot: Spot) =>
  Math.floor((spot.stretch[1] - spot.stretch[0]) * 20 + 1e-9) / 20;

function distanceTo(box: Box, x: number, z: number): number {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dz = Math.max(z - box.maxZ, box.minZ - z, 0);
  return Math.hypot(dx, dz);
}

/** The zone a board or a screen on a wall face belongs to: the nearest one it looks into and can be reached from. */
function zoneAround(
  shell: Shell,
  mount: { facing: Facing; face: number; along: number },
): string | null {
  const point = sideways(mount.facing)
    ? { x: mount.along, z: mount.face }
    : { x: mount.face, z: mount.along };
  const normal = normalOf(mount.facing);
  const reachable = shell.zones
    .map((zone) => {
      const center = {
        x: (zone.rect.minX + zone.rect.maxX) / 2,
        z: (zone.rect.minZ + zone.rect.maxZ) / 2,
      };
      const towards =
        (center.x - point.x) * normal.x + (center.z - point.z) * normal.z;
      return {
        zone,
        towards,
        distance: distanceTo(zone.rect, point.x, point.z),
      };
    })
    .filter((entry) => entry.towards > 0 && entry.distance <= 0.5)
    .sort((a, b) => a.distance - b.distance);
  return reachable[0]?.zone.id ?? null;
}

function hasGlassNear(shell: Shell, click: Point): boolean {
  return shell.glass.some(
    (slab) => distanceTo(slabBox(slab), click[0], click[1]) <= ATTACH_REACH,
  );
}

/**
 * Hangs a board or a screen on the wall face nearest a click, looking into the
 * floor: a board of the private room it looks into (or of the open floor when
 * there is none), a screen always of one. Refused when no wall is within
 * reach, when it does not fit, or when the shell would have a problem with it.
 */
export function placeMount(
  shell: Shell,
  kind: MountKind,
  click: Point,
  step: number,
): Edit {
  const list = kind === "board" ? shell.boards : shell.screens;
  const limit = kind === "board" ? SHELL_LIMITS.boards : SHELL_LIMITS.screens;
  if (list.length >= limit) return { error: `At most ${limit} ${kind}s.` };
  const least = kind === "board" ? BOARD.min : SCREEN.min;
  const spot = spotsAt(shell, click, least, ATTACH_REACH)[0];
  if (!spot)
    return {
      error: hasGlassNear(shell, click)
        ? "Glass cannot hold a board or a screen: click on a wall."
        : `Click on a wall: a ${kind} hangs on one, within ${ATTACH_REACH} m of the click.`,
    };
  const wanted = kind === "board" ? BOARD.width : SCREEN.width;
  const width = Math.max(least, Math.min(wanted, sizeOfFree(spot)));
  const along = alongOn(spot, click, width, step);
  const mount = {
    facing: spot.facing,
    face: round(spot.face),
    along,
  };
  const zone = zoneAround(shell, mount);
  if (kind === "screen" && zone === null)
    return {
      error:
        "A screen belongs to a private room: hang it on a wall inside one.",
    };
  const id = uniqueId(
    kind,
    list.map((entry) => entry.id),
  );
  const next =
    kind === "board"
      ? {
          ...shell,
          boards: [
            ...shell.boards,
            {
              id,
              zone,
              ...mount,
              y: BOARD.y,
              width: round(width),
              height: BOARD.height,
            } satisfies ShellBoard,
          ],
        }
      : {
          ...shell,
          screens: [
            ...shell.screens,
            {
              id,
              zone: zone as string,
              ...mount,
              y: SCREEN.y,
              width: round(width),
            } satisfies ShellScreen,
          ],
        };
  const index = list.length;
  const wrong = findShellProblems(next).find((problem) =>
    problem.refs?.some((ref) => ref.kind === kind && ref.index === index),
  );
  if (wrong) return { error: wrong.message };
  return { shell: next, ref: { kind, index } };
}

const mountOf = (shell: Shell, ref: ShellRef) =>
  ref.kind === "board"
    ? shell.boards[ref.index]
    : ref.kind === "screen"
      ? shell.screens[ref.index]
      : undefined;

const slabsOf = (shell: Shell, kind: ShellKind): Slab[] | null =>
  kind === "wall"
    ? shell.walls
    : kind === "glass"
      ? shell.glass
      : kind === "floor"
        ? shell.floors
        : null;

/** The rectangle of a part that is one: a zone, an area or the place where people appear. */
function rectOf(shell: Shell, ref: ShellRef): Box | undefined {
  if (ref.kind === "zone") return shell.zones[ref.index]?.rect;
  if (ref.kind === "area") return shell.areas[ref.index]?.rect;
  if (ref.kind === "spawn")
    return ref.index === 0 ? shell.spawn.area : undefined;
  return undefined;
}

function withRect(shell: Shell, ref: ShellRef, rect: Box): Shell {
  const replace = <T extends { rect: Box }>(list: T[]) =>
    list.map((entry, index) =>
      index === ref.index ? { ...entry, rect } : entry,
    );
  if (ref.kind === "zone") return { ...shell, zones: replace(shell.zones) };
  if (ref.kind === "area") return { ...shell, areas: replace(shell.areas) };
  return { ...shell, spawn: { ...shell.spawn, area: rect } };
}

function withSlab(shell: Shell, ref: ShellRef, slab: Slab): Shell {
  const replace = <T extends Slab>(list: T[]) =>
    list.map((entry, index) =>
      index === ref.index ? { ...entry, ...slab } : entry,
    );
  if (ref.kind === "wall") return { ...shell, walls: replace(shell.walls) };
  if (ref.kind === "glass") return { ...shell, glass: replace(shell.glass) };
  return { ...shell, floors: replace(shell.floors) };
}

/** Where a part is held when it is dragged: the corner of a slab or a rectangle, the spot of a board on its wall. */
export function anchorOf(shell: Shell, ref: ShellRef): Point | null {
  const slab = slabsOf(shell, ref.kind)?.[ref.index];
  if (slab)
    return [round(slab.x - slab.width / 2), round(slab.z - slab.depth / 2)];
  const rect = rectOf(shell, ref);
  if (rect) return [rect.minX, rect.minZ];
  const mount = mountOf(shell, ref);
  if (mount)
    return sideways(mount.facing)
      ? [mount.along, mount.face]
      : [mount.face, mount.along];
  return null;
}

/** The part with its anchor (see `anchorOf`) put at `to`. A board or a screen hangs on the face nearest it, and stays where it is when no wall is near. */
export function moveTo(
  shell: Shell,
  ref: ShellRef,
  to: Point,
  step = 0,
): Shell {
  const slab = slabsOf(shell, ref.kind)?.[ref.index];
  if (slab)
    return withSlab(shell, ref, {
      ...slab,
      x: round(to[0] + slab.width / 2),
      z: round(to[1] + slab.depth / 2),
    });
  const rect = rectOf(shell, ref);
  if (rect)
    return withRect(shell, ref, {
      minX: round(to[0]),
      maxX: round(to[0] + rect.maxX - rect.minX),
      minZ: round(to[1]),
      maxZ: round(to[1] + rect.maxZ - rect.minZ),
    });
  const mount = mountOf(shell, ref);
  if (!mount) return shell;
  const spot = spotsAt(shell, to, mount.width, DROP_REACH)[0];
  if (!spot) return shell;
  const moved = {
    facing: spot.facing,
    face: round(spot.face),
    along: alongOn(spot, to, mount.width, step),
  };
  return ref.kind === "board"
    ? {
        ...shell,
        boards: shell.boards.map((entry, i) =>
          i === ref.index ? { ...entry, ...moved } : entry,
        ),
      }
    : {
        ...shell,
        screens: shell.screens.map((entry, i) =>
          i === ref.index ? { ...entry, ...moved } : entry,
        ),
      };
}

/** Moves a part by a small amount: a slab or a rectangle in x and z, a board or a screen along its wall. */
export function nudge(
  shell: Shell,
  ref: ShellRef,
  dx: number,
  dz: number,
): Shell {
  const mount = mountOf(shell, ref);
  if (mount) {
    const along = round(mount.along + (sideways(mount.facing) ? dx : dz));
    return setMount(shell, ref, { along });
  }
  const anchor = anchorOf(shell, ref);
  return anchor ? moveTo(shell, ref, [anchor[0] + dx, anchor[1] + dz]) : shell;
}

export interface Geometry {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** The middle and the size of a slab or a rectangle: what the inspector shows. */
export function geometryOf(shell: Shell, ref: ShellRef): Geometry | null {
  const slab = slabsOf(shell, ref.kind)?.[ref.index];
  if (slab)
    return { x: slab.x, z: slab.z, width: slab.width, depth: slab.depth };
  const rect = rectOf(shell, ref);
  if (!rect) return null;
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    width: rect.maxX - rect.minX,
    depth: rect.maxZ - rect.minZ,
  };
}

const finite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

/** Sets the middle or the size of a slab or a rectangle; numbers go to a millimetre, and what is not a number is ignored. */
export function setGeometry(
  shell: Shell,
  ref: ShellRef,
  patch: Partial<Geometry>,
): Shell {
  const now = geometryOf(shell, ref);
  if (!now) return shell;
  const next: Geometry = {
    x: finite(patch.x) ? patch.x : now.x,
    z: finite(patch.z) ? patch.z : now.z,
    width: finite(patch.width) ? Math.max(0, patch.width) : now.width,
    depth: finite(patch.depth) ? Math.max(0, patch.depth) : now.depth,
  };
  if (slabsOf(shell, ref.kind))
    return withSlab(shell, ref, {
      x: round(next.x),
      z: round(next.z),
      width: round(next.width),
      depth: round(next.depth),
    });
  return withRect(shell, ref, {
    minX: round(next.x - next.width / 2),
    maxX: round(next.x + next.width / 2),
    minZ: round(next.z - next.depth / 2),
    maxZ: round(next.z + next.depth / 2),
  });
}

export interface MountPatch {
  along?: number;
  y?: number;
  width?: number;
  height?: number;
  zone?: string | null;
}

/** Changes where a board or a screen hangs along its wall, its height and size, and which zone it belongs to. */
export function setMount(
  shell: Shell,
  ref: ShellRef,
  patch: MountPatch,
): Shell {
  const number = (key: "along" | "y" | "width" | "height", from: number) =>
    finite(patch[key]) ? round(patch[key]) : from;
  if (ref.kind === "board") {
    return {
      ...shell,
      boards: shell.boards.map((board, index) =>
        index === ref.index
          ? {
              ...board,
              along: number("along", board.along),
              y: number("y", board.y),
              width: number("width", board.width),
              height: number("height", board.height),
              zone: patch.zone === undefined ? board.zone : patch.zone,
            }
          : board,
      ),
    };
  }
  if (ref.kind === "screen") {
    return {
      ...shell,
      screens: shell.screens.map((screen, index) =>
        index === ref.index
          ? {
              ...screen,
              along: number("along", screen.along),
              y: number("y", screen.y),
              width: number("width", screen.width),
              zone: typeof patch.zone === "string" ? patch.zone : screen.zone,
            }
          : screen,
      ),
    };
  }
  return shell;
}

export function setTone(shell: Shell, index: number, tone: FloorTone): Shell {
  return {
    ...shell,
    floors: shell.floors.map((patch, i) =>
      i === index ? { ...patch, tone } : patch,
    ),
  };
}

/** Gives a zone or an area another name or id. A zone's boards and screens follow its id. */
export function renameRef(
  shell: Shell,
  ref: ShellRef,
  patch: { label?: string; id?: string },
): Change {
  if (ref.kind !== "zone" && ref.kind !== "area")
    return { error: "Only zones and areas have a name." };
  const list = ref.kind === "zone" ? shell.zones : shell.areas;
  const current = list[ref.index];
  if (!current) return { error: `There is no such ${ref.kind}.` };
  let { label, id } = current;
  if (patch.label !== undefined) {
    const problem = labelProblem(shell, ref.kind, patch.label, ref.index);
    if (problem) return { error: problem };
    label = cleanName(patch.label);
  }
  if (patch.id !== undefined) {
    if (!SLUG.test(patch.id) || patch.id.length > SHELL_LIMITS.idLength)
      return {
        error: `An id is lowercase letters, digits and single hyphens, up to ${SHELL_LIMITS.idLength}.`,
      };
    if (
      list.some((entry, index) => index !== ref.index && entry.id === patch.id)
    )
      return { error: `Another ${ref.kind} has the id "${patch.id}".` };
    id = patch.id;
  }
  const renamed = list.map((entry, index) =>
    index === ref.index ? { ...entry, label, id } : entry,
  );
  if (ref.kind === "area") return { shell: { ...shell, areas: renamed } };
  const follow = <T extends { zone: string | null }>(mounts: T[]) =>
    mounts.map((mount) =>
      mount.zone === current.id ? { ...mount, zone: id } : mount,
    );
  return {
    shell: {
      ...shell,
      zones: renamed,
      boards: follow(shell.boards),
      screens: follow(shell.screens),
    },
  };
}

/** Takes a part out. A zone takes its boards and screens with it, which would have no room left to belong to. The place where people appear stays. */
export function deleteRef(shell: Shell, ref: ShellRef): Shell {
  const omit = <T>(list: T[]) => list.filter((_, index) => index !== ref.index);
  const exists = (length: number) => ref.index >= 0 && ref.index < length;
  switch (ref.kind) {
    case "wall":
      return exists(shell.walls.length)
        ? { ...shell, walls: omit(shell.walls) }
        : shell;
    case "glass":
      return exists(shell.glass.length)
        ? { ...shell, glass: omit(shell.glass) }
        : shell;
    case "floor":
      return exists(shell.floors.length)
        ? { ...shell, floors: omit(shell.floors) }
        : shell;
    case "area":
      return exists(shell.areas.length)
        ? { ...shell, areas: omit(shell.areas) }
        : shell;
    case "board":
      return exists(shell.boards.length)
        ? { ...shell, boards: omit(shell.boards) }
        : shell;
    case "screen":
      return exists(shell.screens.length)
        ? { ...shell, screens: omit(shell.screens) }
        : shell;
    case "zone": {
      const zone = shell.zones[ref.index];
      if (!zone) return shell;
      return {
        ...shell,
        zones: omit(shell.zones),
        boards: shell.boards.filter((board) => board.zone !== zone.id),
        screens: shell.screens.filter((screen) => screen.zone !== zone.id),
      };
    }
    case "spawn":
      return shell;
  }
}

/** The size of the floor, kept within what the game can draw; a size that is not a number is left as it was. */
export function resizeFloor(shell: Shell, width: number, depth: number): Shell {
  const L = SHELL_LIMITS;
  return {
    ...shell,
    width: Number.isFinite(width)
      ? round(clamp(width, L.minWidth, L.maxWidth))
      : shell.width,
    depth: Number.isFinite(depth)
      ? round(clamp(depth, L.minDepth, L.maxDepth))
      : shell.depth,
  };
}

const inside = (box: Box, within: Box, margin = 0.01) =>
  box.minX >= within.minX - margin &&
  box.maxX <= within.maxX + margin &&
  box.minZ >= within.minZ - margin &&
  box.maxZ <= within.maxZ + margin;

/** How many parts of the shell, and how many pieces of furniture, are past the edge of the floor. */
export function partsOutside(
  shell: Shell,
  furniture: Furniture[],
  models: PropPlacement[],
): { parts: number; furniture: number } {
  const edge = edgeOf(shell);
  const floor = shellFloorBox(shell);
  let parts = 0;
  for (const slab of [...shell.walls, ...shell.glass])
    if (!inside(slabBox(slab), edge)) parts++;
  for (const slab of shell.floors) if (!inside(slabBox(slab), floor)) parts++;
  for (const zone of shell.zones) if (!inside(zone.rect, floor)) parts++;
  for (const area of shell.areas) if (!inside(area.rect, edge)) parts++;
  if (!inside(shell.spawn.area, floor)) parts++;
  for (const mount of [...shell.boards, ...shell.screens]) {
    const at = sideways(mount.facing)
      ? { x: mount.along, z: mount.face }
      : { x: mount.face, z: mount.along };
    if (!inside({ minX: at.x, maxX: at.x, minZ: at.z, maxZ: at.z }, edge))
      parts++;
  }
  let pieces = 0;
  for (const item of furniture)
    if (
      !isFlat(item.kind) &&
      furnitureExtent(item).some((box) => !inside(box, floor))
    )
      pieces++;
  for (const prop of models) {
    const box = footprintCollider(prop);
    if (box && !inside(box, floor)) pieces++;
  }
  return { parts, furniture: pieces };
}

const nearestOf = (distance: number, box: Box, x: number, z: number) =>
  distanceTo(box, x, z) <= distance;

const areaOf = (box: Box) => (box.maxX - box.minX) * (box.maxZ - box.minZ);

function segmentDistance(
  [ax, az]: Point,
  [bx, bz]: Point,
  x: number,
  z: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const t =
    length === 0 ? 0 : clamp(((x - ax) * dx + (z - az) * dz) / length, 0, 1);
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

/**
 * The part under a point on the plan: boards and screens first, then glass and
 * walls (a little beyond their edge, since they are thin), the place where
 * people appear, private rooms, floor patches and last the areas, the smaller
 * of two that overlap first. Null when there is none.
 */
export function pickStructure(
  shell: Shell,
  x: number,
  z: number,
): ShellRef | null {
  const mounts: Array<{ ref: ShellRef; distance: number }> = [];
  const hang = (kind: MountKind, list: Array<ShellBoard | ShellScreen>) =>
    list.forEach((mount, index) => {
      const half = mount.width / 2;
      const [a, b]: [Point, Point] = sideways(mount.facing)
        ? [
            [mount.along - half, mount.face],
            [mount.along + half, mount.face],
          ]
        : [
            [mount.face, mount.along - half],
            [mount.face, mount.along + half],
          ];
      const distance = segmentDistance(a, b, x, z);
      if (distance <= PICK_BOARD)
        mounts.push({ ref: { kind, index }, distance });
    });
  hang("board", shell.boards);
  hang("screen", shell.screens);
  mounts.sort((p, q) => p.distance - q.distance || q.ref.index - p.ref.index);
  if (mounts[0]) return mounts[0].ref;

  for (const kind of ["glass", "wall"] as const) {
    const list = kind === "glass" ? shell.glass : shell.walls;
    for (let index = list.length - 1; index >= 0; index--)
      if (nearestOf(PICK_MARGIN, slabBox(list[index]), x, z))
        return { kind, index };
  }
  const inBox = (box: Box) =>
    x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
  if (inBox(shell.spawn.area)) return { kind: "spawn", index: 0 };

  const smallest = (kind: "zone" | "floor" | "area", boxes: Box[]) => {
    const hits = boxes
      .map((box, index) => ({ box, index }))
      .filter(({ box }) => inBox(box))
      .sort((p, q) => areaOf(p.box) - areaOf(q.box) || q.index - p.index);
    return hits[0] ? { kind, index: hits[0].index } : null;
  };
  return (
    smallest(
      "zone",
      shell.zones.map((zone) => zone.rect),
    ) ??
    smallest("floor", shell.floors.map(slabBox)) ??
    smallest(
      "area",
      shell.areas.map((area) => area.rect),
    )
  );
}

/** What sticks out past the floor, in a sentence; null when nothing does. */
export function describeOutside(outside: {
  parts: number;
  furniture: number;
}): string | null {
  const { parts, furniture } = outside;
  if (parts + furniture === 0) return null;
  const things = [
    parts > 0
      ? `${parts} ${parts === 1 ? "part" : "parts"} of the structure`
      : "",
    furniture > 0
      ? `${furniture} ${furniture === 1 ? "piece" : "pieces"} of furniture`
      : "",
  ].filter(Boolean);
  return `${things.join(" and ")} ${parts + furniture === 1 ? "sticks" : "stick"} out past the floor.`;
}
