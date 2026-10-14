import { cn } from "../../lib/cn";

export const dialog = "w-full max-w-2xl rounded-xl p-5 shadow-2xl";
export const title = "font-display text-xl font-bold";
export const body = "gap-4";
export const notice = "m-0 text-sm text-muted";
export const error = "m-0 text-sm text-danger";
export const badge = "ml-2";
export const code = "text-xs text-muted";
export const form = "flex items-end gap-2";
export const field = "w-full";
export const result = (ok: boolean) =>
  cn("m-0 text-sm", ok ? "text-success" : "text-danger");
export const actions = "flex justify-end";
