export const HINT_STORAGE_KEY = "visual-office:touch-hint";

/** The part of `localStorage` the hint uses. */
export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): HintStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether the person already dismissed the hint. Storage can be missing or throw (private windows, blocked site data): then it is shown again. */
export function hintSeen(
  storage: HintStorage | null = browserStorage(),
): boolean {
  try {
    return storage?.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHintSeen(storage: HintStorage | null = browserStorage()) {
  try {
    storage?.setItem(HINT_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}
