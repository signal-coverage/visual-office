import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

export const button =
  "glass fixed left-4 top-[52px] h-auto min-h-0 gap-2 px-3 py-1.5 text-[13px] font-medium";
export const meter = "ml-1 flex h-3.5 items-end gap-0.5";

/** Bars grow taller from left to right; the lit ones are green, turning red at the loud end. */
export const bar = (lit: boolean, index: number) =>
  cn(
    "w-1 rounded-[1px]",
    lit ? (index >= 6 ? "bg-[#ff5c5c]" : "bg-[#3ddc84]") : "bg-white/20",
  );

/** Each bar is a little taller than the one before it. */
export const barHeight = (index: number): CSSProperties => ({
  height: 4 + index * 1.4,
});

export const dot = (color: string) => cn("size-2.5 rounded-full", color);
