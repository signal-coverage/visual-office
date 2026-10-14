import { cn } from "../../lib/cn";

export const dialog = "w-full max-w-xl rounded-xl p-5 shadow-2xl";
export const title = "font-display text-xl font-bold";
export const note = "m-0 text-sm text-muted";
export const error = "m-0 text-sm text-danger";
export const rooms = "m-0 flex list-none flex-col gap-4 p-0";
export const room = "rounded-lg bg-surface-secondary p-3";
export const roomName = "m-0 font-display text-base font-bold";
export const hint = (live: boolean) =>
  cn("m-0 mt-0.5 text-sm", live ? "font-semibold text-success" : "text-muted");
export const stale = "m-0 mt-1 text-xs text-warning";
export const events = "m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm";
export const event = "flex gap-3";
export const range = "w-32 shrink-0 tabular-nums text-muted";
export const eventTitle = "min-w-0 flex-1 truncate";
export const actions = "flex items-center justify-between gap-2";
