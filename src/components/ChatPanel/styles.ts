import type { CSSProperties } from "react";
import { chatColor } from "../../../shared/chatColor.ts";

export const container =
  "pointer-events-none fixed bottom-4 left-4 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-1.5 text-sm text-white";
export const list = "m-0 flex list-none flex-col gap-1 p-0";
export const message =
  "rounded-lg bg-black/55 px-2.5 py-1 [overflow-wrap:anywhere]";
/** The colour comes from the sender, so it cannot be a fixed class. */
export const authorColor = (color: number): CSSProperties => ({
  color: chatColor(color),
});
export const author = "mr-1.5";
export const hint = "text-xs opacity-70";
export const input =
  "pointer-events-auto border border-white/40 bg-black/75 text-sm text-white";
