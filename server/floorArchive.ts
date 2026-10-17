import { COMMON_FLOOR_ID } from "../shared/floors.ts";
import type { FloorRecord } from "./floorStore.ts";

/** Whether a room is archived: hidden, and closed to everybody. */
export function isArchived(floor: { archivedAt?: number | null }): boolean {
  return floor.archivedAt !== undefined && floor.archivedAt !== null;
}

export const ARCHIVE_REFUSALS = {
  main: "The main office cannot be archived: it is where everybody goes.",
  lastCommon:
    "The last common room cannot be archived: everybody needs a room to go to.",
} as const;

/**
 * Why a room may not be archived, or null when it may: the one place that
 * decides it. The main office never can, and neither can the last common room
 * that is not archived (the room people are sent to when theirs is closed).
 */
export function archiveRefusal(
  floor: Pick<FloorRecord, "id" | "common">,
  floors: ReadonlyArray<Pick<FloorRecord, "id" | "common" | "archivedAt">>,
): string | null {
  if (floor.id === COMMON_FLOOR_ID) return ARCHIVE_REFUSALS.main;
  if (!floor.common) return null;
  const others = floors.filter(
    (other) => other.id !== floor.id && other.common && !isArchived(other),
  );
  return others.length === 0 ? ARCHIVE_REFUSALS.lastCommon : null;
}
