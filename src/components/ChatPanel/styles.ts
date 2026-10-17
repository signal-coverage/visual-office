import type { CSSProperties } from "react";
import { chatColor } from "../../../shared/chatColor.ts";

export const container =
  "pointer-events-none fixed bottom-4 left-4 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-1.5 text-sm text-white";
/** On a phone the messages sit above the joystick, clear of the buttons on the right. */
export const touchContainer =
  "pointer-events-none fixed bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+11.5rem)] left-[max(0.75rem,env(safe-area-inset-left))] flex w-[360px] max-w-[calc(100vw-9rem)] flex-col gap-1.5 text-sm text-white";
/** While writing, the form sits just above the keyboard (`--keyboard` is how much of the bottom it covers). */
export const touchWriting =
  "pointer-events-none fixed bottom-[calc(var(--keyboard,0px)+max(0.5rem,env(safe-area-inset-bottom)))] left-[max(0.5rem,env(safe-area-inset-left))] flex w-[calc(100vw-1rem)] max-w-[480px] flex-col gap-1.5 text-sm text-white";
export const list = "m-0 flex list-none flex-col gap-1 p-0";
export const message = "glass px-2.5 py-1 [overflow-wrap:anywhere]";
export const direct = "border-accent/60";
/** The colour comes from the sender, so it cannot be a fixed class. */
export const authorColor = (color: number): CSSProperties => ({
  color: chatColor(color),
});
export const author = "mr-1.5";
export const tag = "mr-1.5 text-[11px] uppercase tracking-wide opacity-70";
export const openButton =
  "glass pointer-events-auto h-auto min-h-0 px-3 py-1.5 text-[13px] font-semibold";
export const anchor = "self-start";
export const form = "glass pointer-events-auto flex flex-col gap-1.5 p-1.5";
export const field = "w-full";
export const person = "flex items-center gap-2";
export const input = "text-sm";
/** At least 16 px, or a phone zooms the page when the field takes the focus. */
export const touchInput = "text-base";
export const row = "flex items-center gap-1.5";
export const rowInput = "min-w-0 flex-1";
export const rowButton = "min-h-11 min-w-11 shrink-0";

/** Lifts the form above the virtual keyboard, which covers this many pixels of the bottom. */
export const keyboardInset = (pixels: number): CSSProperties =>
  ({ "--keyboard": `${pixels}px` }) as CSSProperties;
