import type { CSSProperties } from "react";

export const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "rgba(12, 13, 18, 0.72)",
  backdropFilter: "blur(6px)",
  color: "#fff",
};

export const card: CSSProperties = {
  width: "min(420px, 100%)",
  boxSizing: "border-box",
  padding: 28,
  borderRadius: 16,
  background: "rgba(30, 32, 42, 0.96)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
};

export const title: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 600,
};

export const subtitle: CSSProperties = {
  margin: "6px 0 22px",
  opacity: 0.75,
  fontSize: 14,
};

export const form: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export const label: CSSProperties = { fontSize: 13, opacity: 0.8 };

export const input: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.25)",
  background: "rgba(0, 0, 0, 0.35)",
  color: "#fff",
  fontSize: 16,
  outline: "none",
};

export const button = (disabled: boolean): CSSProperties => ({
  marginTop: 8,
  padding: "12px 16px",
  border: "none",
  borderRadius: 8,
  background: disabled ? "#4a4d5e" : "#5b8cff",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
});

export const message: CSSProperties = {
  margin: "12px 0 0",
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(255, 92, 92, 0.15)",
  color: "#ff9b9b",
  fontSize: 13,
};

export const controls: CSSProperties = {
  margin: "22px 0 0",
  padding: 0,
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "6px 14px",
  fontSize: 13,
};

/** Lets the key and its label sit directly in the parent grid's two columns. */
export const controlRow: CSSProperties = { display: "contents" };

export const key: CSSProperties = {
  justifySelf: "start",
  padding: "1px 8px",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.12)",
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: 12,
};
