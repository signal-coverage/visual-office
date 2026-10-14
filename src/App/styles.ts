import type { CSSProperties } from "react";

export const canvas: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  display: "block",
  cursor: "pointer",
};

export const status =
  "glass pointer-events-none fixed left-4 top-4 flex items-center gap-2 px-3 py-1.5 font-display text-[13px] font-semibold";

export const banner =
  "pointer-events-none fixed left-1/2 top-4 -translate-x-1/2 rounded-xl bg-danger/90 px-4 py-1.5 text-sm font-semibold text-danger-foreground backdrop-blur-md";

export const gpuWarning =
  "pointer-events-none fixed left-1/2 top-14 max-w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-xl bg-warning/90 px-4 py-1.5 text-center text-[13px] font-medium text-warning-foreground backdrop-blur-md";

export const hint =
  "glass pointer-events-none fixed bottom-4 right-4 flex max-w-[min(520px,calc(100vw-408px))] flex-wrap justify-end gap-x-3 gap-y-1.5 px-3 py-2 text-xs";
export const hintItem = "flex items-center gap-1.5";
export const hintKey = "bg-white/15 text-white";

/** The way into the menu for whoever does not know Esc: it only works when the mouse is free. */
export const menuButton =
  "glass fixed right-4 top-4 h-auto min-h-0 px-3 py-1.5 text-[13px] font-semibold";

export const loading =
  "fixed inset-0 grid place-items-center bg-background text-foreground";
