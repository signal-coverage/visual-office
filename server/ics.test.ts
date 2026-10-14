import { describe, expect, it } from "vitest";
import { MAX_ICS_EVENTS, parseIcs } from "./ics.ts";

const t = (iso: string) => Date.parse(iso);
const WINDOW = {
  from: t("2026-01-01T00:00:00Z"),
  to: t("2026-12-31T00:00:00Z"),
};

const calendar = (...lines: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...lines, "END:VCALENDAR"].join("\r\n");
const event = (...lines: string[]) =>
  ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const starts = (text: string, window = WINDOW) =>
  parseIcs(text, window).map((e) => new Date(e.start).toISOString());

describe("parseIcs: single events", () => {
  it("reads title, start and end in UTC", () => {
    const [first, ...rest] = parseIcs(
      calendar(
        event(
          "UID:a",
          "SUMMARY:Sprint planning",
          "DTSTART:20260310T150000Z",
          "DTEND:20260310T160000Z",
        ),
      ),
      WINDOW,
    );
    expect(rest).toEqual([]);
    expect(first).toEqual({
      title: "Sprint planning",
      start: t("2026-03-10T15:00:00Z"),
      end: t("2026-03-10T16:00:00Z"),
      allDay: false,
    });
  });

  it("accepts LF and CR line endings", () => {
    const body = event(
      "SUMMARY:A",
      "DTSTART:20260310T150000Z",
      "DTEND:20260310T160000Z",
    );
    for (const eol of ["\n", "\r"])
      expect(
        parseIcs(body.replaceAll("\r\n", eol), WINDOW).map((e) => e.title),
      ).toEqual(["A"]);
  });

  it("unfolds long lines and unescapes text", () => {
    const [found] = parseIcs(
      calendar(
        event(
          "SUMMARY:Budget\\, Q2 \\; plan\\nline two ",
          " continued\r\n\tmore",
          "DTSTART:20260310T150000Z",
          "DTEND:20260310T160000Z",
        ),
      ),
      WINDOW,
    );
    expect(found.title).toBe("Budget, Q2 ; plan line two continuedmore");
  });

  it("falls back to Busy without a summary and bounds a huge title", () => {
    const [plain] = parseIcs(
      calendar(event("DTSTART:20260310T150000Z", "DTEND:20260310T160000Z")),
      WINDOW,
    );
    expect(plain.title).toBe("Busy");
    const [long] = parseIcs(
      calendar(
        event(
          `SUMMARY:${"x".repeat(5000)}`,
          "DTSTART:20260310T150000Z",
          "DTEND:20260310T160000Z",
        ),
      ),
      WINDOW,
    );
    expect(long.title.length).toBeLessThanOrEqual(80);
  });

  it("uses DURATION when there is no end", () => {
    const [a, b, c] = parseIcs(
      calendar(
        event("SUMMARY:A", "DTSTART:20260310T150000Z", "DURATION:PT90M"),
        event("SUMMARY:B", "DTSTART:20260311T150000Z", "DURATION:P1DT2H"),
        event("SUMMARY:C", "DTSTART:20260312T150000Z"),
      ),
      WINDOW,
    );
    expect(a.end - a.start).toBe(90 * 60_000);
    expect(b.end - b.start).toBe(26 * 3_600_000);
    expect(c.end).toBe(c.start);
  });

  it("reads all-day events, whose end day is not included", () => {
    const [multi, single] = parseIcs(
      calendar(
        event(
          "SUMMARY:Offsite",
          "DTSTART;VALUE=DATE:20260310",
          "DTEND;VALUE=DATE:20260313",
        ),
        event("SUMMARY:Holiday", "DTSTART;VALUE=DATE:20260320"),
      ),
      WINDOW,
    );
    expect(multi).toEqual({
      title: "Offsite",
      start: t("2026-03-10T00:00:00Z"),
      end: t("2026-03-13T00:00:00Z"),
      allDay: true,
    });
    expect(single.allDay).toBe(true);
    expect(single.end).toBe(t("2026-03-21T00:00:00Z"));
  });

  it("ignores cancelled events and keeps tentative ones", () => {
    const text = calendar(
      event(
        "SUMMARY:No",
        "STATUS:CANCELLED",
        "DTSTART:20260310T150000Z",
        "DTEND:20260310T160000Z",
      ),
      event(
        "SUMMARY:Maybe",
        "STATUS:TENTATIVE",
        "DTSTART:20260311T150000Z",
        "DTEND:20260311T160000Z",
      ),
    );
    expect(parseIcs(text, WINDOW).map((e) => e.title)).toEqual(["Maybe"]);
  });

  it("only returns events that touch the window, sorted by start", () => {
    const text = calendar(
      event("SUMMARY:C", "DTSTART:20260312T100000Z", "DTEND:20260312T110000Z"),
      event(
        "SUMMARY:Before",
        "DTSTART:20260309T100000Z",
        "DTEND:20260310T000000Z",
      ),
      event("SUMMARY:A", "DTSTART:20260309T230000Z", "DTEND:20260310T010000Z"),
      event(
        "SUMMARY:After",
        "DTSTART:20260313T000000Z",
        "DTEND:20260313T010000Z",
      ),
    );
    const window = {
      from: t("2026-03-10T00:00:00Z"),
      to: t("2026-03-13T00:00:00Z"),
    };
    expect(parseIcs(text, window).map((e) => e.title)).toEqual(["A", "C"]);
  });
});

describe("parseIcs: time zones", () => {
  const at = (zone: string, local: string) =>
    starts(
      calendar(
        event(
          "SUMMARY:Z",
          `DTSTART;TZID=${zone}:${local}`,
          `DTEND;TZID=${zone}:${local}`,
        ),
      ),
    )[0];

  it("converts local times with the offset the zone had that day", () => {
    expect(at("Europe/Madrid", "20260115T100000")).toBe(
      "2026-01-15T09:00:00.000Z",
    );
    expect(at("Europe/Madrid", "20260715T100000")).toBe(
      "2026-07-15T08:00:00.000Z",
    );
    expect(at("America/New_York", "20260115T090000")).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(at("America/New_York", "20260310T090000")).toBe(
      "2026-03-10T13:00:00.000Z",
    );
    expect(at("Asia/Kolkata", "20260115T100000")).toBe(
      "2026-01-15T04:30:00.000Z",
    );
  });

  it("understands the Windows names Outlook uses", () => {
    expect(at("Eastern Standard Time", "20260115T090000")).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(at("W. Europe Standard Time", "20260115T100000")).toBe(
      "2026-01-15T09:00:00.000Z",
    );
    expect(at("Argentina Standard Time", "20260115T100000")).toBe(
      "2026-01-15T13:00:00.000Z",
    );
  });

  it("accepts a quoted TZID", () => {
    expect(at('"Europe/Madrid"', "20260115T100000")).toBe(
      "2026-01-15T09:00:00.000Z",
    );
  });

  it("treats a zone it does not know as UTC", () => {
    expect(at("Mars/Olympus", "20260115T100000")).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  it("gives floating times the zone of the calendar when it names one", () => {
    const text = calendar(
      "X-WR-TIMEZONE:Europe/Madrid",
      event("SUMMARY:F", "DTSTART:20260115T100000", "DTEND:20260115T110000"),
    );
    expect(starts(text)).toEqual(["2026-01-15T09:00:00.000Z"]);
  });

  it("treats floating times with no zone at all as UTC", () => {
    const text = calendar(
      event("SUMMARY:F", "DTSTART:20260115T100000", "DTEND:20260115T110000"),
    );
    expect(starts(text)).toEqual(["2026-01-15T10:00:00.000Z"]);
  });

  it("keeps the wall-clock time of a weekly event across a daylight saving change", () => {
    const text = calendar(
      event(
        "SUMMARY:W",
        "DTSTART;TZID=Europe/Madrid:20260323T100000",
        "DTEND;TZID=Europe/Madrid:20260323T110000",
        "RRULE:FREQ=WEEKLY;COUNT=2",
      ),
    );
    expect(starts(text)).toEqual([
      "2026-03-23T09:00:00.000Z",
      "2026-03-30T08:00:00.000Z",
    ]);
  });
});

describe("parseIcs: recurrence", () => {
  const rule = (
    rrule: string,
    start = "20260310T090000Z",
    extra: string[] = [],
  ) =>
    calendar(
      event(
        "UID:r",
        "SUMMARY:R",
        `DTSTART:${start}`,
        "DURATION:PT1H",
        `RRULE:${rrule}`,
        ...extra,
      ),
    );

  it("repeats daily with an interval and a count", () => {
    expect(starts(rule("FREQ=DAILY;INTERVAL=2;COUNT=3"))).toEqual([
      "2026-03-10T09:00:00.000Z",
      "2026-03-12T09:00:00.000Z",
      "2026-03-14T09:00:00.000Z",
    ]);
  });

  it("stops at UNTIL, which is included", () => {
    expect(starts(rule("FREQ=DAILY;UNTIL=20260313T090000Z"))).toEqual([
      "2026-03-10T09:00:00.000Z",
      "2026-03-11T09:00:00.000Z",
      "2026-03-12T09:00:00.000Z",
      "2026-03-13T09:00:00.000Z",
    ]);
    expect(starts(rule("FREQ=DAILY;UNTIL=20260312"))).toHaveLength(3);
  });

  it("repeats weekly on the days asked", () => {
    expect(
      starts(rule("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4", "20260309T090000Z")),
    ).toEqual([
      "2026-03-09T09:00:00.000Z",
      "2026-03-11T09:00:00.000Z",
      "2026-03-13T09:00:00.000Z",
      "2026-03-16T09:00:00.000Z",
    ]);
  });

  it("repeats weekly on the weekday of the start when no days are given", () => {
    expect(starts(rule("FREQ=WEEKLY;COUNT=2"))).toEqual([
      "2026-03-10T09:00:00.000Z",
      "2026-03-17T09:00:00.000Z",
    ]);
  });

  it("skips weeks with a weekly interval", () => {
    expect(
      starts(
        rule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=3", "20260309T090000Z"),
      ),
    ).toEqual([
      "2026-03-09T09:00:00.000Z",
      "2026-03-23T09:00:00.000Z",
      "2026-04-06T09:00:00.000Z",
    ]);
  });

  it("repeats monthly on the day of the month, skipping months without it", () => {
    expect(starts(rule("FREQ=MONTHLY;COUNT=3", "20260131T090000Z"))).toEqual([
      "2026-01-31T09:00:00.000Z",
      "2026-03-31T09:00:00.000Z",
      "2026-05-31T09:00:00.000Z",
    ]);
  });

  it("repeats monthly on the nth weekday", () => {
    expect(
      starts(rule("FREQ=MONTHLY;BYDAY=2TU;COUNT=3", "20260113T090000Z")),
    ).toEqual([
      "2026-01-13T09:00:00.000Z",
      "2026-02-10T09:00:00.000Z",
      "2026-03-10T09:00:00.000Z",
    ]);
    expect(
      starts(rule("FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", "20260130T090000Z")),
    ).toEqual([
      "2026-01-30T09:00:00.000Z",
      "2026-02-27T09:00:00.000Z",
      "2026-03-27T09:00:00.000Z",
    ]);
  });

  it("repeats monthly on the last day with a negative day of month", () => {
    expect(
      starts(rule("FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3", "20260131T090000Z")),
    ).toEqual([
      "2026-01-31T09:00:00.000Z",
      "2026-02-28T09:00:00.000Z",
      "2026-03-31T09:00:00.000Z",
    ]);
  });

  it("repeats all-day events", () => {
    const text = calendar(
      event(
        "SUMMARY:D",
        "DTSTART;VALUE=DATE:20260310",
        "RRULE:FREQ=DAILY;COUNT=2",
      ),
    );
    const found = parseIcs(text, WINDOW);
    expect(found.map((e) => e.allDay)).toEqual([true, true]);
    expect(found[1].start).toBe(t("2026-03-11T00:00:00Z"));
  });

  it("leaves out the dates in EXDATE", () => {
    expect(
      starts(
        rule("FREQ=DAILY;COUNT=3", "20260310T090000Z", [
          "EXDATE:20260311T090000Z",
        ]),
      ),
    ).toEqual(["2026-03-10T09:00:00.000Z", "2026-03-12T09:00:00.000Z"]);
    expect(
      starts(
        calendar(
          event(
            "SUMMARY:D",
            "DTSTART;VALUE=DATE:20260310",
            "RRULE:FREQ=DAILY;COUNT=3",
            "EXDATE;VALUE=DATE:20260311,20260312",
          ),
        ),
      ),
    ).toEqual(["2026-03-10T00:00:00.000Z"]);
  });

  it("leaves out EXDATE given in the zone of the event", () => {
    const text = calendar(
      event(
        "SUMMARY:M",
        "DTSTART;TZID=Europe/Madrid:20260115T100000",
        "DURATION:PT1H",
        "RRULE:FREQ=DAILY;COUNT=2",
        "EXDATE;TZID=Europe/Madrid:20260115T100000",
      ),
    );
    expect(starts(text)).toEqual(["2026-01-16T09:00:00.000Z"]);
  });

  it("lets one occurrence be moved or cancelled by an override", () => {
    const series = event(
      "UID:s",
      "SUMMARY:Standup",
      "DTSTART:20260310T090000Z",
      "DURATION:PT15M",
      "RRULE:FREQ=DAILY;COUNT=3",
    );
    const moved = event(
      "UID:s",
      "SUMMARY:Moved",
      "RECURRENCE-ID:20260311T090000Z",
      "DTSTART:20260311T140000Z",
      "DURATION:PT15M",
    );
    const gone = event(
      "UID:s",
      "STATUS:CANCELLED",
      "RECURRENCE-ID:20260312T090000Z",
      "DTSTART:20260312T090000Z",
    );
    const found = parseIcs(calendar(series, moved, gone), WINDOW);
    expect(
      found.map((e) => [e.title, new Date(e.start).toISOString()]),
    ).toEqual([
      ["Standup", "2026-03-10T09:00:00.000Z"],
      ["Moved", "2026-03-11T14:00:00.000Z"],
    ]);
  });

  it("only returns what falls in the window, however long the series", () => {
    const window = {
      from: t("2026-03-10T00:00:00Z"),
      to: t("2026-03-13T00:00:00Z"),
    };
    expect(starts(rule("FREQ=DAILY", "20200101T090000Z"), window)).toEqual([
      "2026-03-10T09:00:00.000Z",
      "2026-03-11T09:00:00.000Z",
      "2026-03-12T09:00:00.000Z",
    ]);
  });

  it("does not hang on a rule that makes no sense or goes on for ever", () => {
    for (const bad of [
      "FREQ=DAILY;INTERVAL=0",
      "FREQ=DAILY;INTERVAL=-3;COUNT=2",
      "FREQ=DAILY;INTERVAL=abc",
      "FREQ=WEEKLY;BYDAY=XX",
      "FREQ=MONTHLY;BYMONTHDAY=99",
      "FREQ=SECONDLY",
      "NOTHING",
      "",
    ]) {
      expect(Array.isArray(parseIcs(rule(bad), WINDOW))).toBe(true);
    }
    const started = Date.now();
    parseIcs(rule("FREQ=DAILY", "19000101T090000Z"), WINDOW);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("keeps an unsupported frequency as the single event it starts from", () => {
    expect(starts(rule("FREQ=YEARLY;COUNT=5"))).toEqual([
      "2026-03-10T09:00:00.000Z",
    ]);
  });

  it("caps how many events come back", () => {
    const many = Array.from({ length: MAX_ICS_EVENTS + 50 }, (_, i) =>
      event(
        `SUMMARY:E${i}`,
        "DTSTART:20260310T090000Z",
        "DURATION:PT1M",
        `UID:${i}`,
      ),
    );
    expect(parseIcs(calendar(...many), WINDOW)).toHaveLength(MAX_ICS_EVENTS);
  });
});

describe("parseIcs: garbage", () => {
  const garbage = [
    "",
    "   ",
    "hello world",
    "<html><body>Sign in to continue</body></html>",
    "\u0000\u0001\u0002binary￿",
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT\r\nSUMMARY:Open",
    "BEGIN:VEVENT\r\nDTSTART:notadate\r\nEND:VEVENT",
    "BEGIN:VEVENT\r\nDTSTART:20261340T250000Z\r\nEND:VEVENT",
    "END:VEVENT\r\nBEGIN:VEVENT",
    ":::::\r\n;;;;\r\n=====",
    "BEGIN:VEVENT\r\nDTSTART:20260310T150000Z\r\nDTEND:20260310T140000Z\r\nEND:VEVENT",
  ];

  it("returns an empty list and never throws", () => {
    for (const text of garbage) expect(parseIcs(text, WINDOW)).toEqual([]);
  });

  it("copes with things that are not text", () => {
    for (const value of [undefined, null, 42, {}, []])
      expect(parseIcs(value as unknown as string, WINDOW)).toEqual([]);
  });

  it("refuses an absurdly large input instead of chewing on it", () => {
    expect(parseIcs("x".repeat(5_000_000), WINDOW)).toEqual([]);
  });
});
