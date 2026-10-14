import { cn } from "../../lib/cn";

export const dialog = "w-full max-w-2xl rounded-xl p-5 shadow-2xl";
export const title = "font-display text-xl font-bold";
export const notice = "m-0 text-sm text-muted";
export const error = "m-0 text-sm text-danger";
export const rooms = "m-0 flex list-none flex-col gap-4 p-0";
export const row = "flex flex-col gap-2 rounded-lg bg-surface-secondary p-3";
export const field = "w-full";
export const buttons = "flex flex-wrap items-center gap-2";
export const result = (ok: boolean) =>
  cn("m-0 text-sm", ok ? "text-success" : "text-danger");
export const actions = "flex justify-end";
