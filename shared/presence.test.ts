import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUS,
  effectiveStatus,
  IDLE_AFTER_MS,
  isIdle,
  asStatus,
  nextStatus,
  sanitizeIdle,
  sanitizeStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUSES,
  type Status,
} from "./presence.ts";

describe("the statuses", () => {
  it("start with available, and every one has a label and a colour", () => {
    expect(DEFAULT_STATUS).toBe("available");
    expect(STATUSES[0]).toBe(DEFAULT_STATUS);
    for (const status of STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("are shown with different colours, or the dot would say nothing", () => {
    expect(new Set(Object.values(STATUS_COLORS)).size).toBe(STATUSES.length);
  });
});

describe("sanitizeStatus", () => {
  it("takes a status from the fixed list", () => {
    for (const status of STATUSES)
      expect(sanitizeStatus({ status })).toBe(status);
  });

  it("is nothing for what is not on the list or not a message", () => {
    for (const raw of [
      null,
      undefined,
      "busy",
      42,
      [],
      {},
      { status: "invisible" },
      { status: "BUSY" },
      { status: 1 },
      { status: ["busy"] },
      { status: "__proto__" },
      { status: "toString" },
    ])
      expect(sanitizeStatus(raw), JSON.stringify(raw)).toBeNull();
  });
});

describe("asStatus", () => {
  it("is the status when it is one, and available when it is anything else", () => {
    for (const status of STATUSES) expect(asStatus(status)).toBe(status);
    for (const raw of ["", "invisible", "BUSY", undefined, null, 3])
      expect(asStatus(raw), String(raw)).toBe("available");
  });
});

describe("sanitizeIdle", () => {
  it("takes a real boolean", () => {
    expect(sanitizeIdle({ idle: true })).toBe(true);
    expect(sanitizeIdle({ idle: false })).toBe(false);
  });

  it("is nothing for anything else", () => {
    for (const raw of [
      null,
      undefined,
      true,
      {},
      { idle: "true" },
      { idle: 1 },
    ])
      expect(sanitizeIdle(raw), JSON.stringify(raw)).toBeNull();
  });
});

describe("isIdle", () => {
  it("is when there was no input for the whole time", () => {
    expect(isIdle(1_000, 1_000 + IDLE_AFTER_MS)).toBe(true);
  });

  it("is not before that", () => {
    expect(isIdle(1_000, 1_000 + IDLE_AFTER_MS - 1)).toBe(false);
  });

  it("takes the time to wait as a parameter", () => {
    expect(isIdle(0, 10, 10)).toBe(true);
    expect(isIdle(0, 9, 10)).toBe(false);
  });
});

describe("effectiveStatus", () => {
  const free = { manual: "available", idle: false, inZone: false } as const;

  it("is what the player chose when nothing else applies", () => {
    for (const manual of STATUSES)
      expect(effectiveStatus({ ...free, manual })).toBe(manual);
  });

  it("is away for somebody available who stopped doing anything", () => {
    expect(effectiveStatus({ ...free, idle: true })).toBe("away");
  });

  it("never overrides a manual do-not-disturb, busy or away", () => {
    for (const manual of ["dnd", "busy", "away"] as const)
      expect(effectiveStatus({ manual, idle: true, inZone: false })).toBe(
        manual,
      );
  });

  it("is busy for somebody available who is in a private zone", () => {
    expect(effectiveStatus({ ...free, inZone: true })).toBe("busy");
  });

  it("keeps the zone busy even when they are quiet, because a meeting is where one listens", () => {
    expect(effectiveStatus({ ...free, inZone: true, idle: true })).toBe("busy");
  });

  it("keeps a manual do-not-disturb inside a zone", () => {
    expect(effectiveStatus({ manual: "dnd", idle: false, inZone: true })).toBe(
      "dnd",
    );
  });
});

describe("nextStatus", () => {
  it("goes round the list and starts again", () => {
    let status: Status = STATUSES[0];
    const seen = [];
    for (let i = 0; i < STATUSES.length; i++) {
      status = nextStatus(status);
      seen.push(status);
    }
    expect(seen).toEqual([...STATUSES.slice(1), STATUSES[0]]);
  });
});
