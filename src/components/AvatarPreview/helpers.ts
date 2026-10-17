import { DRAG_SPEED, type PREVIEW_SIZES } from "./consts";

/** The turn of the character after the pointer moved `deltaX` pixels to the right (left if negative). */
export function dragYaw(yaw: number, deltaX: number): number {
  return yaw + deltaX * DRAG_SPEED;
}

/** How big the character can be drawn so that the title, it and the options all fit the window. */
export function previewSizeFor(viewport: {
  width: number;
  height: number;
}): keyof typeof PREVIEW_SIZES {
  const { width, height } = viewport;
  if (height > width) return height >= 800 ? "medium" : "small";
  if (height >= 720 && width >= 800) return "large";
  return height >= 520 ? "medium" : "small";
}
