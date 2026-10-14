import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./db/migrate.ts";
import { FloorLocks, type FloorLockStore } from "./floorLocks.ts";
import { PgFloorLocks } from "./pgFloorLocks.ts";

interface Setup {
  locks: FloorLockStore;
  advance: (ms: number) => number;
}

type Factory = (ttlMs: number) => Promise<Setup>;

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

const memory: Factory = async (ttlMs) => {
  let now = 1_000_000;
  return {
    locks: new FloorLocks(() => now, ttlMs),
    advance: (ms) => (now += ms),
  };
};

const postgres: Factory = async (ttlMs) => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  let now = 1_000_000;
  return {
    locks: new PgFloorLocks(db, () => now, ttlMs),
    advance: (ms) => (now += ms),
  };
};

// The same promises, kept by memory (development) and by Postgres (Neon)
describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("floor locks, %s", (_name, setup) => {
  it("lets the first person who asks edit a floor", async () => {
    const { locks } = await setup(1000);
    const result = await locks.acquire("marketing", "ana");
    expect(result.ok).toBe(true);
    expect(await locks.current("marketing")).toMatchObject({
      floor: "marketing",
      holder: "ana",
    });
  });

  it("starts with every floor open", async () => {
    const { locks } = await setup(1000);
    expect(await locks.current("marketing")).toBeNull();
  });

  it("refuses a second person while the first is editing, and says who", async () => {
    const { locks } = await setup(1000);
    await locks.acquire("marketing", "ana");
    const result = await locks.acquire("marketing", "beto");
    expect(result.ok).toBe(false);
    expect(result.lock.holder).toBe("ana");
    expect((await locks.current("marketing"))?.holder).toBe("ana");
  });

  it("treats the holder asking again as carrying on, not as a new session", async () => {
    const { locks, advance } = await setup(1000);
    const first = await locks.acquire("marketing", "ana");
    advance(400);
    const again = await locks.acquire("marketing", "ana");
    expect(again.ok).toBe(true);
    expect(again.lock.since).toBe(first.lock.since);
    expect(again.lock.expiresAt).toBeGreaterThan(first.lock.expiresAt);
  });

  it("starts a new session when the holder comes back after its lock ran out", async () => {
    const { locks, advance } = await setup(1000);
    const first = await locks.acquire("marketing", "ana");
    advance(1500);
    const again = await locks.acquire("marketing", "ana");
    expect(again.ok).toBe(true);
    expect(again.lock.since).toBeGreaterThan(first.lock.since);
  });

  it("keeps floors apart", async () => {
    const { locks } = await setup(1000);
    await locks.acquire("marketing", "ana");
    expect((await locks.acquire("sales", "beto")).ok).toBe(true);
    expect((await locks.current("sales"))?.holder).toBe("beto");
  });

  describe("renew", () => {
    it("keeps the lock alive for as long as the editor keeps saying it is there", async () => {
      const { locks, advance } = await setup(1000);
      await locks.acquire("marketing", "ana");
      for (let i = 0; i < 5; i++) {
        advance(800);
        expect(await locks.renew("marketing", "ana")).toBe(true);
      }
      expect((await locks.current("marketing"))?.holder).toBe("ana");
    });

    it("refuses somebody who does not hold it", async () => {
      const { locks } = await setup(1000);
      await locks.acquire("marketing", "ana");
      expect(await locks.renew("marketing", "beto")).toBe(false);
      expect(await locks.renew("sales", "ana")).toBe(false);
    });

    it("cannot bring back a lock that already ran out", async () => {
      const { locks, advance } = await setup(1000);
      await locks.acquire("marketing", "ana");
      advance(1500);
      expect(await locks.renew("marketing", "ana")).toBe(false);
    });
  });

  describe("expiry", () => {
    it("lets go of a floor whose editor went silent (a crashed tab, a lost connection)", async () => {
      const { locks, advance } = await setup(1000);
      await locks.acquire("marketing", "ana");
      advance(1001);
      expect(await locks.current("marketing")).toBeNull();
    });

    it("gives the floor to somebody else once it has expired", async () => {
      const { locks, advance } = await setup(1000);
      await locks.acquire("marketing", "ana");
      advance(1500);
      const result = await locks.acquire("marketing", "beto");
      expect(result.ok).toBe(true);
      expect((await locks.current("marketing"))?.holder).toBe("beto");
    });

    it("is still held right up to the last moment", async () => {
      const { locks, advance } = await setup(1000);
      await locks.acquire("marketing", "ana");
      advance(999);
      expect((await locks.current("marketing"))?.holder).toBe("ana");
    });
  });

  describe("release", () => {
    it("opens the floor again", async () => {
      const { locks } = await setup(1000);
      await locks.acquire("marketing", "ana");
      expect(await locks.release("marketing", "ana")).toBe(true);
      expect(await locks.current("marketing")).toBeNull();
      expect((await locks.acquire("marketing", "beto")).ok).toBe(true);
    });

    it("never lets somebody else release it", async () => {
      const { locks } = await setup(1000);
      await locks.acquire("marketing", "ana");
      expect(await locks.release("marketing", "beto")).toBe(false);
      expect((await locks.current("marketing"))?.holder).toBe("ana");
    });

    it("is harmless to release a floor nobody holds", async () => {
      const { locks } = await setup(1000);
      expect(await locks.release("marketing", "ana")).toBe(false);
    });
  });
});

describe("floor locks, in Postgres only", () => {
  it("survives the server restarting: a new store over the same database sees the lock", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    let now = 1_000_000;
    await new PgFloorLocks(db, () => now, 1000).acquire("marketing", "ana");

    const afterRestart = new PgFloorLocks(db, () => now, 1000);
    expect((await afterRestart.current("marketing"))?.holder).toBe("ana");
    now += 1500;
    expect(await afterRestart.current("marketing")).toBeNull();
  });

  it("lets only one of two simultaneous requests take a free floor", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    const locks = new PgFloorLocks(db, () => 1_000_000, 1000);
    const results = await Promise.all([
      locks.acquire("marketing", "ana"),
      locks.acquire("marketing", "beto"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const winner = results.find((r) => r.ok)!.lock.holder;
    expect(results.find((r) => !r.ok)!.lock.holder).toBe(winner);
  });
});

describe("migrate", () => {
  it("can run again without doing anything twice", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await expect(migrate(db)).resolves.toBeUndefined();
  });
});
