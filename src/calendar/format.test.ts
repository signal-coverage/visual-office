import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../shared/calendar.ts";
import { describeRoomNow, formatTime, formatWhen, viewerDay } from "./format";

const t = (iso: string) => Date.parse(iso);
const UTC = { locale: "en-GB", timeZone: "UTC" };
const NOW = t("2026-03-10T15:00:00Z");
const event = (
  title: string,
  start: string,
  end: string,
  allDay = false,
): CalendarEvent => ({ title, start: t(start), end: t(end), allDay });

const NOW_EVENT = event(
  "Sprint",
  "2026-03-10T14:30:00Z",
  "2026-03-10T15:30:00Z",
);
const SOON = event("Retro", "2026-03-10T16:00:00Z", "2026-03-10T17:00:00Z");
const TOMORROW = event(
  "Kickoff",
  "2026-03-11T09:00:00Z",
  "2026-03-11T10:00:00Z",
);

describe("viewerDay", () => {
  it("is the day of the viewer's own clock, whatever it is", () => {
    const day = viewerDay(NOW);
    const local = new Date(NOW);
    expect(day.dayStart).toBeLessThanOrEqual(NOW);
    expect(day.dayEnd).toBeGreaterThan(NOW);
    const hours = (day.dayEnd - day.dayStart) / 3_600_000;
    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(25);
    expect(new Date(day.dayStart).getHours()).toBe(0);
    expect(new Date(day.dayStart).getMinutes()).toBe(0);
    expect(day.date).toBe(
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`,
    );
  });
});

describe("formatTime", () => {
  it("shows the time in the viewer's zone", () => {
    expect(formatTime(t("2026-03-10T15:30:00Z"), UTC)).toBe("15:30");
    expect(
      formatTime(t("2026-03-10T15:30:00Z"), {
        locale: "en-GB",
        timeZone: "Asia/Kolkata",
      }),
    ).toBe("21:00");
    expect(
      formatTime(t("2026-03-10T15:30:00Z"), {
        locale: "en-US",
        timeZone: "America/New_York",
      }),
    ).toMatch(/^11:30\s?AM$/);
  });
});

describe("formatWhen", () => {
  it("is just the time for today, and the weekday with it for another day", () => {
    expect(formatWhen(t("2026-03-10T16:00:00Z"), NOW, UTC)).toBe("16:00");
    expect(formatWhen(t("2026-03-11T09:00:00Z"), NOW, UTC)).toBe("Wed 09:00");
  });
});

describe("describeRoomNow", () => {
  const room = (current: CalendarEvent | null, next: CalendarEvent | null) => ({
    configured: true,
    current,
    next,
  });

  it("says what is on now and what comes next", () => {
    expect(describeRoomNow(room(NOW_EVENT, SOON), NOW, UTC)).toBe(
      "Now: Sprint until 15:30 · Next: Retro 16:00",
    );
  });

  it("says what is on when nothing follows", () => {
    expect(describeRoomNow(room(NOW_EVENT, null), NOW, UTC)).toBe(
      "Now: Sprint until 15:30",
    );
  });

  it("says the room is free when only something later is planned", () => {
    expect(describeRoomNow(room(null, SOON), NOW, UTC)).toBe(
      "Free now · Next: Retro 16:00",
    );
    expect(describeRoomNow(room(null, TOMORROW), NOW, UTC)).toBe(
      "Free now · Next: Kickoff Wed 09:00",
    );
  });

  it("has nothing to say without a calendar or without events", () => {
    expect(describeRoomNow(room(null, null), NOW, UTC)).toBeNull();
    expect(
      describeRoomNow(
        { configured: false, current: null, next: null },
        NOW,
        UTC,
      ),
    ).toBeNull();
  });
});
