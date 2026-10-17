import type { CalendarEvent } from "../../shared/calendar.ts";
import { COMMON_FLOOR_ID } from "../../shared/floors.ts";
import {
  formatTime,
  formatWhen,
  isSameDay,
  type FormatOptions,
  type RoomView,
} from "./format";

/** When an event is on: "16:00 – 17:00", or "All day". */
export function eventRange(
  event: CalendarEvent,
  options: FormatOptions = {},
): string {
  if (event.allDay) return "All day";
  const start = formatTime(event.start, options);
  if (event.end <= event.start) return start;
  return `${start} – ${formatWhen(event.end, event.start, options)}`;
}

/**
 * The name of a room in a list of all of them: the main office's rooms are
 * called what they are, and the rooms of another floor say which floor, since
 * two floors can have a room of the same name.
 */
export function roomTitle(room: {
  label: string;
  floor?: string;
  floorName?: string;
}): string {
  return room.floor === undefined ||
    room.floor === COMMON_FLOOR_ID ||
    room.floorName === undefined
    ? room.label
    : `${room.label} · ${room.floorName}`;
}

/** The room with this name on this floor; a server that does not say the floors is read by name alone. */
export function findRoom<T extends { label: string; floor?: string }>(
  rooms: readonly T[],
  label: string,
  floor: string,
): T | undefined {
  return rooms.find(
    (room) =>
      room.label === label &&
      (room.floor === undefined || room.floor === floor),
  );
}

/** What to tell somebody looking at a room: whether to walk in, or when to. */
export function joinHint(
  room: RoomView,
  now: number,
  label: string,
  options: FormatOptions = {},
): string {
  if (!room.configured) return "No calendar connected to this room.";
  if (room.current) return `Happening now. Walk into the ${label} to join.`;
  const { next } = room;
  if (!next) return "Nothing scheduled.";
  const minutes = Math.ceil((next.start - now) / 60_000);
  if (minutes <= 15)
    return `Starts in ${minutes} min. Walk into the ${label} to join.`;
  return isSameDay(next.start, now, options.timeZone)
    ? `Next at ${formatTime(next.start, options)}.`
    : `Next on ${formatWhen(next.start, now, options)}.`;
}
