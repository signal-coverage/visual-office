import { SEAT_HEIGHT } from "../../shared/seats.ts";
import { LEG } from "./avatarLayout";

export { SEAT_HEIGHT };

/** How high the eyes are from the floor when standing. */
export const STANDING_EYE_HEIGHT = 1.65;

/** The avatar's body when sitting: how far it is lowered and how its limbs bend. */
export interface SeatedPose {
  /** How far the whole body is lowered (meters, negative) so the hips rest on the seat. */
  drop: number;
  /** The turn of the thighs about the hip (radians): a quarter turn puts them level, forward. */
  thigh: number;
  /** The shares of the leg that are thigh and lower leg. */
  thighShare: number;
  shinShare: number;
  /** The turn of the arms about the shoulder: low on the lap, or forward to a desk. */
  arm: number;
}

const ARMS_AT_REST = 0.3;
const ARMS_AT_DESK = 1.25;

export function seatedPose(atDesk: boolean): SeatedPose {
  return {
    drop: SEAT_HEIGHT - LEG.height,
    thigh: Math.PI / 2,
    thighShare: 0.5,
    shinShare: 0.5,
    arm: atDesk ? ARMS_AT_DESK : ARMS_AT_REST,
  };
}

/** Where the eyes are when sitting: as much lower than standing as the body is. */
export const SEATED_EYE_HEIGHT = STANDING_EYE_HEIGHT + seatedPose(false).drop;

/**
 * Keeps a turn of the head within `limit` of the way the seat faces, so a
 * seated person cannot spin round in the chair. A yaw that has gone round more
 * than once keeps its extra turns.
 */
export function clampSeatedYaw(
  yaw: number,
  seatYaw: number,
  limit: number,
): number {
  const full = Math.PI * 2;
  const delta = yaw - seatYaw;
  const wrapped = delta - full * Math.round(delta / full);
  const clamped = Math.max(-limit, Math.min(limit, wrapped));
  return yaw - wrapped + clamped;
}
