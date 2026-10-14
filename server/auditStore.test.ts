import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./db/migrate.ts";
import { MemoryAuditStore, type AuditStore } from "./auditStore.ts";
import { PgAuditStore } from "./pgAuditStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = (now: () => number) => Promise<AuditStore>;

const memory: Factory = async (now) => new MemoryAuditStore(now);

const postgres: Factory = async (now) => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return new PgAuditStore(db, now);
};

const ban = {
  actorUserId: "user_ana",
  actorName: "Ana",
  action: "moderation.ban",
  targetUserId: "user_beto",
  targetName: "Beto",
  floor: "office",
  detail: { minutes: 10 },
} as const;

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("audit store, %s", (_name, setup) => {
  it("starts empty", async () => {
    const store = await setup(() => 0);
    expect(await store.list({ limit: 10 })).toEqual([]);
  });

  it("keeps what was done, with when and in what order", async () => {
    let now = 1000;
    const store = await setup(() => now);
    const first = await store.append(ban);
    expect(first).toEqual({ ...ban, id: expect.any(Number), at: 1000 });
    now = 2000;
    const second = await store.append({
      actorUserId: null,
      actorName: "Server",
      action: "floor.lock",
      floor: "office",
    });
    expect(second.id).toBeGreaterThan(first.id);
    expect(second).toMatchObject({
      at: 2000,
      actorUserId: null,
      targetUserId: null,
      targetName: null,
      detail: {},
    });
  });

  it("lists the newest first", async () => {
    let now = 0;
    const store = await setup(() => ++now);
    for (const action of [
      "floor.lock",
      "layout.publish",
      "floor.unlock",
    ] as const)
      await store.append({ actorUserId: "u", actorName: "U", action });
    const entries = await store.list({ limit: 10 });
    expect(entries.map((e) => e.action)).toEqual([
      "floor.unlock",
      "layout.publish",
      "floor.lock",
    ]);
  });

  it("pages: only as many as asked, and the older ones after a cursor", async () => {
    let now = 0;
    const store = await setup(() => ++now);
    for (let i = 1; i <= 5; i++)
      await store.append({
        actorUserId: "u",
        actorName: "U",
        action: "floor.lock",
        detail: { i },
      });
    const first = await store.list({ limit: 2 });
    expect(first.map((e) => e.detail.i)).toEqual([5, 4]);
    const next = await store.list({ limit: 2, before: first[1].id });
    expect(next.map((e) => e.detail.i)).toEqual([3, 2]);
    const last = await store.list({ limit: 2, before: next[1].id });
    expect(last.map((e) => e.detail.i)).toEqual([1]);
  });

  it("round-trips details with text and nested values", async () => {
    const store = await setup(() => 0);
    await store.append({
      actorUserId: "u",
      actorName: 'Ana\'s "name"',
      action: "layout.publish",
      detail: { version: 3, note: "ñ 'q' \"d\"", list: [1, 2] },
    });
    const [entry] = await store.list({ limit: 1 });
    expect(entry.actorName).toBe('Ana\'s "name"');
    expect(entry.detail).toEqual({
      version: 3,
      note: "ñ 'q' \"d\"",
      list: [1, 2],
    });
  });
});
