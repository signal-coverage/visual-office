import { cn } from "../../lib/cn";

export const dialog = "w-full max-w-2xl rounded-xl p-5 shadow-2xl";
export const title = "font-display text-xl font-bold";
export const body = "flex flex-col gap-4";
export const notice = "m-0 text-sm text-muted";
export const error = "m-0 text-sm text-danger";
export const badge = "ml-2";
export const code = "text-xs text-muted";
export const form = "flex flex-wrap items-end gap-2";
export const field = "w-full";
export const templateText = "flex flex-col";
export const result = (ok: boolean) =>
  cn("m-0 text-sm", ok ? "text-success" : "text-danger");
export const actions = "flex justify-end";
export const rowActions = "flex flex-wrap items-center justify-end gap-1.5";
export const question = "m-0 max-w-xs text-xs";
export const section = "flex flex-col gap-2";
export const sectionTitle = "m-0 font-display text-base font-bold";
export const renameDialog = "w-full max-w-md rounded-xl p-5 shadow-2xl";
export const renameForm = "flex flex-col gap-3";
export const footer = "flex justify-end gap-2";
