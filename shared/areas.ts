import type { Box } from "./collision.ts";

/**
 * The named parts of the office, only so people can say where they are. They
 * are not the private zones of zones.ts: standing in the kitchen changes
 * nothing about who can hear you. They are the prototype's rooms, and like
 * there the open area spans the whole floor, so it is what is left once none
 * of the others holds you.
 */
export interface Area {
  label: string;
  area: Box;
}

/** More specific rooms first: the first one that holds a point names it. */
export const AREAS: readonly Area[] = [
  { label: "Meeting room", area: { minX: -15, maxX: -6, minZ: -10, maxZ: -2 } },
  { label: "Kitchen", area: { minX: 6, maxX: 15, minZ: -10, maxZ: -2 } },
  { label: "Lounge", area: { minX: 6, maxX: 15, minZ: 3, maxZ: 10 } },
  { label: "Reception", area: { minX: -15, maxX: -6, minZ: 3, maxZ: 10 } },
  { label: "Open area", area: { minX: -15, maxX: 15, minZ: -10, maxZ: 10 } },
];

/** Anywhere that is on no floor of the above, which in practice is past the walls. */
export const HALLWAY = "Hallway";

/** The name of the part of the office that holds a point on the floor. */
export function areaAt(x: number, z: number): string {
  const found = AREAS.find(
    ({ area }) =>
      x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ,
  );
  return found?.label ?? HALLWAY;
}
