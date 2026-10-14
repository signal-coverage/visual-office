import {
  COMMON_FLOOR_ID,
  COMMON_FLOOR_NAME,
  FLOOR_FORBIDDEN_CODE,
  FLOOR_FORBIDDEN_MESSAGE,
  FLOOR_UNAVAILABLE_CODE,
  FLOOR_UNAVAILABLE_MESSAGE,
  FLOOR_UNKNOWN_CODE,
  FLOOR_UNKNOWN_MESSAGE,
  sanitizeFloorId,
} from "../shared/floors.ts";
import { mayEnterFloor } from "./floorAccess.ts";
import type { FloorRecord, FloorStore } from "./floorStore.ts";
import type { Roles } from "./userStore.ts";

/**
 * The floor a player asks for in the options they join with: the common floor
 * when they say nothing (an older client, the lite screen), the floor when it
 * is a valid id, and null for anything else, which is refused and never taken
 * for the common floor.
 */
export function floorFromOptions(options: unknown): string | null {
  const raw =
    typeof options === "object" && options !== null
      ? (options as { floor?: unknown }).floor
      : undefined;
  if (raw === undefined || raw === null || raw === "") return COMMON_FLOOR_ID;
  return sanitizeFloorId(raw);
}

export type Entry =
  | { ok: true; floor: FloorRecord }
  | { ok: false; code: number; message: string };

export interface EntryDeps {
  floors: Pick<FloorStore, "get" | "floorsOf">;
  rolesOf: (userId: string) => Promise<Roles>;
}

const refused = (code: number, message: string): Entry => ({
  ok: false,
  code,
  message,
});

/**
 * Whether somebody may be in a floor, decided from what the server has now:
 * the floor must exist, and (see `mayEnterFloor`) the person must be allowed.
 * `userId` is null when sign-in is off. When the database cannot say, the
 * answer is no, except for the common floor: that must never lock everybody out.
 */
export async function checkEntry(
  floorId: string,
  userId: string | null,
  deps: EntryDeps,
): Promise<Entry> {
  let floor: FloorRecord | null;
  try {
    floor = await deps.floors.get(floorId);
  } catch (error) {
    console.error("Could not look up the floor:", error);
    if (floorId !== COMMON_FLOOR_ID)
      return refused(FLOOR_UNAVAILABLE_CODE, FLOOR_UNAVAILABLE_MESSAGE);
    floor = {
      id: COMMON_FLOOR_ID,
      name: COMMON_FLOOR_NAME,
      common: true,
      createdAt: 0,
    };
  }
  if (!floor) return refused(FLOOR_UNKNOWN_CODE, FLOOR_UNKNOWN_MESSAGE);
  if (userId === null || floor.common) return { ok: true, floor };

  try {
    const roles = await deps.rolesOf(userId);
    const granted = (await deps.floors.floorsOf(userId)).includes(floor.id);
    return mayEnterFloor(roles, floor, granted)
      ? { ok: true, floor }
      : refused(FLOOR_FORBIDDEN_CODE, FLOOR_FORBIDDEN_MESSAGE);
  } catch (error) {
    console.error("Could not check who may enter the floor:", error);
    return refused(FLOOR_UNAVAILABLE_CODE, FLOOR_UNAVAILABLE_MESSAGE);
  }
}

/**
 * The status to refuse with before there is a room: that answer is HTTP, which
 * cannot carry a code like 4009 (once somebody is in a room the close code can).
 */
export function statusBeforeTheRoom(code: number): number {
  if (code === FLOOR_UNKNOWN_CODE) return 404;
  if (code === FLOOR_UNAVAILABLE_CODE) return 503;
  if (code === FLOOR_FORBIDDEN_CODE) return 403;
  return code >= 200 && code <= 599 ? code : 500;
}
