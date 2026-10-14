import { sanitizeQuality, type QualityChoice } from "../game/quality";

/** What a player can set in the menu. Kept on this browser: it is about how their computer feels, not who they are. */
export interface Settings {
  /** How fast the view turns with the mouse, as a multiple of the usual speed. */
  mouseSensitivity: number;
  /** Whether the bar with the keys is shown at the bottom. */
  showHints: boolean;
  /** Whether a short beep goes with a direct message or a knock (unless the player asked not to be disturbed). */
  notificationSound: boolean;
  /** Whether the browser's own notification says so when a direct message arrives while the tab is hidden. */
  desktopNotifications: boolean;
  /** How much detail the office is drawn with: auto picks by how well the computer keeps up. */
  quality: QualityChoice;
}

export const MIN_SENSITIVITY = 0.4;
export const MAX_SENSITIVITY = 2.5;

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 1,
  showHints: true,
  notificationSound: true,
  desktopNotifications: false,
  quality: "auto",
};

export const SETTINGS_STORAGE_KEY = "visual-office:settings";

/** Settings from something untrusted (storage that may be old, edited or damaged): each part is checked on its own. */
export function sanitizeSettings(raw: unknown): Settings {
  const source =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const {
    mouseSensitivity,
    showHints,
    notificationSound,
    desktopNotifications,
    quality,
  } = source;
  return {
    mouseSensitivity:
      typeof mouseSensitivity === "number" && Number.isFinite(mouseSensitivity)
        ? Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, mouseSensitivity))
        : DEFAULT_SETTINGS.mouseSensitivity,
    showHints:
      typeof showHints === "boolean" ? showHints : DEFAULT_SETTINGS.showHints,
    notificationSound:
      typeof notificationSound === "boolean"
        ? notificationSound
        : DEFAULT_SETTINGS.notificationSound,
    desktopNotifications:
      typeof desktopNotifications === "boolean"
        ? desktopNotifications
        : DEFAULT_SETTINGS.desktopNotifications,
    quality: sanitizeQuality(quality),
  };
}

/** Reads saved settings, tolerating nothing saved or text that is not JSON. */
export function settingsFromJson(json: string | null): Settings {
  if (!json) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(json));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Storage can be missing or throw (private windows, blocked site data): the app works without it.
export function loadSettings(): Settings {
  try {
    return settingsFromJson(window.localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
