import type { Vec3 } from "./boards.ts";
import { MEETING_SCREEN } from "./layout.ts";

/**
 * A screen on a wall that shows what somebody in its private zone is sharing.
 * Like a board it belongs to a zone: the picture travels through that zone's
 * own call, so only the people in the zone ever receive it.
 */
export interface Screen {
  id: string;
  zone: string;
  center: Vec3;
  /** Unit vector pointing out of the screen, toward whoever is looking at it. */
  normal: Vec3;
  width: number;
  height: number;
}

export const SCREENS: readonly Screen[] = [
  {
    id: "meeting",
    zone: "meeting",
    center: { x: MEETING_SCREEN.x, y: MEETING_SCREEN.y, z: MEETING_SCREEN.z },
    // On the north wall, facing south into the room
    normal: { x: 0, y: 0, z: 1 },
    width: MEETING_SCREEN.width,
    height: MEETING_SCREEN.height,
  },
];

/** Whether the zone has a screen on a wall, so being in its call matters for seeing it. */
export function zoneHasScreen(zone: string): boolean {
  return SCREENS.some((screen) => screen.zone === zone);
}

export function screenById(id: string): Screen | undefined {
  return SCREENS.find((screen) => screen.id === id);
}
