import type { CSSProperties } from "react";
import { chatColor } from "../../../shared/chatColor.ts";

export const panel: CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  minWidth: 160,
  maxWidth: 240,
  maxHeight: "40vh",
  overflowY: "auto",
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.55)",
  color: "#fff",
  fontSize: 13,
  pointerEvents: "none",
};

export const title: CSSProperties = {
  marginBottom: 4,
  fontSize: 12,
  opacity: 0.75,
};

export const list: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
};

export const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "1px 0",
};

export const name = (color: number): CSSProperties => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: chatColor(color),
});

export const place: CSSProperties = {
  flexShrink: 0,
  fontSize: 11,
  opacity: 0.7,
};
