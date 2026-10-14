import type { CSSProperties } from "react";
import { chatColor } from "../../../shared/chatColor.ts";

export const panel =
  "glass pointer-events-none fixed right-4 top-16 max-h-[40vh] min-w-40 max-w-60 overflow-y-auto px-3 py-2 text-[13px]";
export const title = "mb-1 text-xs opacity-75";
export const list = "m-0 list-none p-0";
export const row = "flex justify-between gap-2 py-px";
export const name = (color: number): CSSProperties => ({
  color: chatColor(color),
});
export const person = "flex min-w-0 items-center gap-1.5";
export const nameClass = "min-w-0 truncate";
export const place = "shrink-0 text-[11px] opacity-70";
