/** The code a player is disconnected with when a moderator removes them from the office. */
export const KICKED_CODE = 4005;
/** The code a player is refused or disconnected with while they are banned. */
export const BANNED_CODE = 4006;

export const KICKED_MESSAGE =
  "You were removed from the office by a moderator.";
export const BANNED_MESSAGE =
  "You were removed from the office by a moderator and cannot come back yet. Try again later.";

const MESSAGES = new Map<number, string>([
  [KICKED_CODE, KICKED_MESSAGE],
  [BANNED_CODE, BANNED_MESSAGE],
]);

/** What to tell the person for a code a moderator's action ended in, or null if it is not one of these. */
export function messageForModerationCode(code: number): string | null {
  return MESSAGES.get(code) ?? null;
}

export const MODERATION_ACTIONS = [
  "mute",
  "unmute",
  "kick",
  "ban",
  "unban",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const DEFAULT_BAN_MINUTES = 10;
export const MIN_BAN_MINUTES = 1;
export const MAX_BAN_MINUTES = 240;

const MAX_TARGET_LENGTH = 64;

/** What a moderator asks for: an action on somebody in the room (their session) and, for a ban, for how long. */
export interface ModerationRequest {
  action: ModerationAction;
  target: string;
  minutes?: number;
}

const isAction = (value: unknown): value is ModerationAction =>
  typeof value === "string" &&
  (MODERATION_ACTIONS as readonly string[]).includes(value);

/** The length of a ban in whole minutes, inside the bounds; the default when none was asked for. */
export function banMinutes(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_BAN_MINUTES;
  return Math.min(MAX_BAN_MINUTES, Math.max(MIN_BAN_MINUTES, Math.round(raw)));
}

/** Validates an untrusted `moderate` message from a client. */
export function sanitizeModerationRequest(
  payload: unknown,
): ModerationRequest | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return null;
  const { action, target, minutes } = payload as Record<string, unknown>;
  if (!isAction(action)) return null;
  if (
    typeof target !== "string" ||
    target.length < 1 ||
    target.length > MAX_TARGET_LENGTH
  )
    return null;
  return action === "ban"
    ? { action, target, minutes: banMinutes(minutes) }
    : { action, target };
}

/** Why a moderator's action was not done. */
export type ModerationRefusal =
  | "not_allowed"
  | "self"
  | "admin"
  | "gone"
  | "unknown_user"
  | "not_here"
  | "not_banned"
  | "unavailable";

export const REFUSAL_TEXT: Readonly<Record<ModerationRefusal, string>> = {
  not_allowed: "You are not allowed to moderate.",
  self: "You cannot do that to yourself.",
  admin: "Admins cannot be moderated.",
  gone: "That person is no longer here.",
  unknown_user: "Nobody with that id has signed in.",
  not_here: "That person is not in the office.",
  not_banned: "That person is not banned.",
  unavailable: "That could not be done right now. Try again in a moment.",
};

/** What the server answers a moderator who asked for something. */
export type ModerationReply =
  | { ok: true; action: ModerationAction; name: string; minutes?: number }
  | { ok: false; reason: ModerationRefusal };

/** What a moderator reads after an action. */
export function moderationReplyText(reply: ModerationReply): string {
  if (!reply.ok) return REFUSAL_TEXT[reply.reason];
  switch (reply.action) {
    case "mute":
      return `${reply.name} was muted.`;
    case "unmute":
      return `${reply.name} can speak again.`;
    case "kick":
      return `${reply.name} was removed from the office.`;
    case "ban":
      return `${reply.name} was banned for ${reply.minutes} minute${reply.minutes === 1 ? "" : "s"}.`;
    case "unban":
      return `${reply.name} is no longer banned.`;
  }
}

/** Sent to somebody whose voice was muted or allowed again by a moderator. */
export interface VoiceMutedMessage {
  muted: boolean;
}

/** Whether somebody may moderate here: sent to them when they join and when their roles change. */
export interface ModeratorMessage {
  can: boolean;
}

export const MUTED_NOTICE = "A moderator muted your microphone.";
export const UNMUTED_NOTICE = "A moderator let you speak again.";
