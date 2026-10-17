import { beforeEach, describe, expect, it } from "vitest";
import { handleCalendar } from "./calendarRooms.ts";
import { createCalendarService } from "./calendarService.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

const t = (iso: string) => Date.parse(iso);
const NOW = t("2026-03-10T15:00:00Z");
const SECRET_URL = "https://calendar.example.com/ical/SECRETTOKEN/basic.ics";

const FEED = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Now",
  "DESCRIPTION:Agenda with a secret",
  "ATTENDEE:mailto:boss@example.com",
  "ORGANIZER:mailto:ceo@example.com",
  "LOCATION:Room 4",
  "DTSTART:20260310T143000Z",
  "DTEND:20260310T153000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Soon",
  "DTSTART:20260310T160000Z",
  "DTEND:20260310T170000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const day = {
  dayStart: String(t("2026-03-10T00:00:00Z")),
  dayEnd: String(t("2026-03-11T00:00:00Z")),
  date: "2026-03-10",
};

describe("handleCalendar", () => {
  let service: ReturnType<typeof createCalendarService>;

  const call = (
    query: Record<string, string> | undefined = day,
    method = "GET",
    path = "/calendar",
  ) =>
    handleCalendar(
      { method, path, query },
      {
        calendar: service,
        rooms: [
          { id: "meeting", label: "Meeting room" },
          { id: "lab", label: "Lab" },
        ],
        now: () => NOW,
      },
    );

  beforeEach(async () => {
    service = createCalendarService({
      store: new MemorySettingsStore(),
      fetchFeed: async () => ({ ok: true, text: FEED }),
      now: () => NOW,
      rooms: ["meeting", "lab"],
    });
    await service.setFeed("meeting", SECRET_URL);
  });

  it("answers nothing for other paths", async () => {
    expect(await call(day, "GET", "/calendars")).toBeNull();
    expect(await call(day, "GET", "/admin/calendars")).toBeNull();
  });

  it("says what each room is doing: now, next and the day", async () => {
    const reply = await call();
    expect(reply?.status).toBe(200);
    const rooms = reply?.body.rooms as Array<Record<string, unknown>>;
    expect(rooms.map((room) => room.room)).toEqual(["meeting", "lab"]);
    expect(rooms[0]).toMatchObject({
      room: "meeting",
      label: "Meeting room",
      configured: true,
      stale: false,
      current: {
        title: "Now",
        start: t("2026-03-10T14:30:00Z"),
        end: t("2026-03-10T15:30:00Z"),
        allDay: false,
      },
      next: { title: "Soon" },
    });
    expect((rooms[0].today as unknown[]).length).toBe(2);
    expect(rooms[1]).toEqual({
      room: "lab",
      label: "Lab",
      configured: false,
      stale: false,
      current: null,
      next: null,
      today: [],
    });
  });

  it("gives titles and times only, and never the address of a feed", async () => {
    const text = JSON.stringify((await call())?.body);
    for (const leaked of [
      "SECRETTOKEN",
      "calendar.example.com",
      "boss@example.com",
      "ceo@example.com",
      "Agenda",
      "Room 4",
      "ATTENDEE",
    ])
      expect(text).not.toContain(leaked);
    const events = ((await call())?.body.rooms as Array<{ today: object[] }>)[0]
      .today;
    for (const event of events)
      expect(Object.keys(event).sort()).toEqual([
        "allDay",
        "end",
        "start",
        "title",
      ]);
  });

  it("only answers GET", async () => {
    expect((await call(day, "POST"))?.status).toBe(405);
  });

  it("asks for a sensible day", async () => {
    const bad: Array<Record<string, string> | undefined> = [
      undefined,
      {},
      { ...day, dayStart: "abc" },
      { ...day, dayEnd: "" },
      { ...day, date: "yesterday" },
      { ...day, date: "2026-3-10" },
      { ...day, dayStart: String(NOW - 5 * 86_400_000) },
      {
        ...day,
        dayStart: String(NOW),
        dayEnd: String(NOW + 90 * 86_400_000),
      },
      { ...day, dayEnd: day.dayStart },
      { ...day, dayEnd: String(Number(day.dayStart) - 1) },
    ];
    for (const query of bad)
      expect((await call(query ?? {}))?.status, JSON.stringify(query)).toBe(
        400,
      );
  });

  it("accepts a day of 23 or 25 hours, as when the clocks change", async () => {
    for (const hours of [23, 25])
      expect(
        (
          await call({
            ...day,
            dayEnd: String(Number(day.dayStart) + hours * 3_600_000),
          })
        )?.status,
      ).toBe(200);
  });

  it("says so when the database cannot be reached", async () => {
    const broken = createCalendarService({
      store: {
        get: async () => {
          throw new Error("down");
        },
        set: async () => {},
        setIfAbsent: async () => false,
      },
      fetchFeed: async () => ({ ok: true, text: FEED }),
      rooms: ["meeting"],
    });
    const reply = await handleCalendar(
      { method: "GET", path: "/calendar", query: day },
      {
        calendar: broken,
        rooms: [{ id: "meeting", label: "M" }],
        now: () => NOW,
      },
    );
    expect(reply?.status).toBe(503);
  });
});

describe("handleCalendar on floors with rooms of their own", () => {
  const rooms = [
    {
      id: "meeting",
      label: "Meeting room",
      floor: "office",
      floorName: "Main office",
    },
    {
      id: "hr.room-a",
      label: "Meeting room A",
      floor: "hr",
      floorName: "People",
    },
  ];
  const calendar = () =>
    createCalendarService({
      store: new MemorySettingsStore(),
      fetchFeed: async () => ({ ok: true, text: FEED }),
      now: () => NOW,
      rooms: async () => rooms.map((room) => room.id),
    });

  it("asks for the rooms each time, and says which floor each is on", async () => {
    const service = calendar();
    await service.setFeed("hr.room-a", SECRET_URL);
    const reply = await handleCalendar(
      { method: "GET", path: "/calendar", query: day },
      { calendar: service, rooms: async () => rooms, now: () => NOW },
    );
    const body = reply?.body.rooms as Array<Record<string, unknown>>;
    expect(body.map((room) => room.room)).toEqual(["meeting", "hr.room-a"]);
    expect(body[1]).toMatchObject({
      label: "Meeting room A",
      floor: "hr",
      floorName: "People",
      configured: true,
    });
    expect(body[0]).toMatchObject({ floor: "office", configured: false });
    expect(JSON.stringify(reply?.body)).not.toContain("SECRETTOKEN");
  });
});
