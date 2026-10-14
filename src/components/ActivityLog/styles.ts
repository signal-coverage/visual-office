import { cn } from "../../lib/cn";

export const page =
  "fixed inset-0 z-[1000] flex flex-col bg-background text-foreground";
export const toolbar =
  "flex items-center gap-3 border-b border-separator bg-surface px-3.5 py-2";
export const title = "m-0 font-display text-base font-bold";
export const body = "flex-1 overflow-y-auto p-4";
export const intro = "mb-3 max-w-2xl text-sm leading-normal text-muted";
export const notice = (error: boolean) =>
  cn("mb-3 text-sm", error ? "text-danger" : "text-muted");
export const table = "max-w-4xl";
export const when = "whitespace-nowrap text-xs text-muted";
export const more = "mt-3 flex max-w-4xl justify-center";
