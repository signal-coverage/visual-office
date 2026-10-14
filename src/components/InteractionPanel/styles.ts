import { cn } from "../../lib/cn";

export const panel = (interactive: boolean) =>
  cn(
    "glass fixed left-1/2 z-10 -translate-x-1/2 gap-2 rounded-2xl p-5",
    interactive
      ? "pointer-events-auto top-[10%] w-[min(560px,calc(100vw-32px))]"
      : "pointer-events-none top-[30%] w-[min(420px,calc(100vw-32px))]",
  );
export const title = "font-display text-lg font-bold";
export const content = (interactive: boolean) =>
  cn(
    "text-[15px] leading-normal text-foreground/90",
    interactive && "max-h-[min(55vh,480px)] overflow-y-auto pr-1",
  );
export const footer = "flex items-center gap-1.5 text-xs text-muted";
export const close = "ml-auto";
export const key = "bg-white/15 text-white";
