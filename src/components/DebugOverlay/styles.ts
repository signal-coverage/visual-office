import type { CSSProperties } from "react";

export const panel: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  minWidth: 250,
  maxWidth: 340,
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(0, 0, 0, 0.72)",
  color: "#fff",
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.6,
  pointerEvents: "none",
};

export const title: CSSProperties = { opacity: 0.6, marginBottom: 4 };

export const warning: CSSProperties = {
  marginTop: 8,
  padding: "6px 8px",
  borderRadius: 6,
  background: "rgba(255, 92, 92, 0.25)",
  color: "#ffb0b0",
  fontFamily: "system-ui, sans-serif",
};
