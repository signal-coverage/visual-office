import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../shared/calendar.ts";
import { eventRange, joinHint } from "./schedule";

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

describe("eventRange", () => {
  it("shows start and end, or all day", () => {
    expect(eventRange(SOON, UTC)).toBe("16:00 – 17:00");
    expect(
      eventRange(
        event("Holiday", "2026-03-10T00:00:00Z", "2026-03-11T00:00:00Z", true),
        UTC,
      ),
    ).toBe("All day");
  });

  it("shows only the start of something with no length", () => {
    expect(
      eventRange(
        event("Ping", "2026-03-10T16:00:00Z", "2026-03-10T16:00:00Z"),
        UTC,
      ),
    ).toBe("16:00");
  });

  it("names the day when it ends on another one", () => {
    expect(
      eventRange(
        event("Night", "2026-03-10T22:00:00Z", "2026-03-11T02:00:00Z"),
        UTC,
      ),
    ).toBe("22:00 – Wed 02:00");
  });
});

describe("joinHint", () => {
  const hint = (
    current: CalendarEvent | null,
    next: CalendarEvent | null,
    configured = true,
  ) => joinHint({ configured, current, next }, NOW, "Meeting room", UTC);

  it("invites people in when something is on", () => {
    expect(hint(NOW_EVENT, SOON)).toBe(
      "Happening now. Walk into the Meeting room to join.",
    );
  });

  it("counts down when it is about to start", () => {
    const in10 = event("Soon", "2026-03-10T15:10:00Z", "2026-03-10T16:00:00Z");
    expect(hint(null, in10)).toBe(
      "Starts in 10 min. Walk into the Meeting room to join.",
    );
    const in1 = {
      ...in10,
      start: NOW + 30_000,
    };
    expect(hint(null, in1)).toBe(
      "Starts in 1 min. Walk into the Meeting room to join.",
    );
  });

  it("says when the next one is", () => {
    expect(hint(null, SOON)).toBe("Next at 16:00.");
    expect(hint(null, TOMORROW)).toBe("Next on Wed 09:00.");
  });

  it("says when there is nothing, or no calendar", () => {
    expect(hint(null, null)).toBe("Nothing scheduled.");
    expect(hint(null, null, false)).toBe("No calendar connected to this room.");
  });
});
