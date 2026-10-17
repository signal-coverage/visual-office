import type { CSSProperties } from "react";

export const frame: CSSProperties = {
  position: "fixed",
  top: 88,
  left: 16,
  width: 176,
  height: 132,
  overflow: "hidden",
  borderRadius: 10,
  background: "#000",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
  pointerEvents: "none",
};

/** On a phone the frame is a corner of the column of badges, not the middle of the screen. */
export const touchFrame: CSSProperties = {
  ...frame,
  width: 96,
  height: 72,
};

/** Applied to the <video> that LiveKit creates: fills the frame and mirrors like a mirror would. */
export const video: Partial<CSSStyleDeclaration> = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  transform: "scaleX(-1)",
};
