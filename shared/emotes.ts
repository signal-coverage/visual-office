/** The short gestures a player can make, one at a time, seen by everybody. */
export const EMOTES = ["wave", "clap", "raise", "thumbs", "dance"] as const;
export type Emote = (typeof EMOTES)[number];

export const EMOTE_LABELS: Readonly<Record<Emote, string>> = {
  wave: "Wave",
  clap: "Clap",
  raise: "Raise hand",
  thumbs: "Thumbs up",
  dance: "Dance",
};

/** What floats above the head while it lasts. */
export const EMOTE_ICONS: Readonly<Record<Emote, string>> = {
  wave: "\u{1F44B}",
  clap: "\u{1F44F}",
  raise: "✋",
  thumbs: "\u{1F44D}",
  dance: "\u{1F483}",
};

/** What the server tells everybody when somebody makes a gesture. */
export interface EmoteMessage {
  /** The session of whoever made it. */
  id: string;
  emote: Emote;
}

/** How long an emote is shown, both the movement and the icon. */
export const EMOTE_DURATION_MS = 3000;

/** The icon fades in the last part of that time. */
const FADE_MS = 500;
/** How high the icon rises over the whole time, in meters. */
const RISE_METERS = 0.35;

const isEmote = (value: unknown): value is Emote =>
  typeof value === "string" && (EMOTES as readonly string[]).includes(value);

/** Validates an untrusted `emote` message from a client: an emote from the fixed list, or null. */
export function sanitizeEmote(payload: unknown): Emote | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { emote } = payload as Record<string, unknown>;
  return isEmote(emote) ? emote : null;
}

/** The emote for a number key: Digit1 is the first, and so on. */
export function emoteByKey(code: string): Emote | null {
  const match = /^Digit([1-9])$/.exec(code);
  return match ? (EMOTES[Number(match[1]) - 1] ?? null) : null;
}

export interface EmoteIconState {
  visible: boolean;
  /** 0 to 1. */
  opacity: number;
  /** How far above where it started, in meters. */
  lift: number;
}

/** Where the floating icon is `elapsedMs` after the emote started. */
export function emoteIconState(elapsedMs: number): EmoteIconState {
  if (elapsedMs < 0 || elapsedMs >= EMOTE_DURATION_MS)
    return { visible: false, opacity: 0, lift: 0 };
  const fadeStart = EMOTE_DURATION_MS - FADE_MS;
  return {
    visible: true,
    opacity:
      elapsedMs <= fadeStart ? 1 : (EMOTE_DURATION_MS - elapsedMs) / FADE_MS,
    lift: (elapsedMs / EMOTE_DURATION_MS) * RISE_METERS,
  };
}
