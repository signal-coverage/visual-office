import type { Box } from "./collision.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import type { Shell } from "./shell.ts";

/**
 * A private area of the office. Whoever is inside talks only with the others
 * inside, and nobody outside can hear or see them.
 */
export interface Zone {
  id: string;
  /** What people see, e.g. "Meeting room". */
  label: string;
  area: Box;
}

/** What the server tells a player when they enter (an id) or leave (null) a zone. */
export type ZoneMessage = string | null;

/** The private zones of a shell. */
export function zonesOf(shell: Pick<Shell, "zones">): Zone[] {
  return shell.zones.map(({ id, label, rect }) => ({ id, label, area: rect }));
}

/** The zones of the default shell: what a floor has when it never chose another. */
export const ZONES: readonly Zone[] = zonesOf(DEFAULT_SHELL);

/**
 * How far past the edge someone has to be before the zone changes, in meters.
 * Entering needs this much room inside and leaving this much outside, so
 * standing in the doorway does not flip the call back and forth. It is smaller
 * than the player's radius, so even somebody pressed against either side of
 * the wall ends up on the right side.
 */
export const ZONE_MARGIN = 0.35;

export function zoneById(
  id: string,
  zones: readonly Zone[] = ZONES,
): Zone | undefined {
  return zones.find((zone) => zone.id === id);
}

/** What to call a zone on screen; an id this client does not know is shown as it is. */
export function zoneLabel(id: string, zones: readonly Zone[] = ZONES): string {
  return zoneById(id, zones)?.label ?? id;
}

const inside = (x: number, z: number, area: Box, margin: number) =>
  x >= area.minX + margin &&
  x <= area.maxX - margin &&
  z >= area.minZ + margin &&
  z <= area.maxZ - margin;

/**
 * The zone a player is in, given where they are and the zone they were in
 * until now (null for none). The previous zone is what gives the edges their
 * hysteresis: staying is easier than entering.
 */
export function zoneAt(
  x: number,
  z: number,
  current: string | null,
  zones: readonly Zone[] = ZONES,
): string | null {
  const stay = current ? zoneById(current, zones) : undefined;
  if (stay && inside(x, z, stay.area, -ZONE_MARGIN)) return stay.id;
  for (const zone of zones) {
    if (inside(x, z, zone.area, ZONE_MARGIN)) return zone.id;
  }
  return null;
}
