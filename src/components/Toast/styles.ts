import type { CSSProperties } from "react";

export const toast: CSSProperties = {
  position: "fixed",
  top: 96,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "min(560px, calc(100vw - 32px))",
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.8)",
  color: "#fff",
  fontSize: 14,
  textAlign: "center",
  pointerEvents: "none",
};
