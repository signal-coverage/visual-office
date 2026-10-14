import type { CSSProperties } from "react";

/** The frame stays the same size whether the preview could be drawn or not. */
export const container = (width: number, height: number): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  width,
  height,
  overflow: "hidden",
  color: "var(--muted)",
  fontSize: 13,
  textAlign: "center",
  touchAction: "none",
  userSelect: "none",
});

export const canvas = (width: number, height: number): CSSProperties => ({
  width: `${width}px`,
  height: `${height}px`,
  display: "block",
});

/** A hand shows the character can be held; it closes while it is. */
export const draggable = "cursor-grab active:cursor-grabbing";
