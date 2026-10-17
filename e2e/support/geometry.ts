import type { Interactable } from "../../shared/interactions.ts";
import { OFFICE_INTERACTABLES } from "../../shared/layout.ts";
import { STANDING_EYE_HEIGHT } from "../../src/game/seatedPose";

export interface Stance {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** A piece of the default office, by its id (`chair:21`, `desk:20`, `bookshelf.glb:0`). */
export function interactable(id: string): Interactable {
  const found = OFFICE_INTERACTABLES.find((entry) => entry.id === id);
  if (!found) throw new Error(`The default office has no ${id}`);
  return found;
}

/** Standing at (x, z), the way to turn the camera to look at the middle of a piece. */
export function lookAt(x: number, z: number, target: Interactable): Stance {
  const { box } = target;
  const dx = (box.minX + box.maxX) / 2 - x;
  const dz = (box.minZ + box.maxZ) / 2 - z;
  const dy = (box.minY + box.maxY) / 2 - STANDING_EYE_HEIGHT;
  return {
    x,
    z,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
  };
}

/** The aisle between the columns of desks: free of furniture from the south end of the open area to its north end. */
export const AISLE_X = -1.5;
const SOUTH = 8;

/** Where somebody walks to reach a stance from where they spawn: along the aisle when the stance is among the desks. */
export function routeTo(
  stance: Stance,
  among: "south" | "aisle" | "open",
): Stance[] {
  const turned = (x: number, z: number): Stance => ({
    x,
    z,
    yaw: stance.yaw,
    pitch: 0,
  });
  if (among === "open") return [turned(stance.x, SOUTH), stance];
  if (among === "south") return [stance];
  return [turned(AISLE_X, SOUTH), turned(AISLE_X, stance.z), stance];
}
