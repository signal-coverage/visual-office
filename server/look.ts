import {
  sameAppearance,
  sanitizeAppearance,
  type Appearance,
} from "../shared/appearance.ts";
import type { UserRecord } from "./userStore.ts";

/** The least time between two changes of somebody's look, so a client cannot flood the room with them. */
export const LOOK_COOLDOWN_MS = 400;

/**
 * Whether somebody may change how they look. Everybody may, for now. This is
 * the one place to decide otherwise later (a company that sets the looks
 * itself, or looks that have to be earned): the server is the authority, the
 * menu only offers it.
 */
export function mayChangeLook(user: UserRecord | null): boolean {
  void user; // who it is does not matter yet
  return true;
}

/**
 * The look to change to, from what a client sent: every part that is a valid
 * choice is taken and the rest stays as it was. Null when that is no change.
 */
export function nextLook(current: Appearance, raw: unknown): Appearance | null {
  const next = sanitizeAppearance(raw, current);
  return sameAppearance(current, next) ? null : next;
}

/** Whether enough time has passed since the last change to accept another. */
export function waitedEnough(last: number | undefined, now: number): boolean {
  return last === undefined || now - last >= LOOK_COOLDOWN_MS;
}
