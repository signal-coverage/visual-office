import type { CSSProperties } from "react";

export const container: CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  width: 360,
  maxWidth: "calc(100vw - 32px)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  pointerEvents: "none",
  color: "#fff",
  fontSize: 14,
};

export const list: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export const message: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.55)",
  overflowWrap: "anywhere",
};

export const author: CSSProperties = {
  marginRight: 6,
  color: "#9ad1ff",
};

export const hint: CSSProperties = {
  opacity: 0.7,
  fontSize: 12,
};

export const input: CSSProperties = {
  pointerEvents: "auto",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.4)",
  background: "rgba(0, 0, 0, 0.75)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};
