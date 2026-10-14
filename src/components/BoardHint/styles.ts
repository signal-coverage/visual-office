import type { CSSProperties } from "react";

export const bar =
  "glass pointer-events-none fixed bottom-14 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 px-3.5 py-2 text-[13px]";

export const pens = "flex gap-1.5";

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export const pen = (color: number, selected: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  boxSizing: "border-box",
  borderRadius: "50%",
  background: hex(color),
  border: selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.5)",
  transform: selected ? "scale(1.25)" : "none",
});
