import {
  appearanceFromJson,
  type Appearance,
} from "../../shared/appearance.ts";
import { messageForAuthCode } from "../../shared/auth.ts";
import {
  FLOOR_CLOSED_CODE,
  FLOOR_CLOSED_MESSAGE,
  FLOOR_UNAVAILABLE_MESSAGE,
  FLOOR_UNKNOWN_MESSAGE,
  messageForFloorCode,
} from "../../shared/floors.ts";
import { messageForModerationCode } from "../../shared/moderation.ts";
import {
  APPEARANCE_STORAGE_KEY,
  CONNECTION_LOST_MESSAGE,
  NAME_STORAGE_KEY,
  UNREACHABLE_MESSAGE,
} from "./consts";

/** Why somebody is back at the menu after being connected. */
export function messageForDisconnect(code: number): string {
  return code === FLOOR_CLOSED_CODE
    ? FLOOR_CLOSED_MESSAGE
    : (messageForModerationCode(code) ??
        messageForFloorCode(code) ??
        CONNECTION_LOST_MESSAGE);
}

/** The refusals the server gives before there is a room come as plain HTTP statuses: its own words are the ones to show. */
const PRE_ROOM_MESSAGES = new Map<number, string>([
  [404, FLOOR_UNKNOWN_MESSAGE],
  [503, FLOOR_UNAVAILABLE_MESSAGE],
]);

/** Why joining failed: the floor is closed for editing, or the server cannot be reached. */
export function messageForJoinError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === FLOOR_CLOSED_CODE) return FLOOR_CLOSED_MESSAGE;
  const message =
    typeof error === "object" && error !== null
      ? (error as { message?: unknown }).message
      : undefined;
  if (
    typeof code === "number" &&
    message !== undefined &&
    PRE_ROOM_MESSAGES.get(code) === message
  )
    return message as string;
  return (
    (typeof code === "number"
      ? (messageForAuthCode(code) ??
        messageForModerationCode(code) ??
        messageForFloorCode(code))
      : null) ?? UNREACHABLE_MESSAGE
  );
}

/** A name passed in the link (`?name=Ana`) skips the lobby. Handy for invites and testing. */
export function nameFromUrl(): string | null {
  const name = new URLSearchParams(window.location.search).get("name")?.trim();
  return name || null;
}

// Storage can be missing or throw (private windows, blocked site data): the app works without it.
export function loadSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // ignore
  }
}

/** The look chosen last time, or `fallback` when there is none (or it is damaged). */
export function loadAppearance(fallback: Appearance): Appearance {
  try {
    return appearanceFromJson(
      window.localStorage.getItem(APPEARANCE_STORAGE_KEY),
      fallback,
    );
  } catch {
    return fallback;
  }
}

export function saveAppearance(appearance: Appearance) {
  try {
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify(appearance),
    );
  } catch {
    // ignore
  }
}

/** `?debug` in the link opens the diagnostics panel from the start. */
export function debugFromUrl(): boolean {
  return new URLSearchParams(window.location.search).has("debug");
}

/** What decides whether the office should tell the player to click to take the mouse back. */
export interface ClickPromptState {
  online: boolean;
  /** The mouse is captured by the scene. */
  locked: boolean;
  menuOpen: boolean;
  chatOpen: boolean;
  calendarOpen: boolean;
  mapOpen: boolean;
  /** A computer or a shelf is open: it has the mouse on purpose. */
  panelOpen: boolean;
}

/**
 * Whether to ask for a click: the player is in the office with a free mouse and
 * nothing that took it on purpose. The browser does not let Esc give the mouse
 * back (it is not a click), so after closing the menu with it this is the cue.
 */
export function showClickPrompt(state: ClickPromptState): boolean {
  return (
    state.online &&
    !state.locked &&
    !state.menuOpen &&
    !state.chatOpen &&
    !state.calendarOpen &&
    !state.mapOpen &&
    !state.panelOpen
  );
}
