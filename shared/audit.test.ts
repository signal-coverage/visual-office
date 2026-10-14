import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, describeAudit, type AuditEntry } from "./audit.ts";

const entry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  at: 0,
  actorUserId: "user_ana",
  actorName: "Ana",
  action: "floor.lock",
  targetUserId: null,
  targetName: null,
  floor: "office",
  detail: {},
  ...overrides,
});

describe("describeAudit", () => {
  it("describes the moderation actions", () => {
    const of = (action: string, detail = {}) =>
      describeAudit(
        entry({
          action,
          targetUserId: "user_beto",
          targetName: "Beto",
          detail,
        }),
      );
    expect(of("moderation.mute")).toBe("Ana muted Beto in voice on office");
    expect(of("moderation.unmute")).toBe("Ana let Beto speak again on office");
    expect(of("moderation.kick")).toBe("Ana removed Beto from office");
    expect(of("moderation.ban", { minutes: 10 })).toBe(
      "Ana banned Beto from office for 10 minutes",
    );
    expect(of("moderation.ban", { minutes: 1 })).toBe(
      "Ana banned Beto from office for 1 minute",
    );
    expect(of("moderation.unban")).toBe("Ana lifted the ban on Beto");
  });

  it("describes closing and opening a floor", () => {
    expect(describeAudit(entry({ action: "floor.lock" }))).toBe(
      "Ana closed office to edit it",
    );
    expect(describeAudit(entry({ action: "floor.unlock" }))).toBe(
      "Ana opened office again",
    );
  });

  it("describes publishing, going back and vouching for a layout", () => {
    expect(
      describeAudit(
        entry({ action: "layout.publish", detail: { version: 3 } }),
      ),
    ).toBe("Ana published version 3 of office");
    expect(
      describeAudit(
        entry({
          action: "layout.revert",
          detail: { version: 5, revertedTo: 2 },
        }),
      ),
    ).toBe("Ana went back office to version 2 (published as version 5)");
    expect(
      describeAudit(entry({ action: "layout.mark", detail: { version: 3 } })),
    ).toBe("Ana vouched for version 3 of office");
  });

  it("describes naming and removing a head", () => {
    const person = { targetUserId: "user_beto", targetName: "Beto" };
    expect(describeAudit(entry({ action: "head.assign", ...person }))).toBe(
      "Ana named Beto head of office",
    );
    expect(describeAudit(entry({ action: "head.remove", ...person }))).toBe(
      "Ana removed Beto as head of office",
    );
  });

  it("describes the company's settings", () => {
    expect(
      describeAudit(
        entry({
          action: "settings.allow_name_edit",
          floor: null,
          detail: { allow: true },
        }),
      ),
    ).toBe("Ana let people choose their own name");
    expect(
      describeAudit(
        entry({
          action: "settings.allow_name_edit",
          floor: null,
          detail: { allow: false },
        }),
      ),
    ).toBe("Ana stopped people choosing their own name");
    expect(describeAudit(entry({ action: "company.setup", floor: null }))).toBe(
      "Ana set the company up",
    );
  });

  it("does not break on what it does not know", () => {
    expect(describeAudit(entry({ action: "something.new" }))).toBe(
      "Ana did something.new on office",
    );
    expect(
      describeAudit(
        entry({ action: "layout.publish", detail: { version: "x" } }),
      ),
    ).toBe("Ana published a new version of office");
    expect(
      describeAudit(entry({ action: "moderation.kick", targetName: null })),
    ).toBe("Ana removed somebody from office");
  });

  it("describes calendar changes by room, and never mentions an address", () => {
    expect(
      describeAudit(
        entry({
          action: "calendar.set",
          floor: null,
          detail: { room: "meeting" },
        }),
      ),
    ).toBe("Ana set the calendar of Meeting room");
    expect(
      describeAudit(
        entry({
          action: "calendar.clear",
          floor: null,
          detail: { room: "meeting" },
        }),
      ),
    ).toBe("Ana removed the calendar of Meeting room");
    expect(
      describeAudit(entry({ action: "calendar.set", floor: null, detail: {} })),
    ).toBe("Ana set the calendar of a room");
  });
});

describe("describeAudit for rooms", () => {
  it("describes making and renaming a room", () => {
    expect(
      describeAudit(
        entry({
          action: "floor.create",
          floor: "hr",
          detail: { name: "Human Resources" },
        }),
      ),
    ).toBe("Ana made the room Human Resources (hr)");
    expect(describeAudit(entry({ action: "floor.create", floor: "hr" }))).toBe(
      "Ana made the room hr",
    );
    expect(
      describeAudit(
        entry({
          action: "floor.rename",
          floor: "hr",
          detail: { from: "People", to: "Human Resources" },
        }),
      ),
    ).toBe("Ana renamed the room People to Human Resources (hr)");
    expect(describeAudit(entry({ action: "floor.rename", floor: "hr" }))).toBe(
      "Ana renamed the room hr",
    );
  });

  it("describes giving and taking away an entry", () => {
    const person = { targetUserId: "user_beto", targetName: "Beto" };
    expect(
      describeAudit(
        entry({
          action: "floor.access",
          floor: "hr",
          detail: { allowed: true },
          ...person,
        }),
      ),
    ).toBe("Ana let Beto enter hr");
    expect(
      describeAudit(
        entry({
          action: "floor.access",
          floor: "hr",
          detail: { allowed: false },
          ...person,
        }),
      ),
    ).toBe("Ana stopped Beto entering hr");
  });
});

describe("describeAudit for content", () => {
  const of = (action: string, detail: Record<string, unknown>, floor = "hr") =>
    describeAudit(entry({ action, floor, detail }));

  it("describes adding, changing and removing a book or an announcement", () => {
    expect(of("content.create", { kind: "book", title: "Handbook" })).toBe(
      'Ana added the book "Handbook" to hr',
    );
    expect(of("content.create", { kind: "announcement", title: "Party" })).toBe(
      'Ana added the announcement "Party" to hr',
    );
    expect(of("content.update", { kind: "book", title: "Handbook" })).toBe(
      'Ana changed the book "Handbook" of hr',
    );
    expect(of("content.delete", { kind: "announcement", title: "Party" })).toBe(
      'Ana removed the announcement "Party" from hr',
    );
  });

  it("still reads right when the details are missing", () => {
    expect(of("content.create", {})).toBe("Ana added something to hr");
    expect(of("content.delete", { kind: "other", title: 4 })).toBe(
      "Ana removed something from hr",
    );
  });

  it("is a recorded action", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "content.create",
        "content.update",
        "content.delete",
      ]),
    );
  });
});
