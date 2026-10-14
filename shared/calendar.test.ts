import { describe, expect, it } from "vitest";
import {
  cleanTitle,
  MAX_TITLE_LENGTH,
  MAX_TODAY_EVENTS,
  scheduleFor,
  type CalendarEvent,
} from "./calendar.ts";

const t = (iso: string) => Date.parse(iso);
const timed = (title: string, start: string, end: string): CalendarEvent => ({
  title,
  start: t(start),
  end: t(end),
  allDay: false,
});
const allDay = (title: string, start: string, end: string): CalendarEvent => ({
  title,
  start: t(`${start}T00:00:00Z`),
  end: t(`${end}T00:00:00Z`),
  allDay: true,
});

describe("cleanTitle", () => {
  it("keeps a plain title", () => {
    expect(cleanTitle("Sprint planning")).toBe("Sprint planning");
  });

  it("drops control characters and collapses whitespace", () => {
    expect(cleanTitle("  Daily\u0000 \n\t stand-up\u007f ")).toBe(
      "Daily stand-up",
    );
  });

  it("cuts a long title with an ellipsis", () => {
    const cut = cleanTitle("x".repeat(500));
    expect(cut).toHaveLength(MAX_TITLE_LENGTH);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("falls back to Busy when nothing is left", () => {
    expect(cleanTitle("")).toBe("Busy");
    expect(cleanTitle(" \u0000 ")).toBe("Busy");
    expect(cleanTitle(undefined)).toBe("Busy");
  });
});

describe("scheduleFor", () => {
  const day = {
    now: t("2026-03-10T15:00:00Z"),
    dayStart: t("2026-03-10T00:00:00Z"),
    dayEnd: t("2026-03-11T00:00:00Z"),
    date: "2026-03-10",
  };

  it("finds what is on now and what comes next", () => {
    const events = [
      timed("Later", "2026-03-10T17:00:00Z", "2026-03-10T18:00:00Z"),
      timed("Now", "2026-03-10T14:30:00Z", "2026-03-10T15:30:00Z"),
      timed("Soon", "2026-03-10T16:00:00Z", "2026-03-10T16:30:00Z"),
      timed("Done", "2026-03-10T09:00:00Z", "2026-03-10T10:00:00Z"),
    ];
    const schedule = scheduleFor(events, day);
    expect(schedule.current?.title).toBe("Now");
    expect(schedule.next?.title).toBe("Soon");
    expect(schedule.today.map((e) => e.title)).toEqual([
      "Done",
      "Now",
      "Soon",
      "Later",
    ]);
  });

  it("has an event ending exactly now as over, and one starting now as current", () => {
    const events = [
      timed("Over", "2026-03-10T14:00:00Z", "2026-03-10T15:00:00Z"),
      timed("Starting", "2026-03-10T15:00:00Z", "2026-03-10T16:00:00Z"),
    ];
    const schedule = scheduleFor(events, day);
    expect(schedule.current?.title).toBe("Starting");
    expect(schedule.next).toBeNull();
  });

  it("finds a next event that is tomorrow", () => {
    const events = [
      timed("Tomorrow", "2026-03-11T09:00:00Z", "2026-03-11T10:00:00Z"),
    ];
    const schedule = scheduleFor(events, day);
    expect(schedule.next?.title).toBe("Tomorrow");
    expect(schedule.today).toEqual([]);
  });

  it("is empty with no events", () => {
    expect(scheduleFor([], day)).toEqual({
      current: null,
      next: null,
      today: [],
    });
  });

  it("keeps all-day events out of now and next but lists them first for their days", () => {
    const events = [
      timed("Meeting", "2026-03-10T16:00:00Z", "2026-03-10T17:00:00Z"),
      allDay("Offsite", "2026-03-09", "2026-03-11"),
      allDay("Tomorrow only", "2026-03-11", "2026-03-12"),
    ];
    const schedule = scheduleFor(events, day);
    expect(schedule.current).toBeNull();
    expect(schedule.next?.title).toBe("Meeting");
    expect(schedule.today.map((e) => e.title)).toEqual(["Offsite", "Meeting"]);
  });

  it("includes an event that began yesterday and runs into today", () => {
    const events = [
      timed("Overnight", "2026-03-09T22:00:00Z", "2026-03-10T02:00:00Z"),
    ];
    expect(scheduleFor(events, day).today).toHaveLength(1);
  });

  it("sorts ties by title and bounds the list", () => {
    const many = Array.from({ length: MAX_TODAY_EVENTS + 20 }, (_, i) =>
      timed(
        `E${String(i).padStart(3, "0")}`,
        "2026-03-10T18:00:00Z",
        "2026-03-10T18:00:00Z".replace("18", "19"),
      ),
    );
    const schedule = scheduleFor(many.reverse(), day);
    expect(schedule.today).toHaveLength(MAX_TODAY_EVENTS);
    expect(schedule.today[0].title).toBe("E000");
  });

  it("treats a zero-length event as not covering now", () => {
    const events = [
      timed("Blip", "2026-03-10T15:00:00Z", "2026-03-10T15:00:00Z"),
    ];
    expect(scheduleFor(events, day).current).toBeNull();
  });
});
