import { MAX_SENSITIVITY, MIN_SENSITIVITY } from "../../App/settings";

export const TITLE = "Menu";

export const ITEMS = {
  resume: "Back to the office",
  character: "Your character",
  controls: "Controls",
  options: "Options",
  leave: "Leave the office",
  signOut: "Sign out",
} as const;

export const CHARACTER = {
  title: "Your character",
  intro: "Change how you look whenever you like. Everybody sees it at once.",
  save: "Save",
  saved: "Saved. Everybody sees your new look.",
  back: "Back",
} as const;

export const CONTROLS_TITLE = "Controls";

export const OPTIONS = {
  title: "Options",
  sensitivity: "Mouse sensitivity",
  hints: "Show the keys at the bottom of the screen",
  back: "Back",
} as const;

/** The range of the sensitivity slider: what the settings allow. */
export const SENSITIVITY_RANGE = {
  min: MIN_SENSITIVITY,
  max: MAX_SENSITIVITY,
  step: 0.1,
} as const;
