import type { CSSProperties } from "react";
import { chatColor } from "../../../shared/chatColor.ts";

export const container =
  "pointer-events-none fixed bottom-4 left-4 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-1.5 text-sm text-white";
export const list = "m-0 flex list-none flex-col gap-1 p-0";
export const message = "glass px-2.5 py-1 [overflow-wrap:anywhere]";
export const direct = "border-accent/60";
/** The colour comes from the sender, so it cannot be a fixed class. */
export const authorColor = (color: number): CSSProperties => ({
  color: chatColor(color),
});
export const author = "mr-1.5";
export const tag = "mr-1.5 text-[11px] uppercase tracking-wide opacity-70";
export const openButton =
  "glass pointer-events-auto h-auto min-h-0 px-3 py-1.5 text-[13px] font-semibold";
export const anchor = "self-start";
export const form = "glass pointer-events-auto flex flex-col gap-1.5 p-1.5";
export const field = "w-full";
export const person = "flex items-center gap-2";
export const input = "text-sm";
