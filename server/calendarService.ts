import {
  scheduleFor,
  type CalendarEvent,
  type DayWindow,
  type RoomSchedule,
} from "../shared/calendar.ts";
import type { FeedResult } from "./calendarFetch.ts";
import { parseIcs } from "./ics.ts";
import type { SettingsStore } from "./settingsStore.ts";

/** Where a room's feed address is kept in the settings: one entry per room. */
export const FEED_KEY_PREFIX = "calendar_feed:";
/** How long what was read from a feed is served before asking the feed again. */
export const REFRESH_MS = 5 * 60_000;
/** How long after a failure before the feed is tried again. */
export const RETRY_MS = 60_000;
const DAY_MS = 86_400_000;
/** What is read from a feed each time: the days around now that a viewer's day can fall in. */
const PAST_MS = 2 * DAY_MS;
const AHEAD_MS = 7 * DAY_MS;
const TEST_AHEAD_MS = 30 * DAY_MS;

export type TestResult =
  { ok: true; upcoming: number } | { ok: false; error: string };

export interface RoomEvents {
  configured: boolean;
  events: CalendarEvent[];
  /** Whether these are older than they should be because the feed could not be read. */
  stale: boolean;
}

export interface RoomScheduleResult extends RoomSchedule {
  configured: boolean;
  stale: boolean;
}

export interface CalendarService {
  /** The address of the feed of a room: for admins only, it may hold a secret. */
  feedOf(room: string): Promise<string | null>;
  setFeed(room: string, url: string): Promise<void>;
  clearFeed(room: string): Promise<void>;
  /** Which rooms have a feed. */
  configured(): Promise<Record<string, boolean>>;
  /** What a room's feed holds around now; never the address. */
  eventsOf(room: string): Promise<RoomEvents>;
  scheduleOf(room: string, day: DayWindow): Promise<RoomScheduleResult>;
  /** Reads an address once, to see whether it works. Nothing is kept. */
  test(url: string): Promise<TestResult>;
}

export interface CalendarServiceDeps {
  store: SettingsStore;
  fetchFeed: (url: string) => Promise<FeedResult>;
  now?: () => number;
  /** The rooms that can have a calendar. */
  rooms: readonly string[];
}

interface Cached {
  url: string;
  events: CalendarEvent[] | null;
  /** When to ask the feed again. */
  nextAt: number;
  failed: boolean;
}

export function createCalendarService({
  store,
  fetchFeed,
  now = Date.now,
  rooms,
}: CalendarServiceDeps): CalendarService {
  const cache = new Map<string, Cached>();
  const inFlight = new Map<string, Promise<Cached>>();
  const known = new Set(rooms);

  const feedOf = async (room: string) => {
    if (!known.has(room)) return null;
    return (await store.get(`${FEED_KEY_PREFIX}${room}`)) || null;
  };

  const attempt = async (
    room: string,
    url: string,
    previous: Cached | undefined,
  ): Promise<Cached> => {
    const at = now();
    let result: FeedResult;
    try {
      result = await fetchFeed(url);
    } catch {
      result = { ok: false, error: "The calendar could not be reached." };
    }
    const kept = previous?.url === url ? previous.events : null;
    const entry: Cached = result.ok
      ? {
          url,
          events: parseIcs(result.text, {
            from: at - PAST_MS,
            to: at + AHEAD_MS,
          }),
          nextAt: at + REFRESH_MS,
          failed: false,
        }
      : { url, events: kept, nextAt: at + RETRY_MS, failed: true };
    cache.set(room, entry);
    return entry;
  };

  const eventsOf = async (room: string): Promise<RoomEvents> => {
    const url = await feedOf(room);
    if (!url) {
      cache.delete(room);
      return { configured: false, events: [], stale: false };
    }
    let entry = cache.get(room);
    if (!entry || entry.url !== url || now() >= entry.nextAt) {
      const pending =
        inFlight.get(room) ??
        attempt(room, url, entry).finally(() => inFlight.delete(room));
      inFlight.set(room, pending);
      entry = await pending;
    }
    return {
      configured: true,
      events: entry.events ?? [],
      stale: entry.failed,
    };
  };

  return {
    feedOf,
    async setFeed(room, url) {
      await store.set(`${FEED_KEY_PREFIX}${room}`, url);
      cache.delete(room);
    },
    async clearFeed(room) {
      await store.set(`${FEED_KEY_PREFIX}${room}`, "");
      cache.delete(room);
    },
    async configured() {
      const entries = await Promise.all(
        rooms.map(
          async (room) => [room, (await feedOf(room)) !== null] as const,
        ),
      );
      return Object.fromEntries(entries);
    },
    eventsOf,
    async scheduleOf(room, day) {
      const { configured, events, stale } = await eventsOf(room);
      return { configured, stale, ...scheduleFor(events, day) };
    },
    async test(url) {
      let result: FeedResult;
      try {
        result = await fetchFeed(url);
      } catch {
        return { ok: false, error: "The calendar could not be reached." };
      }
      if (!result.ok) return { ok: false, error: result.error };
      const at = now();
      const upcoming = parseIcs(result.text, {
        from: at,
        to: at + TEST_AHEAD_MS,
      }).filter((event) => event.start >= at).length;
      return { ok: true, upcoming };
    },
  };
}
