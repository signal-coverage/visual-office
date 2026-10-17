import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import {
  CachedBanStore,
  MAX_PURGE_PER_CALL,
  MemoryBanStore,
  type BanStore,
} from "./banStore.ts";
import { migrate } from "./db/migrate.ts";
import { PgBanStore } from "./pgBanStore.ts";

const MINUTE = 60_000;

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

const freshDatabase = async () => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return db;
};

type Factory = () => Promise<BanStore>;

const memory: Factory = async () => new MemoryBanStore();

const postgres: Factory = async () => new PgBanStore(await freshDatabase());

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("ban store, %s", (_name, setup) => {
  it("knows nobody is banned at first", async () => {
    const bans = await setup();
    expect(await bans.activeUntil("user_ana", 1000)).toBeNull();
  });

  it("bans for a number of minutes and says until when", async () => {
    const bans = await setup();
    expect(await bans.ban("user_ana", 10, 1000)).toBe(1000 + 10 * MINUTE);
    expect(await bans.activeUntil("user_ana", 1000 + 9 * MINUTE)).toBe(
      1000 + 10 * MINUTE,
    );
  });

  it("lets the ban lapse by itself", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 10, 1000);
    expect(await bans.activeUntil("user_ana", 1000 + 10 * MINUTE)).toBeNull();
    expect(await bans.list(1000 + 10 * MINUTE)).toEqual([]);
  });

  it("replaces the end when somebody is banned again", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 30, 0);
    expect(await bans.ban("user_ana", 5, 0)).toBe(5 * MINUTE);
    expect(await bans.activeUntil("user_ana", 0)).toBe(5 * MINUTE);
    expect(await bans.list(0)).toHaveLength(1);
  });

  it("lifts a ban, and says whether there was one", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 10, 0);
    expect(await bans.lift("user_ana", 0)).toBe(true);
    expect(await bans.activeUntil("user_ana", 0)).toBeNull();
    expect(await bans.lift("user_ana", 0)).toBe(false);
  });

  it("does not count a lapsed ban as one to lift", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 1, 0);
    expect(await bans.lift("user_ana", 2 * MINUTE)).toBe(false);
  });

  it("lists the bans in force", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 10, 0);
    await bans.ban("user_beto", 20, 0);
    expect(await bans.list(0)).toEqual([
      { userId: "user_ana", until: 10 * MINUTE },
      { userId: "user_beto", until: 20 * MINUTE },
    ]);
  });

  it("accepts who banned and why without changing what it answers", async () => {
    const bans = await setup();
    await bans.ban("user_ana", 10, 0, {
      byUserId: "user_root",
      reason: "spam",
    });
    expect(await bans.list(0)).toEqual([
      { userId: "user_ana", until: 10 * MINUTE },
    ]);
  });
});

describe("PgBanStore", () => {
  it("keeps a ban across a restart", async () => {
    const db = await freshDatabase();
    await new PgBanStore(db).ban("user_ana", 10, 1000);
    const restarted = new PgBanStore(db);
    expect(await restarted.activeUntil("user_ana", 2000)).toBe(
      1000 + 10 * MINUTE,
    );
    expect(await restarted.list(2000)).toEqual([
      { userId: "user_ana", until: 1000 + 10 * MINUTE },
    ]);
  });

  it("records who banned, why and when", async () => {
    const db = await freshDatabase();
    await new PgBanStore(db).ban("user_ana", 10, 1000, {
      byUserId: "user_root",
      reason: "spam",
    });
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT user_id, until, reason, by_user_id, created_at FROM bans`,
    );
    expect(rows).toEqual([
      {
        user_id: "user_ana",
        until: 1000 + 10 * MINUTE,
        reason: "spam",
        by_user_id: "user_root",
        created_at: 1000,
      },
    ]);
  });

  it("keeps a lifted ban lifted after a restart", async () => {
    const db = await freshDatabase();
    await new PgBanStore(db).ban("user_ana", 10, 0);
    await new PgBanStore(db).lift("user_ana", 0);
    expect(await new PgBanStore(db).activeUntil("user_ana", 0)).toBeNull();
  });

  it("purges lapsed rows, a bounded amount each time", async () => {
    const db = await freshDatabase();
    const bans = new PgBanStore(db);
    const lapsed = MAX_PURGE_PER_CALL + 5;
    for (let i = 0; i < lapsed; i++) await bans.ban(`user_${i}`, 1, 0);
    await bans.ban("user_live", 10, 0);
    const count = async () =>
      Number(
        (
          await db.query<{ n: string | number }>(
            `SELECT count(*) AS n FROM bans`,
          )
        ).rows[0].n,
      );
    expect(await count()).toBe(lapsed + 1);
    expect(await bans.list(2 * MINUTE)).toEqual([
      { userId: "user_live", until: 10 * MINUTE },
    ]);
    expect(await count()).toBe(6);
    await bans.list(2 * MINUTE);
    expect(await count()).toBe(1);
  });

  it("can have its migration run twice", async () => {
    const db = await freshDatabase();
    await migrate(db);
    await db.query(`DELETE FROM schema_migrations WHERE id = '019_bans'`);
    await migrate(db);
    expect(await new PgBanStore(db).list(0)).toEqual([]);
  });
});

class CountingStore extends MemoryBanStore {
  reads = 0;
  override async activeUntil(userId: string, now: number) {
    this.reads++;
    return super.activeUntil(userId, now);
  }
}

describe("CachedBanStore", () => {
  it("asks the store once while the answer is fresh", async () => {
    const inner = new CountingStore();
    await inner.ban("user_ana", 10, 0);
    const bans = new CachedBanStore(inner, 5000);
    expect(await bans.activeUntil("user_ana", 0)).toBe(10 * MINUTE);
    expect(await bans.activeUntil("user_ana", 1000)).toBe(10 * MINUTE);
    expect(inner.reads).toBe(1);
    await bans.activeUntil("user_ana", 6000);
    expect(inner.reads).toBe(2);
  });

  it("never serves a ban past its end", async () => {
    const inner = new CountingStore();
    await inner.ban("user_ana", 1, 0);
    const bans = new CachedBanStore(inner, 10 * MINUTE);
    expect(await bans.activeUntil("user_ana", 0)).toBe(MINUTE);
    expect(await bans.activeUntil("user_ana", MINUTE)).toBeNull();
  });

  it("sees a ban made through it at once, even after remembering none", async () => {
    const bans = new CachedBanStore(new MemoryBanStore(), 5000);
    expect(await bans.activeUntil("user_ana", 0)).toBeNull();
    await bans.ban("user_ana", 10, 0);
    expect(await bans.activeUntil("user_ana", 1)).toBe(10 * MINUTE);
  });

  it("sees a lift at once", async () => {
    const bans = new CachedBanStore(new MemoryBanStore(), 5000);
    await bans.ban("user_ana", 10, 0);
    await bans.activeUntil("user_ana", 1);
    expect(await bans.lift("user_ana", 2)).toBe(true);
    expect(await bans.activeUntil("user_ana", 3)).toBeNull();
  });

  it("stays bounded in size", async () => {
    const inner = new CountingStore();
    const bans = new CachedBanStore(inner, 5000, 3);
    for (const id of ["a", "b", "c", "d", "e"]) await bans.activeUntil(id, 0);
    await bans.activeUntil("a", 0);
    expect(inner.reads).toBe(6);
  });

  it("passes the list through", async () => {
    const bans = new CachedBanStore(new MemoryBanStore(), 5000);
    await bans.ban("user_ana", 10, 0);
    expect(await bans.list(0)).toEqual([
      { userId: "user_ana", until: 10 * MINUTE },
    ]);
  });
});
