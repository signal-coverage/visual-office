import {
  appearanceFromJson,
  type Appearance,
} from "../../shared/appearance.ts";
import { messageForAuthCode } from "../../shared/auth.ts";
import {
  FLOOR_CLOSED_CODE,
  FLOOR_CLOSED_MESSAGE,
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
    : (messageForModerationCode(code) ?? CONNECTION_LOST_MESSAGE);
}

/** Why joining failed: the floor is closed for editing, or the server cannot be reached. */
export function messageForJoinError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === FLOOR_CLOSED_CODE) return FLOOR_CLOSED_MESSAGE;
  return (
    (typeof code === "number"
      ? (messageForAuthCode(code) ?? messageForModerationCode(code))
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
