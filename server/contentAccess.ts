import { canEditFloor, type Actor } from "./actor.ts";

/**
 * Whether this caller may add, change or remove the books and announcements of a
 * floor: an admin on any floor, and the head of a floor on their own. It is the
 * same rule as editing the floor's layout, on purpose; to make it admins only,
 * change this one function.
 */
export function mayEditContent(actor: Actor, floor: string): boolean {
  return canEditFloor(actor, floor);
}
