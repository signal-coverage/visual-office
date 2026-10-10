export const MAX_CHAT_LENGTH = 200;
export const CHAT_COOLDOWN_MS = 400;

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  at: number;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Validates an untrusted `chat` message from a client. Returns the cleaned
 * text, or null when there is nothing worth broadcasting.
 */
export function sanitizeChat(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { text } = payload as Record<string, unknown>;
  if (typeof text !== "string") return null;
  const clean = text
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, MAX_CHAT_LENGTH);
  return clean.length > 0 ? clean : null;
}
