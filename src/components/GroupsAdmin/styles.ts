import { cn } from "../../lib/cn";

export const page =
  "fixed inset-0 z-[1000] flex flex-col bg-background text-foreground";
export const toolbar =
  "flex items-center gap-3 border-b border-separator bg-surface px-3.5 py-2";
export const title = "m-0 font-display text-base font-bold";
export const spacer = "flex-1";
export const body = "flex-1 overflow-y-auto p-4";
export const intro = "mb-3 max-w-2xl text-sm leading-normal text-muted";
export const notice = (error: boolean) =>
  cn("mb-3 text-sm", error ? "text-danger" : "text-muted");
export const table = "max-w-4xl";
export const groupName = "font-semibold";
export const chips = "flex flex-wrap gap-1";
export const small = "text-xs text-muted";
export const actions = "flex flex-wrap items-center gap-1.5";
export const question = "m-0 max-w-xs text-xs";

export const dialog = "w-full max-w-2xl rounded-xl p-5 shadow-2xl";
export const dialogTitle = "font-display text-xl font-bold";
export const form = "flex flex-col gap-4";
export const field = "w-full";
export const counter = "text-xs text-muted";
export const section = "flex flex-col gap-2";
export const sectionTitle = "m-0 text-sm font-semibold";
export const checkList =
  "flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-separator p-2";
export const check = "flex flex-row items-center gap-2";
export const personText = "flex flex-col";
export const result = (ok: boolean) =>
  cn("m-0 text-sm", ok ? "text-success" : "text-danger");
export const footer = "flex justify-end gap-2";
