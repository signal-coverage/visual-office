import type { CalendarEvent } from "../shared/calendar.ts";
import {
  resolveRooms,
  type CalendarService,
  type RoomSource,
} from "./calendarService.ts";
import type { AdminReply } from "./floorAdmin.ts";

const HOUR = 3_600_000;
/** How far from now the viewer's day may start. */
const MAX_DAY_SHIFT = 36 * HOUR;
const MIN_DAY = 20 * HOUR;
const MAX_DAY = 28 * HOUR;

export interface CalendarRoomsDeps {
  calendar: CalendarService;
  rooms: RoomSource;
  now?: () => number;
}

export interface CalendarRequest {
  method: string;
  path: string;
  /** `dayStart` and `dayEnd` (ms: the viewer's day) and `date` (their `YYYY-MM-DD`). */
  query?: Record<string, string>;
}

/** Only what people need to know when to join. */
const shown = ({
  title,
  start,
  end,
  allDay,
}: CalendarEvent): CalendarEvent => ({
  title,
  start,
  end,
  allDay,
});

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });

async function route(
  request: CalendarRequest,
  deps: CalendarRoomsDeps,
): Promise<AdminReply | null> {
  if (request.path !== "/calendar") return null;
  if (request.method !== "GET")
    return { status: 405, body: { error: "Use GET." } };

  const now = (deps.now ?? Date.now)();
  const query = request.query ?? {};
  const dayStart = Number(query.dayStart);
  const dayEnd = Number(query.dayEnd);
  if (
    !query.dayStart ||
    !query.dayEnd ||
    !Number.isInteger(dayStart) ||
    !Number.isInteger(dayEnd) ||
    Math.abs(dayStart - now) > MAX_DAY_SHIFT ||
    dayEnd - dayStart < MIN_DAY ||
    dayEnd - dayStart > MAX_DAY ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")
  )
    return bad("Say which day you mean.");

  const day = { now, dayStart, dayEnd, date: query.date };
  const rooms = await Promise.all(
    (await resolveRooms(deps.rooms)).map(
      async ({ id, label, floor, floorName }) => {
        const schedule = await deps.calendar.scheduleOf(id, day);
        return {
          room: id,
          label,
          ...(floor !== undefined && floorName !== undefined
            ? { floor, floorName }
            : {}),
          configured: schedule.configured,
          stale: schedule.stale,
          current: schedule.current && shown(schedule.current),
          next: schedule.next && shown(schedule.next),
          today: schedule.today.map(shown),
        };
      },
    ),
  );
  return { status: 200, body: { rooms } };
}

/**
 * What the rooms are doing, for anybody in the company: now, next and the day,
 * titles and times only. The address of a feed is never part of it. Who may
 * ask (signed in, when sign-in is on) is decided before. Returns null for a
 * path that is not its own.
 */
export async function handleCalendar(
  request: CalendarRequest,
  deps: CalendarRoomsDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Calendar could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
