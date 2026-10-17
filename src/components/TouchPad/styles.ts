import type { CSSProperties } from "react";

/** The whole screen: a finger on it turns the view. It lies under every button, and nothing of the page may react to the finger. */
export const surface =
  "fixed inset-0 touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none]";

/** The place of the joystick: a generous target around the visible base, clear of the notch and the home bar. */
export const stickZone =
  "fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-10 grid size-[176px] touch-none select-none place-items-center [-webkit-touch-callout:none] [-webkit-user-select:none]";
export const stickBase =
  "pointer-events-none grid size-[136px] place-items-center rounded-full border-2 border-white/60 bg-black/25 backdrop-blur-sm";
export const stickThumb =
  "pointer-events-none size-[60px] rounded-full border-2 border-white bg-white/60 shadow-lg";

/** The thumb follows the finger, held inside the base. */
export const thumbAt = (x: number, y: number): CSSProperties => ({
  transform: `translate(${x}px, ${y}px)`,
});
