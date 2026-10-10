import type { CSSProperties } from "react";

export const button: CSSProperties = {
  position: "fixed",
  top: 52,
  left: 16,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  border: "none",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.55)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
};

export const dot = (color: string): CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: color,
});
