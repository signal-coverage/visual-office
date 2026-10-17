import type { Vec3 } from "./boards.ts";
import { DEFAULT_SHELL } from "./defaultShell.ts";
import {
  normalOf,
  screenLayers,
  screenPictureHeight,
  type Shell,
} from "./shell.ts";

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

/** The screens of a shell, each where it hangs on its wall. */
export function screensOf(shell: Pick<Shell, "screens">): Screen[] {
  return shell.screens.map((screen) => {
    const normal = normalOf(screen.facing);
    const sideways = screen.facing === "north" || screen.facing === "south";
    const surface = screenLayers(screen).surface;
    return {
      id: screen.id,
      zone: screen.zone,
      center: {
        x: sideways ? screen.along : surface,
        y: screen.y,
        z: sideways ? surface : screen.along,
      },
      normal: { x: normal.x, y: 0, z: normal.z },
      width: screen.width,
      height: screenPictureHeight(screen),
    };
  });
}

/** The screens of the default shell. */
export const SCREENS: readonly Screen[] = screensOf(DEFAULT_SHELL);

/** Whether the zone has a screen on a wall, so being in its call matters for seeing it. */
export function zoneHasScreen(
  zone: string,
  screens: readonly Screen[] = SCREENS,
): boolean {
  return screens.some((screen) => screen.zone === zone);
}

export function screenById(
  id: string,
  screens: readonly Screen[] = SCREENS,
): Screen | undefined {
  return screens.find((screen) => screen.id === id);
}
