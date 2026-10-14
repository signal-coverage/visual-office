import type { UserRecord } from "./userStore.ts";

/** The least time between two status changes of somebody, so a client cannot flood the room with them. */
export const STATUS_COOLDOWN_MS = 400;
/** The least time between two emotes of somebody. */
export const EMOTE_COOLDOWN_MS = 1000;

/**
 * Whether somebody may change what they show as doing. Everybody may, for now.
 * This is the one place to decide otherwise later: the server is the
 * authority, the menu only offers it.
 */
export function mayChangeStatus(user: UserRecord | null): boolean {
  void user; // who it is does not matter yet
  return true;
}

/** Whether somebody may make a gesture. Everybody may, for now. */
export function mayEmote(user: UserRecord | null): boolean {
  void user;
  return true;
}

/** Whether enough time has passed since the last one to accept another. */
export function cooledDown(
  last: number | undefined,
  now: number,
  gapMs: number,
): boolean {
  return last === undefined || now - last >= gapMs;
}
