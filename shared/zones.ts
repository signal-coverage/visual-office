import type { Box } from "./collision.ts";
import { MEETING_ROOM } from "./layout.ts";

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

export const ZONES: readonly Zone[] = [
  { id: "meeting", label: "Meeting room", area: MEETING_ROOM },
];

/**
 * How far past the edge someone has to be before the zone changes, in meters.
 * Entering needs this much room inside and leaving this much outside, so
 * standing in the doorway does not flip the call back and forth. It is smaller
 * than the player's radius, so even somebody pressed against either side of
 * the wall ends up on the right side.
 */
export const ZONE_MARGIN = 0.35;

export function zoneById(id: string): Zone | undefined {
  return ZONES.find((zone) => zone.id === id);
}

/** What to call a zone on screen; an id this client does not know is shown as it is. */
export function zoneLabel(id: string): string {
  return zoneById(id)?.label ?? id;
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
): string | null {
  const stay = current ? zoneById(current) : undefined;
  if (stay && inside(x, z, stay.area, -ZONE_MARGIN)) return stay.id;
  for (const zone of ZONES) {
    if (inside(x, z, zone.area, ZONE_MARGIN)) return zone.id;
  }
  return null;
}
