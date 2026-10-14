import type { QualityChoice } from "../../game/quality";
import { MAX_SENSITIVITY, MIN_SENSITIVITY } from "../../App/settings";

export const TITLE = "Menu";

export const ITEMS = {
  resume: "Back to the office",
  character: "Your character",
  status: "Your status",
  emotes: "Emotes",
  knock: "Knock (K)",
  map: "Map of rooms (R)",
  rooms: "Rooms",
  calendar: "Room calendars",
  controls: "Controls",
  options: "Options",
  moderation: "Moderation",
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

export const STATUS = {
  title: "Your status",
  intro:
    "Say what you are doing. Everybody sees it next to your name. You show as away by yourself after a few minutes without touching anything, and as in a meeting while you are in the meeting room, unless you chose something else.",
  label: "Status",
  showing: "Everybody sees you as",
  back: "Back",
} as const;

export const EMOTES_PANEL = {
  title: "Emotes",
  intro: "Make a gesture. Everybody nearby sees it for a few seconds.",
  hint: "In the office, hold E and press the number.",
  back: "Back",
} as const;

export const CONTROLS_TITLE = "Controls";

export const OPTIONS = {
  title: "Options",
  sensitivity: "Mouse sensitivity",
  hints: "Show the keys at the bottom of the screen",
  sound: "Play a sound for direct messages and knocks",
  desktop:
    "Show desktop notifications for direct messages when this tab is hidden",
  desktopBlocked:
    "Your browser is blocking notifications for this site. Allow them in its site settings, then turn this on.",
  quality: "Graphics quality",
  qualityNote:
    "Low turns the shadows off, draws at a lower resolution and updates people far away less often. Auto switches to Low by itself when the game runs slowly, and never switches back. The edge smoothing changes the next time the page loads.",
  back: "Back",
} as const;

export const QUALITY_LABELS: Readonly<Record<QualityChoice, string>> = {
  auto: "Auto",
  high: "High",
  low: "Low (for slower computers)",
};

/** The range of the sensitivity slider: what the settings allow. */
export const SENSITIVITY_RANGE = {
  min: MIN_SENSITIVITY,
  max: MAX_SENSITIVITY,
  step: 0.1,
} as const;
