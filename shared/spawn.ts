/** The free floor at the south end of the open area, below the desks, where players can appear. */
export const SPAWN_AREA = { minX: -3, maxX: 3, minZ: 7.5, maxZ: 9 };

/**
 * Picks a spawn point so players who join together do not stand inside each
 * other (a camera inside another avatar's body renders garbage).
 */
export function randomSpawn(random: () => number = Math.random): {
  x: number;
  z: number;
} {
  const { minX, maxX, minZ, maxZ } = SPAWN_AREA;
  return {
    x: minX + random() * (maxX - minX),
    z: minZ + random() * (maxZ - minZ),
  };
}
