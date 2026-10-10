import type { CSSProperties } from "react";

export const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

export const value = (bad: boolean | undefined): CSSProperties => ({
  textAlign: "right",
  overflowWrap: "anywhere",
  color: bad === undefined ? "inherit" : bad ? "#ff7b7b" : "#8be28b",
});
