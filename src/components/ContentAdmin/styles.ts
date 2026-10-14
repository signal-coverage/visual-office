import { cn } from "../../lib/cn";

export const dialog = "w-full max-w-3xl rounded-xl p-5 shadow-2xl";
export const title = "font-display text-xl font-bold";
export const body = "flex flex-col gap-4";
export const notice = "m-0 text-sm text-muted";
export const error = "m-0 text-sm text-danger";
export const room = "w-full max-w-xs";
export const toolbar = "flex flex-wrap items-center justify-between gap-2";
export const count = "text-xs text-muted";
export const tabPanel = "flex flex-col gap-3 pt-3";
export const itemTitle = "font-semibold";
export const badge = "ml-2";
export const small = "text-xs text-muted";
export const actions = "flex flex-wrap items-center justify-end gap-1.5";
export const question = "m-0 text-xs";
export const footer = "flex justify-end";
export const form = "flex flex-col gap-3";
export const field = "w-full";
export const counter = "text-xs text-muted";
export const result = (ok: boolean) =>
  cn("m-0 text-sm", ok ? "text-success" : "text-danger");
