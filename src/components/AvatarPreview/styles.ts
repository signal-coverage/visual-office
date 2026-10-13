import type { CSSProperties } from "react";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH } from "./consts";

/** The frame stays the same size whether the preview could be drawn or not. */
export const container: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: PREVIEW_WIDTH,
  height: PREVIEW_HEIGHT,
  borderRadius: 12,
  overflow: "hidden",
  background: "radial-gradient(circle at 50% 35%, #4a4f66, #23252f)",
  fontSize: 13,
  textAlign: "center",
};

export const canvas = {
  width: `${PREVIEW_WIDTH}px`,
  height: `${PREVIEW_HEIGHT}px`,
  display: "block",
};
