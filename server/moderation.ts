import type { Roles } from "./userStore.ts";

/** Who is moderating: a person (with the id of their account) or the server's own tools (no id). */
export interface Moderator {
  id: string | null;
  roles: Roles;
}

export interface ModerationTarget {
  id: string;
  roles: Roles;
}

export type ModerationVerdict =
  { ok: true } | { ok: false; reason: "not_allowed" | "self" | "admin" };

/** Whether somebody may moderate a floor at all: an admin, or the head of that floor. */
export function canModerate(roles: Roles, floor: string): boolean {
  return roles.admin || roles.headOf.includes(floor);
}

/**
 * Whether `actor` may act on `target` on this floor. The one place that decides
 * it, from roles the server looked up: nothing here comes from the client.
 * Nobody acts on themselves, and nobody acts on an admin.
 */
export function mayModerate(
  actor: Moderator,
  target: ModerationTarget,
  floor: string,
): ModerationVerdict {
  if (!canModerate(actor.roles, floor))
    return { ok: false, reason: "not_allowed" };
  if (actor.id !== null && actor.id === target.id)
    return { ok: false, reason: "self" };
  if (target.roles.admin) return { ok: false, reason: "admin" };
  return { ok: true };
}
