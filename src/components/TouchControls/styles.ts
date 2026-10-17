import { cn } from "../../lib/cn";

/** Every button is at least 48 px square: a thumb needs more than a mouse. */
const round =
  "glass pointer-events-auto relative size-12 min-h-12 min-w-12 touch-manipulation select-none p-0 text-xl [-webkit-touch-callout:none]";

/** The buttons along the right edge, from the top. When the screen is too short for one column the rest wrap into another beside it. */
export const column =
  "pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5rem)] z-10 flex flex-col flex-wrap-reverse content-start items-end gap-2";

export const button = (on = false) =>
  cn(round, on && "bg-accent text-accent-foreground");

export const badge = "absolute -right-1 -top-1";

export const voiceDot = (color: string) =>
  cn("absolute right-1 top-1 size-2.5 rounded-full", color);
export const meter =
  "pointer-events-none absolute inset-x-2 bottom-1 flex h-1.5 items-end gap-px";
export const meterBar = (lit: boolean) =>
  cn("h-full flex-1 rounded-[1px]", lit ? "bg-[#3ddc84]" : "bg-white/20");

/** The one big button, under the right thumb: what using where the person looks does, or getting up. */
export const use =
  "pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10 h-14 min-w-14 touch-manipulation select-none rounded-full px-6 text-base font-semibold shadow-xl [-webkit-touch-callout:none]";

/** The gestures, above the joystick, in one row. */
export const emotes =
  "glass pointer-events-auto fixed bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+11.5rem)] left-1/2 z-10 flex -translate-x-1/2 gap-1.5 p-1.5";
export const emoteButton =
  "size-12 min-h-12 min-w-12 touch-manipulation p-0 text-2xl";
