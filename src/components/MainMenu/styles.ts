import type { CSSProperties } from "react";

/** A soft warm backdrop drawn by CSS alone: glows in two corners and a faint floor-plan grid. */
export const backdropStyle: CSSProperties = {
  backgroundImage: [
    "radial-gradient(60rem 38rem at 12% -5%, color-mix(in oklch, var(--accent) 26%, transparent), transparent 62%)",
    "radial-gradient(48rem 36rem at 105% 105%, color-mix(in oklch, var(--default) 80%, transparent), transparent 62%)",
    "repeating-linear-gradient(0deg, transparent 0 55px, color-mix(in oklch, var(--foreground) 4%, transparent) 55px 56px)",
    "repeating-linear-gradient(90deg, transparent 0 55px, color-mix(in oklch, var(--foreground) 4%, transparent) 55px 56px)",
    "linear-gradient(165deg, var(--background), var(--surface-secondary))",
  ].join(", "),
};

export const root =
  "fixed inset-0 flex flex-col overflow-hidden bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] text-foreground";
export const accountMenu =
  "absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-20";
export const header =
  "relative z-10 flex shrink-0 flex-col items-center px-12 pt-1 text-center [@media(min-height:700px)]:pt-8";
export const title =
  "m-0 font-display text-4xl font-extrabold tracking-tight text-foreground [text-shadow:0_2px_0_color-mix(in_oklch,var(--accent)_30%,transparent),0_8px_30px_color-mix(in_oklch,var(--accent)_45%,transparent)] min-[640px]:text-6xl lg:text-7xl [@media(max-height:500px)]:!text-3xl";
export const tagline =
  "m-0 mt-1 text-sm text-muted sm:text-base [@media(max-height:500px)]:hidden";
export const message = "mt-3 w-full max-w-xl text-left";
export const stage =
  "relative z-10 mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-cols-1 items-center gap-3 landscape:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] landscape:gap-8";
export const menu =
  "mx-auto flex max-h-full min-h-0 w-full max-w-sm flex-col gap-2 overflow-y-auto p-1 landscape:mx-0";
export const item =
  "h-12 min-h-12 w-full shrink-0 justify-start px-5 font-display text-base font-semibold [@media(min-height:640px)]:h-14 [@media(min-height:640px)]:text-lg";
export const itemNote = "m-0 mt-0.5 px-5 text-xs text-muted";
export const hero =
  "flex min-h-0 flex-col items-center justify-center gap-1 portrait:order-first";
export const playerName =
  "m-0 max-w-full truncate font-display text-xl font-semibold [@media(max-height:500px)]:text-base";
export const hints =
  "relative z-10 m-0 flex shrink-0 list-none flex-wrap justify-center gap-x-5 gap-y-1 p-0 pt-2 text-sm text-muted [@media(max-height:699px)]:hidden";
export const hintRow = "flex items-center gap-1.5";
export const dialog = "w-full max-w-md rounded-xl p-5 shadow-2xl";
export const dialogTitle = "font-display text-2xl font-bold";
export const dialogText = "m-0 text-sm text-muted";
export const dialogActions = "flex items-center justify-end gap-2";
export const tools = "grid grid-cols-1 gap-2 sm:grid-cols-2";
