import type { CalendarEvent } from "../../shared/calendar.ts";

export interface FormatOptions {
  /** The viewer's language; their browser's when left out. */
  locale?: string;
  /** The viewer's time zone; their device's when left out. */
  timeZone?: string;
}

/** What is known of a room, as the texts need it. */
export interface RoomView {
  configured: boolean;
  current: CalendarEvent | null;
  next: CalendarEvent | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The viewer's day around `now`, on their own clock: when it starts and ends and its date. */
export function viewerDay(now: number): {
  dayStart: number;
  dayEnd: number;
  date: string;
} {
  const at = new Date(now);
  const [year, month, day] = [at.getFullYear(), at.getMonth(), at.getDate()];
  return {
    dayStart: new Date(year, month, day).getTime(),
    dayEnd: new Date(year, month, day + 1).getTime(),
    date: `${year}-${pad(month + 1)}-${pad(day)}`,
  };
}

/** The time of day in the viewer's zone, as their language writes it. */
export function formatTime(
  ms: number,
  { locale, timeZone }: FormatOptions = {},
) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(ms);
}

export const dayKey = (ms: number, timeZone?: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);

export const isSameDay = (a: number, b: number, timeZone?: string) =>
  dayKey(a, timeZone) === dayKey(b, timeZone);

/** The time, with the weekday in front when it is not the same day as `now`. */
export function formatWhen(
  ms: number,
  now: number,
  options: FormatOptions = {},
): string {
  const time = formatTime(ms, options);
  if (isSameDay(ms, now, options.timeZone)) return time;
  const weekday = new Intl.DateTimeFormat(options.locale, {
    weekday: "short",
    timeZone: options.timeZone,
  }).format(ms);
  return `${weekday} ${time}`;
}

/** The line of the badge in the office: what is on in the room and what comes next. Null when there is nothing to say. */
export function describeRoomNow(
  room: RoomView,
  now: number,
  options: FormatOptions = {},
): string | null {
  if (!room.configured) return null;
  const { current, next } = room;
  const later = next
    ? `Next: ${next.title} ${formatWhen(next.start, now, options)}`
    : null;
  if (current) {
    const on = `Now: ${current.title} until ${formatTime(current.end, options)}`;
    return later ? `${on} · ${later}` : on;
  }
  return later ? `Free now · ${later}` : null;
}
