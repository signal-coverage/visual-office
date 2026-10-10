import { NAME_STORAGE_KEY } from "./consts";

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

/** `?debug` in the link opens the diagnostics panel from the start. */
export function debugFromUrl(): boolean {
  return new URLSearchParams(window.location.search).has("debug");
}
