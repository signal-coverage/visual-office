import { cn } from "../../lib/cn";

export const box = "flex flex-col gap-1.5";
export const heading =
  "m-0 text-xs font-semibold uppercase tracking-wide text-muted";
export const fine = "py-1.5";
export const blocked = "m-0 text-[13px] font-semibold text-danger";
export const list = "m-0 flex list-none flex-col gap-1 p-0";
export const problem = (error: boolean) =>
  cn(
    "h-auto min-h-0 w-full justify-start whitespace-normal px-2.5 py-1.5 text-left text-[13px] font-normal",
    error
      ? "border-danger/40 text-danger"
      : "border-warning/50 text-foreground",
  );
export const level = "mr-1.5 text-[11px] font-semibold uppercase";
