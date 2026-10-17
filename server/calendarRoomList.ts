import { COMMON_FLOOR_ID } from "../shared/floors.ts";
import { isArchived } from "./floorArchive.ts";
import type { FloorStore } from "./floorStore.ts";
import { loadFloorScene } from "./floorScene.ts";
import type { LayoutStore } from "./layoutStore.ts";

/** A private room that can have a calendar. */
export interface CalendarRoom {
  /** The key of its feed in the settings: see `calendarRoomId`. */
  id: string;
  /** What people call it: the label of its zone. */
  label: string;
  floor: string;
  floorName: string;
}

/**
 * The id of the calendar of a private room. The main office keeps the bare
 * zone id its rooms always had (`meeting`), so the feeds already saved for it
 * stay where they are; every other floor puts its own id in front
 * (`marketing.room-a`). A floor id and a zone id never have a dot, so no two
 * rooms can end up with the same id.
 */
export function calendarRoomId(floor: string, zone: string): string {
  return floor === COMMON_FLOOR_ID ? zone : `${floor}.${zone}`;
}

/**
 * Every private room of every floor, from the shell each floor has now (a floor
 * with none stored has the default one, and so its meeting room). Asked for
 * each time, because floors are made and changed while the server runs.
 */
export async function calendarRoomsOf(
  floors: Pick<FloorStore, "list">,
  layouts: Pick<LayoutStore, "current">,
): Promise<CalendarRoom[]> {
  const rooms: CalendarRoom[] = [];
  for (const floor of await floors.list()) {
    // An archived room is closed to everybody: nobody is there to see its calendar
    if (isArchived(floor)) continue;
    const { scene } = await loadFloorScene(floor.id, layouts);
    for (const zone of scene.zones)
      rooms.push({
        id: calendarRoomId(floor.id, zone.id),
        label: zone.label,
        floor: floor.id,
        floorName: floor.name,
      });
  }
  return rooms;
}
