import { ROOM_NAME } from "./constants.ts";
import type { Furniture } from "./furniture.ts";
import type { PropPlacement } from "./props.ts";

/**
 * The first floor, which every installation has: the main office. It is the
 * common floor everybody may enter, and where a player who does not say which
 * floor they want (an older client, the lite screen) goes.
 */
export const COMMON_FLOOR_ID = ROOM_NAME;

/** What the main office is called until somebody renames it. */
export const COMMON_FLOOR_NAME = "Main office";

export const MAX_FLOOR_ID_LENGTH = 32;
export const MAX_FLOOR_NAME_LENGTH = 40;

/** Ids that would clash with a route, a room of the game server or a word with a meaning. */
export const RESERVED_FLOOR_IDS: readonly string[] = [
  "admin",
  "account",
  "api",
  "all",
  "calendar",
  "common",
  "default",
  "floor",
  "floors",
  "health",
  "lobby",
  "matchmake",
  "new",
  "none",
  "null",
  "undefined",
];

const FLOOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** The id of a floor, if `raw` is one: lowercase letters, digits and single hyphens, short, not reserved. Never fixes anything up. */
export function sanitizeFloorId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < 1 || raw.length > MAX_FLOOR_ID_LENGTH) return null;
  if (!FLOOR_ID_PATTERN.test(raw)) return null;
  return RESERVED_FLOOR_IDS.includes(raw) ? null : raw;
}

/** What is left of a floor's name once control characters, extra spaces and the excess length are gone, or null when nothing is. */
export function sanitizeFloorName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FLOOR_NAME_LENGTH)
    .trim();
  return name || null;
}

/** An id made from a name ("Human Resources" gives "human-resources"), or null when nothing usable is left. */
export function slugFromName(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_FLOOR_ID_LENGTH)
    .replace(/-+$/, "");
  return sanitizeFloorId(slug);
}

/** A floor as a player is told about it. It never says who else may enter. */
export interface FloorInfo {
  id: string;
  name: string;
  /** Everybody in the company may enter it. */
  common: boolean;
  /** Whether this player may enter it. */
  canEnter: boolean;
}

/** Which floor a player is in, sent as they join, for the badge on screen. */
export interface FloorMessage {
  id: string;
  name: string;
}

/** Disconnected because the floor is not one they may enter. */
export const FLOOR_FORBIDDEN_CODE = 4007;
export const FLOOR_FORBIDDEN_MESSAGE =
  "You are not allowed to enter this room. Ask your administrator.";

/** Disconnected from a floor they were entitled to, until it was taken away: the game moves them to the common floor. */
export const FLOOR_ACCESS_LOST_CODE = 4008;
export const FLOOR_ACCESS_LOST_MESSAGE =
  "You no longer have access to that room. Moving you to the main office.";

/** The floor asked for does not exist. */
export const FLOOR_UNKNOWN_CODE = 4009;
export const FLOOR_UNKNOWN_MESSAGE = "That room does not exist.";

/** Who may enter could not be checked (the database is down). */
export const FLOOR_UNAVAILABLE_CODE = 4010;
export const FLOOR_UNAVAILABLE_MESSAGE =
  "Could not check that room right now. Try again in a moment.";

/** What the menu says about a room the player may not enter. */
export const FLOOR_NOT_AVAILABLE_TEXT =
  "Not available. Ask your administrator to visit it.";

/** What to tell somebody the server would not let into a floor, or null for a code that is not one of these. */
export function messageForFloorCode(code: number): string | null {
  if (code === FLOOR_FORBIDDEN_CODE) return FLOOR_FORBIDDEN_MESSAGE;
  if (code === FLOOR_ACCESS_LOST_CODE) return FLOOR_ACCESS_LOST_MESSAGE;
  if (code === FLOOR_UNKNOWN_CODE) return FLOOR_UNKNOWN_MESSAGE;
  if (code === FLOOR_UNAVAILABLE_CODE) return FLOOR_UNAVAILABLE_MESSAGE;
  return null;
}

/** The code a player is disconnected with when their floor closes for editing. */
export const FLOOR_CLOSED_CODE = 4003;

export const FLOOR_CLOSED_MESSAGE =
  "This floor is closed while it is being edited. Try again in a moment.";

/**
 * The code a player is disconnected with when the floor's layout was published
 * while they were inside: the game joins again by itself, to a room made from it.
 */
export const FLOOR_UPDATED_CODE = 4004;

export const FLOOR_UPDATED_MESSAGE = "The floor was updated.";

/**
 * What stands in the floor, sent to each player who joins: the stored layout,
 * or (`version` null) the one every build carries by default.
 */
export interface LayoutMessage {
  version: number | null;
  furniture: Furniture[];
  models: PropPlacement[];
}

/** Sent to everybody on a floor that is about to close for editing. */
export interface ClosingMessage {
  seconds: number;
}
