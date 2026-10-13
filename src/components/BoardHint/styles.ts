import type { CSSProperties } from "react";

export const bar: CSSProperties = {
  position: "fixed",
  bottom: 56,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.55)",
  color: "#fff",
  fontSize: 13,
  pointerEvents: "none",
};

export const pens: CSSProperties = { display: "flex", gap: 6 };

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export const pen = (color: number, selected: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  boxSizing: "border-box",
  borderRadius: "50%",
  background: hex(color),
  border: selected ? "3px solid #5b8cff" : "2px solid rgba(255,255,255,0.5)",
  transform: selected ? "scale(1.25)" : "none",
});
