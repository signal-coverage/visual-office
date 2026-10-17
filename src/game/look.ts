import { clampSeatedYaw } from "./seatedPose";

/** Radians the view turns for each pixel the mouse moves, at the usual sensitivity. */
export const MOUSE_SENSITIVITY = 0.002;
/** A finger drags a shorter way than a mouse for the same turn: it turns this many times as much for each pixel. */
export const TOUCH_LOOK_GAIN = 2.5;
export const MAX_PITCH = Math.PI / 2 - 0.05;
/** How far a seated person turns their head from the way the chair faces. */
export const SEAT_LOOK_LIMIT = (100 * Math.PI) / 180;

export interface View {
  yaw: number;
  pitch: number;
}

/**
 * The view after the pointer (a mouse, or a finger on the screen) moved `dx`
 * right and `dy` down, in pixels: right turns right, up looks up, and the head
 * goes no further than straight up or down. A seated person (`seatYaw`, the way
 * the chair faces) turns it only so far from the chair.
 */
export function turnView(
  view: View,
  dx: number,
  dy: number,
  sensitivity: number,
  seatYaw: number | null,
): View {
  let yaw = view.yaw - dx * sensitivity;
  let pitch = view.pitch - dy * sensitivity;
  pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  if (seatYaw !== null) yaw = clampSeatedYaw(yaw, seatYaw, SEAT_LOOK_LIMIT);
  return { yaw, pitch };
}
