/** The keys reminded at the bottom of the screen, with what each does. */
export const HUD_HINTS: ReadonlyArray<readonly [key: string, action: string]> =
  [
    ["WASD", "move"],
    ["Shift", "run"],
    ["Enter", "chat"],
    ["M", "voice"],
    ["C", "camera"],
    ["P", "screen"],
    ["K", "knock"],
    ["F", "use"],
    ["Z", "status"],
    ["E", "emote"],
    ["Tab", "people"],
    ["F3", "stats"],
    ["Esc", "menu"],
  ];

/** Only reminded when there is more than one room. */
export const MAP_HINT = ["R", "rooms"] as const;

export const UNREACHABLE_MESSAGE =
  "Could not reach the office server. Check that it is running and try again.";

export const RECONNECTING_MESSAGE = "Connection lost. Reconnecting…";

export const SOFTWARE_RENDERING_MESSAGE =
  "Slow graphics: your browser is drawing without a graphics card. Turn on hardware acceleration in its settings.";

export const DEBUG_KEY = "F3";

export const ROSTER_KEY = "Tab";

/** How long a notice stays on screen. */
export const NOTICE_MS = 5000;

export const CONNECTION_LOST_MESSAGE = "You were disconnected from the office.";

/** Chat messages kept in memory; the panel only renders the most recent ones. */
export const MAX_STORED_MESSAGES = 50;

export const NAME_STORAGE_KEY = "visual-office:name";
export const APPEARANCE_STORAGE_KEY = "visual-office:appearance";

/** Shown while the lite screen is downloaded. */
export const LITE_LOADING_TEXT = "Loading…";
