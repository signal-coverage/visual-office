import type { Box } from "./collision.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";

/** The free floor at the south end of the open area, below the desks, where players can appear on a floor that has the default shell. */
export const SPAWN_AREA: Box = DEFAULT_SHELL.spawn.area;

/**
 * Picks a spawn point so players who join together do not stand inside each
 * other (a camera inside another avatar's body renders garbage).
 */
export function randomSpawn(
  random: () => number = Math.random,
  area: Box = SPAWN_AREA,
): {
  x: number;
  z: number;
} {
  const { minX, maxX, minZ, maxZ } = area;
  return {
    x: minX + random() * (maxX - minX),
    z: minZ + random() * (maxZ - minZ),
  };
}
