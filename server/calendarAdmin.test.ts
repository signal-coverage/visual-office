import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { handleCalendarAdmin } from "./calendarAdmin.ts";
import type { FeedResult } from "./calendarFetch.ts";
import { createCalendarService } from "./calendarService.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_x", email: null, name: "X", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const admin = person({ admin: true });
const head = person({ headOf: ["office"] });
const member = person({});
const machine: Actor = { kind: "machine" };

const SECRET_URL = "https://calendar.example.com/ical/SECRETTOKEN/basic.ics";
const FEED = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Later",
  `DTSTART:${new Date(Date.now() + 3_600_000)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, "")}`,
  "DURATION:PT1H",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("handleCalendarAdmin", () => {
  let recorded: AuditInput[];
  let fetched: string[];
  let feed: FeedResult;
  let store: MemorySettingsStore;
  const calendar = () =>
    createCalendarService({
      store,
      fetchFeed: async (url) => {
        fetched.push(url);
        return feed;
      },
      rooms: ["meeting"],
    });
  let service = calendar();

  const call = (
    actor: Actor | undefined,
    method: string,
    path = "/admin/calendars",
    body?: unknown,
  ) =>
    handleCalendarAdmin(
      { method, path, body, actor },
      {
        calendar: service,
        rooms: [{ id: "meeting", label: "Meeting room" }],
        audit: async (entry) => {
          recorded.push(entry);
        },
      },
    );

  beforeEach(() => {
    recorded = [];
    fetched = [];
    feed = { ok: true, text: FEED };
    store = new MemorySettingsStore();
    service = calendar();
  });

  it("answers nothing for paths that are not about calendars", async () => {
    expect(await call(admin, "GET", "/admin/settings")).toBeNull();
    expect(await call(admin, "GET", "/admin/calendars/other/x")).toBeNull();
    expect(await call(admin, "GET", "/calendar")).toBeNull();
  });

  it("lists the rooms, with the feed of each", async () => {
    expect(await call(admin, "GET")).toEqual({
      status: 200,
      body: {
        rooms: [{ room: "meeting", label: "Meeting room", url: null }],
      },
    });
    await service.setFeed("meeting", SECRET_URL);
    expect((await call(admin, "GET"))?.body).toEqual({
      rooms: [{ room: "meeting", label: "Meeting room", url: SECRET_URL }],
    });
  });

  it("sets a feed, tests it, and says how many events are coming", async () => {
    const reply = await call(admin, "POST", "/admin/calendars", {
      room: "meeting",
      url: SECRET_URL,
    });
    expect(reply).toEqual({
      status: 200,
      body: {
        room: "meeting",
        url: SECRET_URL,
        test: { ok: true, upcoming: 1 },
      },
    });
    expect(await service.feedOf("meeting")).toBe(SECRET_URL);
  });

  it("keeps the feed even when the test fails, and says why", async () => {
    feed = { ok: false, error: "The calendar server answered 404." };
    const reply = await call(admin, "POST", "/admin/calendars", {
      room: "meeting",
      url: SECRET_URL,
    });
    expect(reply?.status).toBe(200);
    expect(reply?.body.test).toEqual({
      ok: false,
      error: "The calendar server answered 404.",
    });
    expect(await service.feedOf("meeting")).toBe(SECRET_URL);
  });

  it("turns webcal into https when saving", async () => {
    const reply = await call(admin, "POST", "/admin/calendars", {
      room: "meeting",
      url: "webcal://calendar.example.com/x.ics",
    });
    expect(reply?.body.url).toBe("https://calendar.example.com/x.ics");
  });

  it("removes a feed with an empty address", async () => {
    await service.setFeed("meeting", SECRET_URL);
    for (const url of ["", "   ", null]) {
      await service.setFeed("meeting", SECRET_URL);
      expect(
        await call(admin, "POST", "/admin/calendars", { room: "meeting", url }),
      ).toEqual({ status: 200, body: { room: "meeting", url: null } });
      expect(await service.feedOf("meeting")).toBeNull();
    }
  });

  it("tests an address without saving it", async () => {
    const reply = await call(admin, "POST", "/admin/calendars/test", {
      url: SECRET_URL,
    });
    expect(reply).toEqual({
      status: 200,
      body: { test: { ok: true, upcoming: 1 } },
    });
    expect(await service.feedOf("meeting")).toBeNull();
    expect(recorded).toEqual([]);
  });

  it("refuses an address that is not a feed it may fetch", async () => {
    for (const url of [
      "http://calendar.example.com/x.ics",
      "https://127.0.0.1/x.ics",
      "https://localhost/x.ics",
      "https://user:pw@calendar.example.com/x.ics",
      "javascript:alert(1)",
      "nonsense",
      42,
    ]) {
      const set = await call(admin, "POST", "/admin/calendars", {
        room: "meeting",
        url,
      });
      expect(set?.status, String(url)).toBe(400);
      const test = await call(admin, "POST", "/admin/calendars/test", { url });
      expect(test?.status, String(url)).toBe(400);
    }
    expect(await service.feedOf("meeting")).toBeNull();
    expect(fetched).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it("refuses a room that does not exist, and a body that is not one", async () => {
    for (const body of [
      undefined,
      null,
      [],
      {},
      { url: SECRET_URL },
      { room: "nowhere", url: SECRET_URL },
      { room: 7, url: SECRET_URL },
    ])
      expect(
        (await call(admin, "POST", "/admin/calendars", body))?.status,
      ).toBe(400);
    expect(
      (await call(admin, "POST", "/admin/calendars/test", {}))?.status,
    ).toBe(400);
  });

  it("lets the server's own tools do it too", async () => {
    expect((await call(machine, "GET"))?.status).toBe(200);
    expect(
      (
        await call(machine, "POST", "/admin/calendars", {
          room: "meeting",
          url: SECRET_URL,
        })
      )?.status,
    ).toBe(200);
  });

  it("refuses heads of floors and members, so the address never reaches them", async () => {
    for (const actor of [head, member]) {
      for (const [method, path] of [
        ["GET", "/admin/calendars"],
        ["POST", "/admin/calendars"],
        ["POST", "/admin/calendars/test"],
      ])
        expect(
          (
            await call(actor, method, path, {
              room: "meeting",
              url: SECRET_URL,
            })
          )?.status,
        ).toBe(403);
    }
    expect(await service.feedOf("meeting")).toBeNull();
    expect(fetched).toEqual([]);
  });

  it("refuses somebody nobody knows", async () => {
    expect((await call(undefined, "GET"))?.status).toBe(401);
    expect(
      (
        await call(undefined, "POST", "/admin/calendars", {
          room: "meeting",
          url: SECRET_URL,
        })
      )?.status,
    ).toBe(401);
  });

  it("only answers GET and POST", async () => {
    expect((await call(admin, "DELETE"))?.status).toBe(405);
    expect((await call(admin, "GET", "/admin/calendars/test"))?.status).toBe(
      405,
    );
  });

  it("records who set or removed a feed, naming the room and never the address", async () => {
    await call(admin, "POST", "/admin/calendars", {
      room: "meeting",
      url: SECRET_URL,
    });
    await call(admin, "POST", "/admin/calendars", { room: "meeting", url: "" });
    expect(recorded).toEqual([
      {
        actorUserId: "user_x",
        actorName: "X",
        action: "calendar.set",
        detail: { room: "meeting" },
      },
      {
        actorUserId: "user_x",
        actorName: "X",
        action: "calendar.clear",
        detail: { room: "meeting" },
      },
    ]);
    expect(JSON.stringify(recorded)).not.toContain("SECRETTOKEN");
  });

  it("says so when the database cannot be reached", async () => {
    const broken = createCalendarService({
      store: {
        get: async () => {
          throw new Error("down");
        },
        set: async () => {
          throw new Error("down");
        },
        setIfAbsent: async () => false,
      },
      fetchFeed: async () => feed,
      rooms: ["meeting"],
    });
    const reply = await handleCalendarAdmin(
      { method: "GET", path: "/admin/calendars", actor: admin },
      { calendar: broken, rooms: [{ id: "meeting", label: "M" }] },
    );
    expect(reply?.status).toBe(503);
  });
});
