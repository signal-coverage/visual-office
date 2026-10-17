import type { Box } from "./collision.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import type { Shell } from "./shell.ts";

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

/** The named areas of a shell. More specific rooms come first: the first one that holds a point names it. */
export function areasOf(shell: Pick<Shell, "areas">): Area[] {
  return shell.areas.map(({ label, rect }) => ({ label, area: rect }));
}

/** The areas of the default shell. */
export const AREAS: readonly Area[] = areasOf(DEFAULT_SHELL);

/** Anywhere that is on no floor of the above, which in practice is past the walls. */
export const HALLWAY = "Hallway";

/** The name of the part of the office that holds a point on the floor. */
export function areaAt(
  x: number,
  z: number,
  areas: readonly Area[] = AREAS,
): string {
  const found = areas.find(
    ({ area }) =>
      x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ,
  );
  return found?.label ?? HALLWAY;
}
