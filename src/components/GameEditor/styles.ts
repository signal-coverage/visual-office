import type { CSSProperties } from "react";

/** Covers the office: the editor takes the whole window while it is open. */
export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
};

export const loading: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eceef3",
  color: "#1d2030",
  fontFamily: "system-ui, sans-serif",
};
