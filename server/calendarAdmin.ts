import { auditActor, type AuditRecorder } from "./audit.ts";
import { feedUrlProblem, normalizeFeedUrl } from "./calendarFetch.ts";
import {
  resolveRooms,
  type CalendarService,
  type RoomSource,
} from "./calendarService.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";

const CALENDARS = "/admin/calendars";
const TEST = "/admin/calendars/test";

export interface CalendarAdminDeps {
  calendar: CalendarService;
  /** The rooms that can have a calendar. */
  rooms: RoomSource;
  audit?: AuditRecorder;
  /** TEST ONLY: lets feeds be plain http on this machine (see calendarOptionsFromEnv). */
  allowLocalForTests?: boolean;
}

const bodyOf = (request: AdminRequest): Record<string, unknown> | null =>
  typeof request.body === "object" &&
  request.body !== null &&
  !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : null;

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });

async function route(
  request: AdminRequest,
  deps: CalendarAdminDeps,
): Promise<AdminReply | null> {
  if (request.path !== CALENDARS && request.path !== TEST) return null;

  // A feed address can hold a secret: it is for admins (and the server's own tools) only
  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  if (actor.kind === "user" && !actor.roles.admin)
    return {
      status: 403,
      body: { error: "Only admins may manage the room calendars." },
    };

  const allowLocal = deps.allowLocalForTests ?? false;

  if (request.path === TEST) {
    if (request.method !== "POST")
      return { status: 405, body: { error: "Use POST." } };
    const url = bodyOf(request)?.url;
    const problem = feedUrlProblem(url, allowLocal);
    if (problem) return bad(problem);
    return {
      status: 200,
      body: { test: await deps.calendar.test(normalizeFeedUrl(String(url))) },
    };
  }

  if (request.method === "GET") {
    const rooms = await Promise.all(
      (await resolveRooms(deps.rooms)).map(
        async ({ id, label, floor, floorName }) => ({
          room: id,
          label,
          ...(floor !== undefined && floorName !== undefined
            ? { floor, floorName }
            : {}),
          url: await deps.calendar.feedOf(id),
        }),
      ),
    );
    return { status: 200, body: { rooms } };
  }
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use GET or POST." } };

  const body = bodyOf(request);
  const room = body?.room;
  const known = await resolveRooms(deps.rooms);
  const found = known.find(({ id }) => id === room);
  if (typeof room !== "string" || !found)
    return bad("Choose a room that exists.");
  // Who and which room, by name and floor: never the address, which may hold a secret
  const detail = {
    room,
    ...(found.floorName !== undefined
      ? { label: found.label, floor: found.floorName }
      : {}),
  };
  const url = body?.url;
  if (url === undefined) return bad("Give the address of the calendar feed.");

  if (url === null || (typeof url === "string" && url.trim() === "")) {
    await deps.calendar.clearFeed(room);
    await deps.audit?.({
      ...auditActor(actor),
      action: "calendar.clear",
      detail,
    });
    return { status: 200, body: { room, url: null } };
  }

  const problem = feedUrlProblem(url, allowLocal);
  if (problem) return bad(problem);
  const clean = normalizeFeedUrl(String(url));
  await deps.calendar.setFeed(room, clean);
  // Never the address in the log: it may hold a secret
  await deps.audit?.({
    ...auditActor(actor),
    action: "calendar.set",
    detail,
  });
  return {
    status: 200,
    body: { room, url: clean, test: await deps.calendar.test(clean) },
  };
}

/**
 * The admin API for the calendar feeds of the rooms: list them, set one (it is
 * tested at once), remove one, or just test an address. Returns null for a path
 * that is not its own. Only admins and the server's own tools may use it.
 */
export async function handleCalendarAdmin(
  request: AdminRequest,
  deps: CalendarAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Calendar admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
