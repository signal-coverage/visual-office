import type { CSSProperties } from "react";

export const badge = (mine: boolean): CSSProperties => ({
  position: "fixed",
  top: 128,
  left: 16,
  padding: "6px 12px",
  borderRadius: 8,
  background: mine ? "rgba(200, 60, 60, 0.9)" : "rgba(40, 90, 160, 0.9)",
  color: "#fff",
  fontSize: 13,
  pointerEvents: "none",
});
