import { beforeEach, describe, expect, it } from "vitest";
import type { FeedResult } from "./calendarFetch.ts";
import {
  createCalendarService,
  FEED_KEY_PREFIX,
  REFRESH_MS,
  RETRY_MS,
  type CalendarService,
} from "./calendarService.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

const t = (iso: string) => Date.parse(iso);
const NOW = t("2026-03-10T15:00:00Z");

const feedWith = (...events: Array<[string, string, string]>) =>
  [
    "BEGIN:VCALENDAR",
    ...events.flatMap(([title, start, end]) => [
      "BEGIN:VEVENT",
      `SUMMARY:${title}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

const FEED = feedWith(
  ["Now", "20260310T143000Z", "20260310T153000Z"],
  ["Soon", "20260310T160000Z", "20260310T170000Z"],
  ["Tomorrow", "20260311T090000Z", "20260311T100000Z"],
);
const URL_A = "https://example.com/a.ics?token=SECRET";
const DAY = {
  now: NOW,
  dayStart: t("2026-03-10T00:00:00Z"),
  dayEnd: t("2026-03-11T00:00:00Z"),
  date: "2026-03-10",
};

describe("createCalendarService", () => {
  let store: MemorySettingsStore;
  let now: number;
  let results: Array<FeedResult | Error>;
  let fetched: string[];
  let service: CalendarService;

  const fetchFeed = async (url: string): Promise<FeedResult> => {
    fetched.push(url);
    const next = results[Math.min(fetched.length - 1, results.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  };

  beforeEach(() => {
    store = new MemorySettingsStore();
    now = NOW;
    results = [{ ok: true, text: FEED }];
    fetched = [];
    service = createCalendarService({
      store,
      fetchFeed,
      now: () => now,
      rooms: ["meeting", "lab"],
    });
  });

  it("keeps the address of a room's feed in the settings, and can forget it", async () => {
    expect(await service.feedOf("meeting")).toBeNull();
    await service.setFeed("meeting", URL_A);
    expect(await service.feedOf("meeting")).toBe(URL_A);
    expect(await store.get(`${FEED_KEY_PREFIX}meeting`)).toBe(URL_A);
    expect(FEED_KEY_PREFIX).toBe("calendar_feed:");
    await service.clearFeed("meeting");
    expect(await service.feedOf("meeting")).toBeNull();
  });

  it("says which rooms have a feed", async () => {
    await service.setFeed("lab", URL_A);
    expect(await service.configured()).toEqual({ meeting: false, lab: true });
  });

  it("has nothing for a room without a feed, and fetches nothing", async () => {
    expect(await service.eventsOf("meeting")).toEqual({
      configured: false,
      events: [],
      stale: false,
    });
    expect(fetched).toEqual([]);
  });

  it("has nothing for a room that does not exist", async () => {
    await store.set(`${FEED_KEY_PREFIX}nowhere`, URL_A);
    expect((await service.eventsOf("nowhere")).configured).toBe(false);
    expect(fetched).toEqual([]);
  });

  it("reads the events of a feed", async () => {
    await service.setFeed("meeting", URL_A);
    const { configured, events, stale } = await service.eventsOf("meeting");
    expect(configured).toBe(true);
    expect(stale).toBe(false);
    expect(events.map((e) => e.title)).toEqual(["Now", "Soon", "Tomorrow"]);
    expect(JSON.stringify(events)).not.toContain("SECRET");
  });

  it("asks again no sooner than the refresh time", async () => {
    await service.setFeed("meeting", URL_A);
    await service.eventsOf("meeting");
    now += REFRESH_MS - 1;
    await service.eventsOf("meeting");
    expect(fetched).toHaveLength(1);
    now += 1;
    await service.eventsOf("meeting");
    expect(fetched).toHaveLength(2);
  });

  it("shares one request between people asking at once", async () => {
    await service.setFeed("meeting", URL_A);
    await Promise.all([
      service.eventsOf("meeting"),
      service.eventsOf("meeting"),
      service.eventsOf("meeting"),
    ]);
    expect(fetched).toHaveLength(1);
  });

  it("keeps serving what it had when the feed fails, and does not hammer it", async () => {
    await service.setFeed("meeting", URL_A);
    await service.eventsOf("meeting");
    results = [{ ok: false, error: "The calendar could not be reached." }];
    now += REFRESH_MS;
    const stale = await service.eventsOf("meeting");
    expect(stale.stale).toBe(true);
    expect(stale.events).toHaveLength(3);
    expect(fetched).toHaveLength(2);
    now += RETRY_MS - 1;
    await service.eventsOf("meeting");
    expect(fetched).toHaveLength(2);
    results = [{ ok: true, text: feedWith() }];
    now += 1;
    const fresh = await service.eventsOf("meeting");
    expect(fresh).toMatchObject({ stale: false, events: [] });
  });

  it("is empty, not broken, when the feed fails and there is nothing older", async () => {
    results = [new Error("boom")];
    await service.setFeed("meeting", URL_A);
    const found = await service.eventsOf("meeting");
    expect(found).toEqual({ configured: true, events: [], stale: true });
    now += RETRY_MS - 1;
    await service.eventsOf("meeting");
    expect(fetched).toHaveLength(1);
  });

  it("starts over when the address changes or is removed", async () => {
    await service.setFeed("meeting", URL_A);
    await service.eventsOf("meeting");
    await service.setFeed("meeting", "https://example.com/b.ics");
    await service.eventsOf("meeting");
    expect(fetched).toEqual([URL_A, "https://example.com/b.ics"]);
    await service.clearFeed("meeting");
    expect((await service.eventsOf("meeting")).configured).toBe(false);
  });

  it("does not use what it had from another address after a failure", async () => {
    await service.setFeed("meeting", URL_A);
    await service.eventsOf("meeting");
    results = [{ ok: false, error: "no" }];
    await service.setFeed("meeting", "https://example.com/b.ics");
    expect((await service.eventsOf("meeting")).events).toEqual([]);
  });

  it("tells what is on now, what is next and the day, for the viewer's day", async () => {
    await service.setFeed("meeting", URL_A);
    const schedule = await service.scheduleOf("meeting", DAY);
    expect(schedule.configured).toBe(true);
    expect(schedule.current?.title).toBe("Now");
    expect(schedule.next?.title).toBe("Soon");
    expect(schedule.today.map((e) => e.title)).toEqual(["Now", "Soon"]);
  });

  it("tests an address without keeping it", async () => {
    const result = await service.test(URL_A);
    expect(result).toEqual({ ok: true, upcoming: 2 });
    expect(await service.feedOf("meeting")).toBeNull();
    expect(fetched).toEqual([URL_A]);
    now += 1;
    await service.test(URL_A);
    expect(fetched).toHaveLength(2);
  });

  it("reports why a test failed", async () => {
    results = [{ ok: false, error: "The calendar server answered 404." }];
    expect(await service.test(URL_A)).toEqual({
      ok: false,
      error: "The calendar server answered 404.",
    });
    results = [new Error("boom")];
    expect(await service.test(URL_A)).toEqual({
      ok: false,
      error: "The calendar could not be reached.",
    });
  });
});

const URL_B = "https://example.com/b.ics?token=OTHER";

describe("createCalendarService with rooms that change", () => {
  it("asks for the rooms each time: a floor made while the server runs can have calendars", async () => {
    const store = new MemorySettingsStore();
    let rooms = ["meeting"];
    const service = createCalendarService({
      store,
      fetchFeed: async () => ({ ok: true, text: FEED }),
      now: () => NOW,
      rooms: async () => rooms,
    });
    await service.setFeed("hr.room-a", URL_A);
    expect(await service.feedOf("hr.room-a")).toBeNull();
    rooms = ["meeting", "hr.room-a"];
    await service.setFeed("hr.room-a", URL_A);
    expect(await service.feedOf("hr.room-a")).toBe(URL_A);
    expect(await service.configured()).toEqual({
      meeting: false,
      "hr.room-a": true,
    });
  });

  it("keeps the feed of the main office where it was, and puts another floor's under its own key", async () => {
    const store = new MemorySettingsStore();
    await store.set(`${FEED_KEY_PREFIX}meeting`, URL_A);
    const service = createCalendarService({
      store,
      fetchFeed: async () => ({ ok: true, text: FEED }),
      now: () => NOW,
      rooms: async () => ["meeting", "hr.meeting"],
    });
    // The one saved before floors had their own shells is still the main office's
    expect(await service.feedOf("meeting")).toBe(URL_A);
    expect(await service.feedOf("hr.meeting")).toBeNull();
    await service.setFeed("hr.meeting", URL_B);
    expect(await store.get(`${FEED_KEY_PREFIX}hr.meeting`)).toBe(URL_B);
    expect(await store.get(`${FEED_KEY_PREFIX}meeting`)).toBe(URL_A);
  });

  it("stops serving the feed of a room that no longer exists", async () => {
    const store = new MemorySettingsStore();
    let rooms = ["hr.room-a"];
    const service = createCalendarService({
      store,
      fetchFeed: async () => ({ ok: true, text: FEED }),
      now: () => NOW,
      rooms: async () => rooms,
    });
    await service.setFeed("hr.room-a", URL_A);
    expect((await service.eventsOf("hr.room-a")).configured).toBe(true);
    rooms = [];
    expect(await service.feedOf("hr.room-a")).toBeNull();
    expect((await service.eventsOf("hr.room-a")).configured).toBe(false);
  });
});
