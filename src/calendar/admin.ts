import type { Request } from "./calendar";

/** A room, with the address of its calendar feed (null when it has none). */
export interface FeedRoom {
  room: string;
  label: string;
  /** The floor it is on, and what that is called, when the server says. */
  floor?: string;
  floorName?: string;
  url: string | null;
}

/** What reading a feed gave: how many events are coming, or why not. */
export type FeedTest =
  { ok: true; upcoming: number } | { ok: false; error: string };

export type FeedOutcome<T> = ({ ok: true } & T) | { ok: false; error: string };

const isFeedRoom = (value: unknown): value is FeedRoom => {
  if (typeof value !== "object" || value === null) return false;
  const room = value as Record<string, unknown>;
  return (
    typeof room.room === "string" &&
    typeof room.label === "string" &&
    (room.floor === undefined || typeof room.floor === "string") &&
    (room.floorName === undefined || typeof room.floorName === "string") &&
    (room.url === null || typeof room.url === "string")
  );
};

const isTest = (value: unknown): value is FeedTest => {
  if (typeof value !== "object" || value === null) return false;
  const test = value as Record<string, unknown>;
  return (
    (test.ok === true && typeof test.upcoming === "number") ||
    (test.ok === false && typeof test.error === "string")
  );
};

const OFFLINE = "Could not reach the server. Nothing was changed.";
const FAILED = "Could not save that change. It was not made.";

/** Why the server said no, in its words when it gave them. */
async function refusal(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    if (response.status < 500 && typeof body?.error === "string")
      return body.error;
  } catch {
    // Not JSON: nothing more to say than that it failed
  }
  return FAILED;
}

/** The rooms with their feeds, or null when the server would not say. */
export async function fetchFeeds(
  request: Request,
  adminBase: string,
): Promise<FeedRoom[] | null> {
  try {
    const response = await request(`${adminBase}/calendars`);
    if (!response.ok) return null;
    const body = (await response.json()) as { rooms?: unknown } | null;
    return Array.isArray(body?.rooms) && body.rooms.every(isFeedRoom)
      ? body.rooms
      : null;
  } catch {
    return null;
  }
}

/**
 * Sets the feed of a room, or removes it (an empty address). The server tests
 * a new feed at once and says how it went.
 */
export async function saveFeed(
  request: Request,
  adminBase: string,
  room: string,
  url: string,
): Promise<FeedOutcome<{ url: string | null; test: FeedTest | null }>> {
  try {
    const response = await request(`${adminBase}/calendars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, url }),
    });
    if (!response.ok) return { ok: false, error: await refusal(response) };
    const body = (await response.json()) as {
      url?: unknown;
      test?: unknown;
    } | null;
    return {
      ok: true,
      url: typeof body?.url === "string" ? body.url : null,
      test: isTest(body?.test) ? body.test : null,
    };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/** Reads an address once to see whether it works, without saving it. */
export async function testFeed(
  request: Request,
  adminBase: string,
  url: string,
): Promise<FeedOutcome<{ test: FeedTest }>> {
  try {
    const response = await request(`${adminBase}/calendars/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return { ok: false, error: await refusal(response) };
    const body = (await response.json()) as { test?: unknown } | null;
    return isTest(body?.test)
      ? { ok: true, test: body.test }
      : { ok: false, error: FAILED };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/** What the result of reading a feed means for the admin. */
export function describeFeedTest(test: FeedTest): string {
  if (!test.ok) return `Does not work: ${test.error}`;
  if (test.upcoming === 0)
    return "Works, but there are no events in the next 30 days.";
  return `Works: ${test.upcoming} upcoming ${test.upcoming === 1 ? "event" : "events"} in the next 30 days.`;
}
