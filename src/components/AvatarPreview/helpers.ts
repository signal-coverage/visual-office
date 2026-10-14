import { DRAG_SPEED } from "./consts";

/** The turn of the character after the pointer moved `deltaX` pixels to the right (left if negative). */
export function dragYaw(yaw: number, deltaX: number): number {
  return yaw + deltaX * DRAG_SPEED;
}
