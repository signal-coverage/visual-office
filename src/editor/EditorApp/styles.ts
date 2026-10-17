import { cn } from "../../lib/cn";

export const page = "fixed inset-0 flex flex-col bg-background text-foreground";
export const toolbar =
  "flex items-center gap-2.5 border-b border-separator bg-surface px-3.5 py-2";
export const title = "m-0 mr-3 whitespace-nowrap text-base font-semibold";
export const spacer = "flex-1";
export const snap = "w-auto flex-row items-center gap-2 whitespace-nowrap";
export const status = (unsaved: boolean) =>
  cn("text-[13px]", unsaved ? "text-warning" : "text-muted");
export const body = "flex min-h-0 flex-1";
export const stage = "flex-1 overflow-auto p-3";
export const canvas = (cursor: "default" | "copy" | "crosshair") =>
  cn(
    "block rounded-lg bg-white shadow-sm",
    cursor === "copy"
      ? "cursor-copy"
      : cursor === "crosshair"
        ? "cursor-crosshair"
        : "cursor-default",
  );
export const side =
  "flex w-[280px] flex-col gap-[18px] overflow-y-auto border-l border-separator bg-surface p-3.5";
export const legend = "m-0 text-xs leading-normal text-muted";
