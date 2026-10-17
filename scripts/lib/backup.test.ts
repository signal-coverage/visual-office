import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  checksumOf,
  collectBackup,
  describeBackup,
  normalizeServerUrl,
  parseBackup,
  tokenFromFile,
  serializeBackup,
  type HttpClient,
  type HttpReply,
} from "./backup.ts";

const FEED = "https://calendar.example.com/ical/private-0123456789abcdef.ics";

type Handler = (query: URLSearchParams) => HttpReply;
type Routes = Record<string, Handler | Record<string, unknown>>;

const base: Routes = {
  "/admin/floors": {
    floors: [
      { id: "office", name: "Main office", common: true, createdAt: 0 },
      { id: "lab", name: "Lab", common: false, createdAt: 5 },
      { id: "old", name: "Old", common: false, createdAt: 6, archivedAt: 99 },
    ],
    templates: [{ id: "default" }],
  },
  "/admin/people": {
    floors: ["office", "lab", "old"],
    people: [
      {
        id: "user_ana",
        name: "Ana",
        email: "ana@acme.com",
        isAdmin: true,
        headOf: ["lab"],
        access: ["lab"],
        bannedUntil: 12345,
      },
      {
        id: "user_beto",
        name: "Beto",
        email: "beto@acme.com",
        isAdmin: false,
        headOf: [],
        access: [],
      },
    ],
  },
  "/admin/groups": {
    groups: [
      {
        id: "design",
        name: "Design",
        createdAt: 1,
        members: ["user_beto"],
        floors: ["lab"],
      },
    ],
    limits: { groups: 50 },
  },
  "/admin/settings": { allowNameEdit: true },
  "/admin/calendars": {
    rooms: [
      {
        room: "meeting",
        label: "Meeting",
        floor: "office",
        floorName: "Main office",
        url: FEED,
      },
      { room: "quiet", label: "Quiet", url: null },
    ],
  },
  "/admin/content": (query) => ({
    status: 200,
    body: {
      floor: { id: query.get("floor"), name: "x" },
      books: [{ id: "b1", title: "Handbook" }],
      announcements: [],
    },
  }),
  "/admin/floors/office/layout": {
    floor: "office",
    version: 3,
    furniture: [],
    models: [],
    shell: { w: 1 },
  },
  "/admin/floors/lab/layout": {
    status: 404,
    body: { error: "This floor has no stored layout." },
  },
  "/admin/floors/old/layout": {
    status: 404,
    body: { error: "This floor has no stored layout." },
  },
  "/admin/floors/office/layout/versions": {
    versions: [{ version: 3 }, { version: 2 }, { version: 1 }],
  },
  "/admin/floors/office/layout/versions/3": { version: 3, furniture: [] },
  "/admin/floors/office/layout/versions/2": { version: 2, furniture: [] },
  "/admin/floors/office/layout/versions/1": { version: 1, furniture: [] },
};

function fake(overrides: Routes = {}) {
  const routes = { ...base, ...overrides };
  const asked: string[] = [];
  const http: HttpClient = {
    async get(path) {
      asked.push(path);
      const url = new URL(path, "http://x");
      const route = routes[url.pathname];
      if (route === undefined)
        return { status: 404, body: { error: "Not found." } };
      if (typeof route === "function") return route(url.searchParams);
      const reply = route as { status?: number; body?: unknown };
      return typeof reply.status === "number" && "body" in reply
        ? { status: reply.status, body: reply.body }
        : { status: 200, body: route };
    },
  };
  return { http, asked };
}

const options = {
  includeSecrets: false,
  allVersions: false,
  now: () => 1_700_000_000_000,
  sleep: async () => {},
};

describe("collectBackup", () => {
  it("gathers the app's own data into one file with a version header", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file, warnings } = await collectBackup(http, options);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(warnings).toEqual([]);
    expect(file.data.floors.map((f) => f.id)).toEqual(["office", "lab", "old"]);
    expect(file.data.floorAccess).toEqual([
      { floor: "lab", userId: "user_ana" },
    ]);
    expect(file.data.heads).toEqual([{ floor: "lab", userId: "user_ana" }]);
    expect(file.data.groups).toEqual([
      {
        id: "design",
        name: "Design",
        createdAt: 1,
        members: ["user_beto"],
        floors: ["lab"],
      },
    ]);
    expect(file.data.settings).toEqual({ allowNameEdit: true });
    expect(file.data.content.office).toEqual({
      books: [{ id: "b1", title: "Handbook" }],
      announcements: [],
    });
  });

  it("leaves emails and ban state out: they are not the app's data to keep", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    const text = serializeBackup(file);
    expect(text).not.toContain("ana@acme.com");
    expect(text).not.toContain("bannedUntil");
    expect(file.data.people).toEqual([
      { id: "user_ana", name: "Ana", isAdmin: true },
      { id: "user_beto", name: "Beto", isAdmin: false },
    ]);
  });

  it("does not keep the secret feed addresses unless asked", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const redacted = await collectBackup(http, options);
    const text = serializeBackup(redacted.file);
    expect(text).not.toContain("0123456789abcdef");
    expect(text).not.toContain(FEED);
    expect(redacted.file.data.calendars).toEqual([
      {
        room: "meeting",
        label: "Meeting",
        floor: "office",
        floorName: "Main office",
        configured: true,
        host: "calendar.example.com",
      },
      { room: "quiet", label: "Quiet", configured: false, host: null },
    ]);
    expect(redacted.file.options.includeSecrets).toBe(false);

    const full = await collectBackup(http, {
      ...options,
      includeSecrets: true,
    });
    expect(serializeBackup(full.file)).toContain(FEED);
    expect(full.file.options.includeSecrets).toBe(true);
  });

  it("keeps the current layout of each floor, and no history unless asked", async () => {
    const { http, asked } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file, warnings } = await collectBackup(http, options);
    expect(file.data.layouts.office).toEqual({
      current: {
        floor: "office",
        version: 3,
        furniture: [],
        models: [],
        shell: { w: 1 },
      },
    });
    expect(file.data.layouts.lab).toEqual({ current: null });
    expect(asked.some((path) => path.includes("/versions"))).toBe(false);
    expect(file.data.layouts.old).toEqual({ current: null });
    expect(warnings).toEqual([]);
  });

  it("keeps every version of every layout with --all-versions", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, {
      ...options,
      allVersions: true,
    });
    expect(
      file.data.layouts.office.versions?.map(
        (v) => (v as { version: number }).version,
      ),
    ).toEqual([3, 2, 1]);
    expect(file.options.allVersions).toBe(true);
  });

  it("pages through the audit log, newest first, until the end", async () => {
    const { http, asked } = fake({
      "/admin/audit": (query) =>
        query.get("before") === null
          ? {
              status: 200,
              body: { entries: [{ id: 5 }, { id: 4 }], nextBefore: 4 },
            }
          : { status: 200, body: { entries: [{ id: 3 }], nextBefore: null } },
    });
    const { file, warnings } = await collectBackup(http, options);
    expect(file.data.audit?.map((e) => (e as { id: number }).id)).toEqual([
      5, 4, 3,
    ]);
    expect(asked.filter((p) => p.startsWith("/admin/audit"))).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it("stops the audit log at a bound and says so", async () => {
    const { http } = fake({
      "/admin/audit": () => ({
        status: 200,
        body: { entries: [{ id: 2 }, { id: 1 }], nextBefore: 1 },
      }),
    });
    const { file, warnings } = await collectBackup(http, {
      ...options,
      maxAuditEntries: 4,
    });
    expect(file.data.audit).toHaveLength(4);
    expect(warnings.join(" ")).toMatch(/audit.*first 4/i);
  });

  it("notes a section it could not read and still keeps the rest", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
      "/admin/groups": {
        status: 503,
        body: { error: "The database cannot be reached right now." },
      },
    });
    const { file, warnings } = await collectBackup(http, options);
    expect(file.data.groups).toBeNull();
    expect(file.data.floors).toHaveLength(3);
    expect(warnings).toEqual([expect.stringMatching(/groups.*503/i)]);
    expect(file.warnings).toEqual(warnings);
  });

  it("notes a floor whose content could not be read", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
      "/admin/content": (query) =>
        query.get("floor") === "old"
          ? { status: 404, body: { error: "No such floor." } }
          : {
              status: 200,
              body: { books: [{ id: "b1" }], announcements: [] },
            },
    });
    const { file, warnings } = await collectBackup(http, options);
    expect(file.data.content.old).toBeNull();
    expect(warnings.join(" ")).toMatch(/content.*old/i);
  });

  it("stops with a clear error when the caller is not allowed", async () => {
    const http: HttpClient = {
      get: async () => ({ status: 403, body: { error: "Not allowed." } }),
    };
    await expect(collectBackup(http, options)).rejects.toMatchObject({
      name: "BackupError",
      exitCode: 3,
      message: expect.stringMatching(/not allowed.*admin/i),
    });
  });

  it("stops with a clear error when the server cannot be reached", async () => {
    const http: HttpClient = {
      get: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const error = await collectBackup(http, options).catch((e) => e);
    expect(error).toBeInstanceOf(BackupError);
    expect(error.exitCode).toBe(3);
    expect(error.message).toMatch(/could not reach/i);
  });

  it("waits and asks again when the server says to slow down", async () => {
    let calls = 0;
    const slept: number[] = [];
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
      "/admin/settings": () => {
        calls++;
        return calls === 1
          ? { status: 429, body: {}, retryAfterSeconds: 7 }
          : { status: 200, body: { allowNameEdit: false } };
      },
    });
    const { file } = await collectBackup(http, {
      ...options,
      sleep: async (ms) => void slept.push(ms),
    });
    expect(slept).toEqual([7000]);
    expect(file.data.settings).toEqual({ allowNameEdit: false });
  });
});

describe("checksum and the file format", () => {
  it("does not depend on the order of keys", () => {
    expect(checksumOf({ a: 1, b: { c: 2, d: 3 } })).toBe(
      checksumOf({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(checksumOf({ a: 1 })).not.toBe(checksumOf({ a: 2 }));
  });

  it("round-trips: what was written reads back valid, with a summary", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [{ id: 1 }], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    const read = parseBackup(serializeBackup(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.summary).toMatchObject({
      version: 1,
      floors: 3,
      archivedFloors: 1,
      groups: 1,
      people: 2,
      books: 3,
      auditEntries: 1,
      includeSecrets: false,
    });
    expect(describeBackup(read.summary)).toContain("3 floors (1 archived)");
  });

  it("refuses text that is not JSON, or not one of ours", () => {
    expect(parseBackup("nope").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "other" })).ok).toBe(false);
  });

  it("refuses a file from a newer version of the tool", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    const result = parseBackup(serializeBackup({ ...file, version: 99 }));
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.errors.join(" ")).toMatch(/version 99/);
  });

  it("notices a file that was changed after it was written", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    const tampered = serializeBackup(file).replace("Main office", "Hacked");
    const result = parseBackup(tampered);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/checksum/i);
  });

  it("notices a file with a section missing", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    const broken = { ...file, data: { ...file.data } } as Record<
      string,
      unknown
    >;
    delete (broken.data as Record<string, unknown>).floors;
    const result = parseBackup(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/floors/);
  });

  it("carries no address of the server and no token", async () => {
    const { http } = fake({
      "/admin/audit": { entries: [], nextBefore: null },
    });
    const { file } = await collectBackup(http, options);
    expect(serializeBackup(file)).not.toMatch(
      /https?:\/\/(?!calendar)|Bearer|token/i,
    );
  });
});

describe("normalizeServerUrl", () => {
  it("turns the game's websocket address into the HTTP one", () => {
    expect(normalizeServerUrl("wss://office.up.railway.app")).toBe(
      "https://office.up.railway.app",
    );
    expect(normalizeServerUrl("ws://localhost:2567/")).toBe(
      "http://localhost:2567",
    );
  });

  it("keeps only the origin", () => {
    expect(normalizeServerUrl("https://office.example.com/admin?x=1")).toBe(
      "https://office.example.com",
    );
  });

  it("allows plain http only for this machine: a token must not cross the internet unencrypted", () => {
    expect(normalizeServerUrl("http://127.0.0.1:2568")).toBe(
      "http://127.0.0.1:2568",
    );
    expect(() => normalizeServerUrl("http://office.example.com")).toThrow(
      /https/,
    );
  });

  it("refuses what is not an address, or has a password in it", () => {
    for (const bad of ["", "nonsense", "ftp://x.com", "https://u:p@x.com"])
      expect(() => normalizeServerUrl(bad)).toThrow(BackupError);
  });
});

describe("tokenFromFile", () => {
  it("takes the first line, trimmed", () => {
    expect(tokenFromFile(["  abc123  ", "ignored", ""].join("\n"))).toBe(
      "abc123",
    );
  });

  it("refuses an empty file, or one that does not hold a single token, without repeating its content", () => {
    for (const bad of ["", "   \n", "two words"]) {
      const error = (() => {
        try {
          tokenFromFile(bad);
        } catch (e) {
          return e as BackupError;
        }
      })();
      expect(error).toBeInstanceOf(BackupError);
      expect(error?.exitCode).toBe(2);
      expect(error?.message).not.toContain("two words");
    }
  });
});
