import type { CSSProperties } from "react";

export const canvas: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  display: "block",
  cursor: "pointer",
};

const overlay: CSSProperties = {
  position: "fixed",
  padding: "6px 12px",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.55)",
  color: "#fff",
  pointerEvents: "none",
};

export const status: CSSProperties = {
  ...overlay,
  top: 16,
  left: 16,
  fontSize: 13,
};

export const banner: CSSProperties = {
  ...overlay,
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(200, 60, 60, 0.9)",
  fontSize: 14,
};

export const gpuWarning: CSSProperties = {
  ...overlay,
  top: 56,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "min(640px, calc(100vw - 32px))",
  background: "rgba(200, 120, 20, 0.92)",
  fontSize: 13,
  textAlign: "center",
};

export const hint: CSSProperties = {
  ...overlay,
  bottom: 16,
  right: 16,
  fontSize: 12,
};

/** The way into the menu for whoever does not know Esc: it only works when the mouse is free. */
export const menuButton =
  "fixed right-4 top-4 h-auto min-h-0 rounded-lg bg-black/55 px-3 py-1.5 text-[13px] font-normal text-white";
