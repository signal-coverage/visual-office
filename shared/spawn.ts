/** Free floor next to the west wall where players can appear. */
export const SPAWN_AREA = { minX: -9, maxX: -7.5, minZ: -4, maxZ: 4 };

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
