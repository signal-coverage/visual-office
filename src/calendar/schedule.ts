import type { CalendarEvent } from "../../shared/calendar.ts";
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
