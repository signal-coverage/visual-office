import type { Box } from "../../shared/collision.ts";
import type { View } from "./view";

export const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** A box on the plan as x, y, width, height in pixels. */
export function rect(view: View, box: Box): [number, number, number, number] {
  const [x0, y0] = view.worldToScreen(box.minX, box.minZ);
  const [x1, y1] = view.worldToScreen(box.maxX, box.maxZ);
  return [x0, y0, x1 - x0, y1 - y0];
}

export function fillBox(
  ctx: CanvasRenderingContext2D,
  view: View,
  box: Box,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(...rect(view, box));
}

export function outlineBoxes(
  ctx: CanvasRenderingContext2D,
  view: View,
  boxes: Box[],
  color: string,
  width: number,
  dash: number[] = [],
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  for (const box of boxes) ctx.strokeRect(...rect(view, box));
  ctx.restore();
}

export function label(
  ctx: CanvasRenderingContext2D,
  view: View,
  text: string,
  x: number,
  z: number,
  color = "#222",
  align: CanvasTextAlign = "center",
) {
  const [sx, sy] = view.worldToScreen(x, z);
  ctx.fillStyle = color;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, sx, sy);
}
