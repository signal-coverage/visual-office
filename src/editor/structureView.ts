import type { Box } from "../../shared/collision.ts";
import {
  normalOf,
  slabBox,
  type Shell,
  type ShellBoard,
  type ShellRef,
  type ShellScreen,
} from "../../shared/shell.ts";
import type { Point } from "./shellEdit";

/** The way people can be made to look when they appear: 0 looks north and a quarter turn on looks west. */
export const YAW_CHOICES = [
  { label: "North", yaw: 0 },
  { label: "West", yaw: Math.PI / 2 },
  { label: "South", yaw: Math.PI },
  { label: "East", yaw: -Math.PI / 2 },
] as const;

/** Where somebody who looks with this yaw is looking, as a unit vector on the plan. */
export function yawVector(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw) + 0, z: -Math.cos(yaw) + 0 };
}

/** The nearest of the four ways, in words. */
export function facingOfYaw(yaw: number): string {
  const turn = 2 * Math.PI;
  const wrapped = ((yaw % turn) + turn) % turn;
  let best: (typeof YAW_CHOICES)[number] = YAW_CHOICES[0];
  let bestGap = Infinity;
  for (const choice of YAW_CHOICES) {
    const own = ((choice.yaw % turn) + turn) % turn;
    const gap = Math.min(
      Math.abs(wrapped - own),
      turn - Math.abs(wrapped - own),
    );
    if (gap < bestGap) {
      best = choice;
      bestGap = gap;
    }
  }
  return best.label;
}

/** A board or a screen as a line along its wall, and the way out of the wall. */
export function mountSegment(mount: ShellBoard | ShellScreen): {
  a: Point;
  b: Point;
  out: Point;
} {
  const half = mount.width / 2;
  const n = normalOf(mount.facing);
  const across = mount.facing === "north" || mount.facing === "south";
  return {
    a: across
      ? [mount.along - half, mount.face]
      : [mount.face, mount.along - half],
    b: across
      ? [mount.along + half, mount.face]
      : [mount.face, mount.along + half],
    out: [n.x + 0, n.z + 0],
  };
}

/** How much room around a board or a screen the plan outlines when it is selected. */
const MOUNT_HALO = 0.25;

/** The box to outline a part with, or null when there is no such part. */
export function boundsOf(shell: Shell, ref: ShellRef): Box | null {
  const slabs =
    ref.kind === "wall"
      ? shell.walls
      : ref.kind === "glass"
        ? shell.glass
        : ref.kind === "floor"
          ? shell.floors
          : null;
  if (slabs) return slabs[ref.index] ? slabBox(slabs[ref.index]) : null;
  if (ref.kind === "zone") return shell.zones[ref.index]?.rect ?? null;
  if (ref.kind === "area") return shell.areas[ref.index]?.rect ?? null;
  if (ref.kind === "spawn") return ref.index === 0 ? shell.spawn.area : null;
  const mount = (ref.kind === "board" ? shell.boards : shell.screens)[
    ref.index
  ];
  if (!mount) return null;
  const { a, b } = mountSegment(mount);
  return {
    minX: Math.min(a[0], b[0]) - MOUNT_HALO,
    maxX: Math.max(a[0], b[0]) + MOUNT_HALO,
    minZ: Math.min(a[1], b[1]) - MOUNT_HALO,
    maxZ: Math.max(a[1], b[1]) + MOUNT_HALO,
  };
}

/** What a part is, in words a person can read in the inspector and in messages. */
export function describeRef(shell: Shell, ref: ShellRef): string {
  switch (ref.kind) {
    case "wall":
      return `Wall ${ref.index + 1}`;
    case "glass":
      return `Glass wall ${ref.index + 1}`;
    case "floor":
      return `Floor patch ${ref.index + 1}`;
    case "zone":
      return `Private zone: ${shell.zones[ref.index]?.label ?? "?"}`;
    case "area":
      return `Area: ${shell.areas[ref.index]?.label ?? "?"}`;
    case "spawn":
      return "Where people appear";
    case "board":
    case "screen": {
      const mount = (ref.kind === "board" ? shell.boards : shell.screens)[
        ref.index
      ];
      const what = ref.kind === "board" ? "Whiteboard" : "Screen";
      if (!mount || mount.zone === null) return `${what} of the open floor`;
      const zone = shell.zones.find((candidate) => candidate.id === mount.zone);
      return `${what} of ${zone?.label ?? mount.zone}`;
    }
  }
}
