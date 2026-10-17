import type { CalendarEvent } from "../../shared/calendar.ts";

/** A call to the game server that carries who is asking. */
export type Request = (url: string, init?: RequestInit) => Promise<Response>;

/** What a room is doing for the viewer's day, as the server tells it. */
export interface RoomCalendar {
  room: string;
  label: string;
  /** The floor it is on, and what that is called, when the server says. */
  floor?: string;
  floorName?: string;
  configured: boolean;
  /** The feed could not be read lately, so this may be out of date. */
  stale: boolean;
  current: CalendarEvent | null;
  next: CalendarEvent | null;
  today: CalendarEvent[];
}

/** A request that says who is asking, when there is a sign-in token. */
export function withToken(
  getToken: () => Promise<string | null>,
  send: Request = (url, init) => fetch(url, init),
): Request {
  return async (url, init) => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return send(url, { ...init, headers });
  };
}

const isEvent = (value: unknown): value is CalendarEvent => {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.title === "string" &&
    typeof event.start === "number" &&
    typeof event.end === "number" &&
    typeof event.allDay === "boolean"
  );
};

const isRoom = (value: unknown): value is RoomCalendar => {
  if (typeof value !== "object" || value === null) return false;
  const room = value as Record<string, unknown>;
  return (
    typeof room.room === "string" &&
    typeof room.label === "string" &&
    (room.floor === undefined || typeof room.floor === "string") &&
    (room.floorName === undefined || typeof room.floorName === "string") &&
    typeof room.configured === "boolean" &&
    typeof room.stale === "boolean" &&
    (room.current === null || isEvent(room.current)) &&
    (room.next === null || isEvent(room.next)) &&
    Array.isArray(room.today) &&
    room.today.every(isEvent)
  );
};

/** What the rooms are doing today, or null when the server would not say. */
export async function fetchRooms(
  request: Request,
  serverBase: string,
  day: { dayStart: number; dayEnd: number; date: string },
): Promise<RoomCalendar[] | null> {
  try {
    const query = new URLSearchParams({
      dayStart: String(day.dayStart),
      dayEnd: String(day.dayEnd),
      date: day.date,
    });
    const response = await request(`${serverBase}/calendar?${query}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { rooms?: unknown } | null;
    return Array.isArray(body?.rooms) && body.rooms.every(isRoom)
      ? body.rooms
      : null;
  } catch {
    return null;
  }
}
