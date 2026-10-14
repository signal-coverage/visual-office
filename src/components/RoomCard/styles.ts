import { cn } from "../../lib/cn";
import type { DrawKind } from "../../floors/previewDraw";

export const card = (here: boolean) =>
  cn(
    "group relative block h-auto w-full overflow-hidden rounded-xl bg-surface-secondary p-0 text-left shadow-sm transition-shadow motion-reduce:transition-none",
    here && "ring-2 ring-accent",
  );
export const svg = "block h-auto w-full";

const GREY: Record<DrawKind, string> = {
  floor: "fill-[#e6e6e6]",
  zone: "fill-[#d2d2d2]",
  item: "fill-[#b0b0b0]",
  glass: "fill-[#c9c9c9]",
  wall: "fill-[#8c8c8c]",
};

const WARM_ON_HOVER: Record<DrawKind, string> = {
  floor:
    "group-hover:fill-[#f6e6c8] group-focus-visible:fill-[#f6e6c8] group-data-[hovered=true]:fill-[#f6e6c8]",
  zone: "group-hover:fill-[#bfdcc4] group-focus-visible:fill-[#bfdcc4] group-data-[hovered=true]:fill-[#bfdcc4]",
  item: "group-hover:fill-[#c8a27a] group-focus-visible:fill-[#c8a27a] group-data-[hovered=true]:fill-[#c8a27a]",
  glass:
    "group-hover:fill-[#9fd0d4] group-focus-visible:fill-[#9fd0d4] group-data-[hovered=true]:fill-[#9fd0d4]",
  wall: "group-hover:fill-[#7a5a3c] group-focus-visible:fill-[#7a5a3c] group-data-[hovered=true]:fill-[#7a5a3c]",
};

/** Grey always; warm only when somebody points at or focuses a room they may enter. */
export const rect = (kind: DrawKind, canEnter: boolean) =>
  cn(
    "transition-colors motion-reduce:transition-none",
    GREY[kind],
    canEnter && WARM_ON_HOVER[kind],
  );

export const nameTag =
  "pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-lg bg-black/60 px-2 py-0.5 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[hovered=true]:opacity-100 motion-reduce:transition-none";
export const here =
  "pointer-events-none absolute bottom-2 right-2 rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground";
export const unavailable =
  "pointer-events-none absolute inset-x-0 bottom-0 whitespace-normal bg-black/75 p-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[hovered=true]:opacity-100 motion-reduce:transition-none";
