import type { CSSProperties } from "react";

export const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  padding: 16,
  overflowY: "auto",
  boxSizing: "border-box",
  background: "rgba(14, 15, 20, 0.92)",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
};

export const title: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 600,
};

export const subtitle: CSSProperties = { margin: 0, opacity: 0.75 };

export const note: CSSProperties = {
  margin: 0,
  maxWidth: 420,
  fontSize: 13,
  lineHeight: 1.5,
  textAlign: "center",
  opacity: 0.6,
};
