import { desktopAlertText } from "./alerts";
import type { ChatMessage } from "../../shared/chat.ts";

/** Whether this browser has notifications of its own at all. */
export function desktopSupported(): boolean {
  return typeof Notification !== "undefined";
}

/** What the browser allows right now, or null where there are no notifications. */
export function desktopPermission(): string | null {
  return desktopSupported() ? Notification.permission : null;
}

/**
 * Asks the browser for permission. Only call it from something the player just
 * did (the browser refuses otherwise). True when they are allowed now.
 */
export async function requestDesktopPermission(): Promise<boolean> {
  if (!desktopSupported()) return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Shows the browser's notification for a message; nothing happens where that is not possible. */
export function showDesktopNotification(message: ChatMessage): void {
  try {
    const { title, body } = desktopAlertText(message);
    new Notification(title, { body, tag: "visual-office-direct" });
  } catch {
    // a notification that cannot be shown is not a problem
  }
}
