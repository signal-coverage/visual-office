export const MAX_CHAT_LENGTH = 200;
export const CHAT_COOLDOWN_MS = 400;

/** Who a message is for: everybody, the people who can hear the sender, or one person. */
export const CHAT_SCOPES = ["everyone", "nearby", "dm"] as const;
export type ChatScope = (typeof CHAT_SCOPES)[number];

export const CHAT_SCOPE_LABELS: Readonly<Record<ChatScope, string>> = {
  everyone: "Everyone",
  nearby: "Nearby",
  dm: "Direct",
};

/** The longest session id the server will look up for a direct message. */
const MAX_TARGET_LENGTH = 64;

/** Why the server did not deliver a message. */
export type ChatRefusal = "self" | "gone";

export const CHAT_REFUSAL_TEXT: Readonly<Record<ChatRefusal, string>> = {
  self: "You cannot send a direct message to yourself.",
  gone: "That person is not in the office any more.",
};

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  at: number;
  /** Who it was for; messages from older servers have none and are for everybody. */
  scope?: ChatScope;
  /** For a direct message: who it is for, and what they are called. */
  to?: string;
  toName?: string;
  /** The server asks the receiver not to make noise about it (they asked not to be disturbed). */
  quiet?: boolean;
  /** The sender's chat colour (an index, see chatColor.ts), as the server knows it. */
  color: number;
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

/** What an untrusted `chat` message asks for, once cleaned. */
export interface ChatRequest {
  text: string;
  scope: ChatScope;
  /** The session of the person a direct message is for. */
  to?: string;
}

const isScope = (value: unknown): value is ChatScope =>
  typeof value === "string" &&
  (CHAT_SCOPES as readonly string[]).includes(value);

/**
 * Validates an untrusted `chat` message: the text, who it is for, and for a
 * direct message the person. Only what the server can look up gets through;
 * who actually receives it is decided by the server, not by this.
 */
export function sanitizeChatRequest(payload: unknown): ChatRequest | null {
  const text = sanitizeChat(payload);
  if (text === null) return null;
  const { scope, to } = payload as Record<string, unknown>;
  if (scope === undefined) return { text, scope: "everyone" };
  if (!isScope(scope)) return null;
  if (scope !== "dm") return { text, scope };
  if (typeof to !== "string") return null;
  const target = to.trim();
  if (target.length === 0 || target.length > MAX_TARGET_LENGTH) return null;
  return { text, scope, to: target };
}
