/** One thing in a room's calendar. Only what people need to know when to join: no attendees, no description. */
export interface CalendarEvent {
  title: string;
  /** Milliseconds since 1970. For an all-day event, midnight UTC of its first day. */
  start: number;
  /** Milliseconds since 1970, not included. For an all-day event, midnight UTC of the day after its last. */
  end: number;
  allDay: boolean;
}

/** What a room is doing, for the viewer's day. */
export interface RoomSchedule {
  current: CalendarEvent | null;
  next: CalendarEvent | null;
  today: CalendarEvent[];
}

export const MAX_TITLE_LENGTH = 80;
export const MAX_TODAY_EVENTS = 30;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;

/** A title that is safe to show: no control characters, one line, bounded. Busy when there is nothing to show. */
export function cleanTitle(raw: string | undefined): string {
  const text = (raw ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Busy";
  return text.length > MAX_TITLE_LENGTH
    ? `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : text;
}

export interface DayWindow {
  now: number;
  /** When the viewer's day starts and ends, in their time zone. */
  dayStart: number;
  dayEnd: number;
  /** The viewer's date, `YYYY-MM-DD`: the days of all-day events are dates, not instants. */
  date: string;
}

const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  Number(b.allDay) - Number(a.allDay) ||
  a.start - b.start ||
  a.title.localeCompare(b.title);

/** What is on now, what comes next and what the day holds. All-day events only appear in the day's list. */
export function scheduleFor(
  events: readonly CalendarEvent[],
  { now, dayStart, dayEnd, date }: DayWindow,
): RoomSchedule {
  const timed = events
    .filter((event) => !event.allDay)
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  const today = events
    .filter((event) =>
      event.allDay
        ? dateOf(event.start) <= date && date < dateOf(event.end)
        : event.start < dayEnd && event.end > dayStart,
    )
    .sort(byStart)
    .slice(0, MAX_TODAY_EVENTS);
  return {
    current: timed.find((e) => e.start <= now && now < e.end) ?? null,
    next: timed.find((e) => e.start > now) ?? null,
    today,
  };
}
