import { cleanTitle, type CalendarEvent } from "../shared/calendar.ts";

/** The most events one feed gives back for a window. */
export const MAX_ICS_EVENTS = 1000;
const MAX_INPUT_CHARS = 2_000_000;
const MAX_VEVENTS = 5000;
/** How many repetitions of a rule are walked through at most (the periods, not the events). */
const MAX_STEPS = 20_000;
const DAY = 86_400_000;

export interface IcsWindow {
  /** Milliseconds since 1970. Events that end after this... */
  from: number;
  /** ...and start before this are returned. */
  to: number;
}

/**
 * What Outlook writes instead of an IANA name in TZID. Only the common ones:
 * a zone nobody here knows is read as UTC.
 */
const WINDOWS_ZONES: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "Central America Standard Time": "America/Guatemala",
  "Mexico Standard Time": "America/Mexico_City",
  "SA Pacific Standard Time": "America/Bogota",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Pacific SA Standard Time": "America/Santiago",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Russian Standard Time": "Europe/Moscow",
  "Turkey Standard Time": "Europe/Istanbul",
  "Israel Standard Time": "Asia/Jerusalem",
  "Egypt Standard Time": "Africa/Cairo",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Arab Standard Time": "Asia/Riyadh",
  "Arabian Standard Time": "Asia/Dubai",
  "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "Singapore Standard Time": "Asia/Singapore",
  "SE Asia Standard Time": "Asia/Bangkok",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
  UTC: "UTC",
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** An IANA zone the runtime knows, from what TZID said; null when it is not one. */
function knownZone(raw: string | undefined): string | null {
  const name = (raw ?? "").trim().replace(/^"|"$/g, "");
  if (!name) return null;
  const candidate = WINDOWS_ZONES[name] ?? name;
  let format = formatters.get(candidate);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat("en-US", {
        timeZone: candidate,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    } catch {
      format = null;
    }
    formatters.set(candidate, format);
  }
  return format ? candidate : null;
}

/** How far ahead of UTC a zone's clocks are at an instant, in milliseconds. */
function offsetOf(zone: string, instant: number): number {
  const format = formatters.get(zone);
  if (!format) return 0;
  const seconds = Math.floor(instant / 1000) * 1000;
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(seconds))
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  return wall - seconds;
}

/** The instant a zone's clocks showed `wall` (a wall-clock time written as if it were UTC). */
function wallToInstant(zone: string | null, wall: number): number {
  if (!zone) return wall;
  const first = wall - offsetOf(zone, wall);
  return wall - offsetOf(zone, first);
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** The lines of a feed, with the ones that were folded onto the next line put back together. */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0)
      lines[lines.length - 1] += raw.slice(1);
    else lines.push(raw);
  }
  return lines;
}

/** `NAME;PARAM=value:content`, or null when the line is not one. */
function parseLine(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head: string[] = [];
  let current = "";
  quoted = false;
  for (const char of line.slice(0, colon)) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      head.push(current);
      current = "";
    } else current += char;
  }
  head.push(current);
  const name = head[0].trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(name)) return null;
  const params: Record<string, string> = {};
  for (const param of head.slice(1)) {
    const equals = param.indexOf("=");
    if (equals > 0)
      params[param.slice(0, equals).trim().toUpperCase()] = param
        .slice(equals + 1)
        .replace(/^"|"$/g, "");
  }
  return { name, params, value: line.slice(colon + 1) };
}

const unescapeText = (value: string) =>
  value.replace(/\\([nN,;\\])/g, (_, char: string) =>
    char === "n" || char === "N" ? " " : char,
  );

/** A date or a date and time of the feed, as the event needs it. */
type When =
  | { kind: "date"; day: number }
  | { kind: "time"; wall: number; zone: string | null; instant: number };

function parseWhen(
  property: { params: Record<string, string>; value: string },
  calendarZone: string | null,
): When | null {
  const value = property.value.trim();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  const match = date ?? time;
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const [hour, minute, second] = time
    ? [match[4], match[5], match[6]].map(Number)
    : [0, 0, 0];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (
    Number.isNaN(wall) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  )
    return null;
  if (date) return { kind: "date", day: wall };
  const zone = match[7]
    ? null
    : property.params.TZID !== undefined
      ? knownZone(property.params.TZID)
      : calendarZone;
  return { kind: "time", wall, zone, instant: wallToInstant(zone, wall) };
}

function parseDuration(value: string): number | null {
  const match =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      value.trim(),
    );
  if (!match || value.trim().replace(/^[+-]?P/, "") === "") return null;
  const [weeks, days, hours, minutes, seconds] = match
    .slice(2)
    .map((part) => Number(part ?? 0));
  const total =
    (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60_000 +
    seconds * 1000;
  return match[1] === "-" ? -total : total;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface Rule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  count: number | null;
  until: number | null;
  byDay: Array<{ ordinal: number | null; weekday: number }>;
  byMonthDay: number[];
}

function parseRule(text: string, calendarZone: string | null): Rule | null {
  const parts = new Map<string, string>();
  for (const part of text.split(";")) {
    const equals = part.indexOf("=");
    if (equals > 0)
      parts.set(
        part.slice(0, equals).trim().toUpperCase(),
        part.slice(equals + 1).trim(),
      );
  }
  const freq = parts.get("FREQ")?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return null;

  const positive = (raw: string | undefined) => {
    const number = Number(raw);
    return raw !== undefined && Number.isInteger(number) && number >= 1
      ? number
      : null;
  };
  let until: number | null = null;
  const untilText = parts.get("UNTIL");
  if (untilText) {
    const when = parseWhen({ params: {}, value: untilText }, calendarZone);
    if (when) until = when.kind === "date" ? when.day + DAY - 1 : when.instant;
  }
  const byDay = (parts.get("BYDAY") ?? "")
    .split(",")
    .map((token) =>
      /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(token.trim()),
    )
    .filter((match) => match !== null)
    .map((match) => ({
      ordinal: match[1] ? Number(match[1]) : null,
      weekday: WEEKDAYS.indexOf(match[2].toUpperCase()),
    }));
  const byMonthDay = (parts.get("BYMONTHDAY") ?? "")
    .split(",")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day !== 0 && Math.abs(day) <= 31);
  return {
    freq,
    interval: positive(parts.get("INTERVAL")) ?? 1,
    count: positive(parts.get("COUNT")),
    until,
    byDay,
    byMonthDay,
  };
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** Days (midnight UTC, as wall-clock days) a monthly rule falls on in one month. */
function monthDays(rule: Rule, year: number, month: number, startDay: number) {
  const size = daysInMonth(year, month);
  const first = Date.UTC(year, month, 1);
  const days = new Set<number>();
  if (rule.byMonthDay.length > 0) {
    for (const n of rule.byMonthDay) {
      const day = n > 0 ? n : size + 1 + n;
      if (day >= 1 && day <= size) days.add(first + (day - 1) * DAY);
    }
  } else if (rule.byDay.length > 0) {
    for (const { ordinal, weekday } of rule.byDay) {
      const matching: number[] = [];
      for (let day = 1; day <= size; day++)
        if (new Date(first + (day - 1) * DAY).getUTCDay() === weekday)
          matching.push(first + (day - 1) * DAY);
      if (ordinal === null) matching.forEach((d) => days.add(d));
      else {
        const picked =
          ordinal > 0 ? matching[ordinal - 1] : matching.at(ordinal);
        if (picked !== undefined) days.add(picked);
      }
    }
  } else {
    const wanted = new Date(startDay).getUTCDate();
    if (wanted <= size) days.add(first + (wanted - 1) * DAY);
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * The wall-clock times (as if UTC) a rule gives, in order, starting from the
 * first one. Stops when `keepGoing` says so for an occurrence; it also stops by
 * itself after the rule's count, or after too many repetitions to be sensible.
 */
function* occurrences(
  startWall: number,
  rule: Rule,
): Generator<number, void, undefined> {
  const timeOfDay = ((startWall % DAY) + DAY) % DAY;
  const startDay = startWall - timeOfDay;
  let emitted = 0;
  const emit = (day: number) => {
    emitted++;
    return day + timeOfDay;
  };

  if (rule.freq === "DAILY") {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (rule.count !== null && emitted >= rule.count) return;
      yield emit(startDay + step * rule.interval * DAY);
    }
  } else if (rule.freq === "WEEKLY") {
    const weekday = new Date(startDay).getUTCDay();
    const wanted = (
      rule.byDay.length > 0 ? rule.byDay.map((d) => d.weekday) : [weekday]
    )
      .map((day) => (day + 6) % 7)
      .sort((a, b) => a - b);
    const monday = startDay - ((weekday + 6) % 7) * DAY;
    for (let step = 0; step < MAX_STEPS; step++) {
      const week = monday + step * rule.interval * 7 * DAY;
      for (const offset of new Set(wanted)) {
        const day = week + offset * DAY;
        if (day < startDay) continue;
        if (rule.count !== null && emitted >= rule.count) return;
        yield emit(day);
      }
    }
  } else {
    const start = new Date(startDay);
    for (let step = 0; step < MAX_STEPS; step++) {
      const index = start.getUTCMonth() + step * rule.interval;
      const year = start.getUTCFullYear() + Math.floor(index / 12);
      const month = ((index % 12) + 12) % 12;
      for (const day of monthDays(rule, year, month, startDay)) {
        if (day < startDay) continue;
        if (rule.count !== null && emitted >= rule.count) return;
        yield emit(day);
      }
    }
  }
}

interface RawEvent {
  properties: Property[];
}

const first = (event: RawEvent, name: string) =>
  event.properties.find((property) => property.name === name);

/** The VEVENT blocks of a feed, and the time zone the calendar says its floating times are in. */
function readBlocks(text: string): {
  events: RawEvent[];
  calendarZone: string | null;
} {
  const events: RawEvent[] = [];
  let calendarZone: string | null = null;
  let open: RawEvent | null = null;
  let depth = 0;
  for (const line of unfold(text)) {
    const property = parseLine(line);
    if (!property) continue;
    if (property.name === "BEGIN") {
      const kind = property.value.trim().toUpperCase();
      if (open) depth++;
      else if (kind === "VEVENT") {
        if (events.length >= MAX_VEVENTS) break;
        open = { properties: [] };
        depth = 0;
      }
    } else if (property.name === "END") {
      if (open && depth > 0) depth--;
      else if (open && property.value.trim().toUpperCase() === "VEVENT") {
        events.push(open);
        open = null;
      }
    } else if (open) {
      if (depth === 0) open.properties.push(property);
    } else if (property.name === "X-WR-TIMEZONE" && calendarZone === null) {
      calendarZone = knownZone(unescapeText(property.value));
    }
  }
  return { events, calendarZone };
}

const dayOf = (wall: number) => Math.floor(wall / DAY) * DAY;

function whenOf(
  event: RawEvent,
  name: string,
  calendarZone: string | null,
): When | null {
  const property = first(event, name);
  return property ? parseWhen(property, calendarZone) : null;
}

/**
 * The events of an iCalendar feed that touch a window, with the repeating ones
 * expanded, sorted by start. Anything that is not a calendar gives an empty
 * list; this never throws.
 *
 * What it understands: DTSTART/DTEND/DURATION, all-day events, UTC times and
 * TZID times (an IANA name, or one of the common Windows names; any other zone
 * is read as UTC, and so are floating times unless the calendar says
 * X-WR-TIMEZONE), RRULE for DAILY, WEEKLY and MONTHLY with INTERVAL, COUNT,
 * UNTIL, BYDAY (with an ordinal for monthly) and BYMONTHDAY, EXDATE, and moved
 * or cancelled single occurrences (RECURRENCE-ID). Other frequencies leave the
 * event as the one occurrence it starts from; RDATE and WKST are ignored.
 */
export function parseIcs(text: string, window: IcsWindow): CalendarEvent[] {
  if (typeof text !== "string" || text.length > MAX_INPUT_CHARS) return [];
  try {
    return read(text, window);
  } catch {
    return [];
  }
}

function read(text: string, window: IcsWindow): CalendarEvent[] {
  const { events: blocks, calendarZone } = readBlocks(text);
  const found: CalendarEvent[] = [];
  const replaced = new Set<string>();

  const parsed = blocks.map((block) => {
    const uid = first(block, "UID")?.value.trim() ?? "";
    const recurrenceId = whenOf(block, "RECURRENCE-ID", calendarZone);
    if (uid && recurrenceId)
      replaced.add(
        `${uid}|${recurrenceId.kind === "date" ? recurrenceId.day : recurrenceId.instant}`,
      );
    return { block, uid, isOverride: recurrenceId !== null };
  });

  for (const { block, uid, isOverride } of parsed) {
    const status = first(block, "STATUS")?.value.trim().toUpperCase();
    if (status === "CANCELLED") continue;
    const start = whenOf(block, "DTSTART", calendarZone);
    if (!start) continue;
    const end = whenOf(block, "DTEND", calendarZone);
    const durationText = first(block, "DURATION")?.value;
    const duration = durationText ? parseDuration(durationText) : null;

    let length: number;
    if (start.kind === "date") {
      if (end?.kind === "date") length = end.day - start.day;
      else if (duration !== null) length = Math.max(DAY, duration);
      else length = DAY;
      if (end && end.kind === "date" && length <= 0) continue;
    } else if (end?.kind === "time") length = end.instant - start.instant;
    else if (end?.kind === "date") length = end.day - start.instant;
    else length = duration ?? 0;
    if (length < 0) continue;

    const title = cleanTitle(
      unescapeText(first(block, "SUMMARY")?.value ?? ""),
    );
    const allDay = start.kind === "date";
    const startWall = start.kind === "date" ? start.day : start.wall;
    const zone = start.kind === "date" ? null : start.zone;
    const toInstant = (wall: number) => wallToInstant(zone, wall);

    const touches = (instant: number) =>
      instant < window.to &&
      (instant + length > window.from ||
        (length === 0 && instant >= window.from));
    const add = (instant: number) => {
      if (uid && !isOverride && replaced.has(`${uid}|${instant}`)) return;
      found.push({ title, start: instant, end: instant + length, allDay });
    };

    const ruleText = isOverride ? undefined : first(block, "RRULE")?.value;
    const rule = ruleText ? parseRule(ruleText, calendarZone) : null;
    if (!rule) {
      const instant = start.kind === "date" ? start.day : start.instant;
      if (touches(instant)) add(instant);
      continue;
    }

    const excludedInstants = new Set<number>();
    const excludedDays = new Set<number>();
    for (const property of block.properties) {
      if (property.name !== "EXDATE") continue;
      for (const value of property.value.split(",")) {
        const when = parseWhen(
          { params: property.params, value },
          calendarZone,
        );
        if (when?.kind === "date") excludedDays.add(when.day);
        else if (when) excludedInstants.add(when.instant);
      }
    }

    let taken = 0;
    for (const wall of occurrences(startWall, rule)) {
      const instant = toInstant(wall);
      if (rule.until !== null && instant > rule.until) break;
      if (instant >= window.to) break;
      if (
        !touches(instant) ||
        excludedInstants.has(instant) ||
        excludedDays.has(dayOf(wall))
      )
        continue;
      add(instant);
      if (++taken >= MAX_ICS_EVENTS) break;
    }
  }

  return found
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
    .slice(0, MAX_ICS_EVENTS);
}
