import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { MIGRATIONS, migrate } from "./db/migrate.ts";
import { MemoryFloorStore, type FloorStore } from "./floorStore.ts";
import { PgFloorStore } from "./pgFloorStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = (now: () => number) => Promise<FloorStore>;

const memory: Factory = async (now) => new MemoryFloorStore(now);

const postgres: Factory = async (now) => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return new PgFloorStore(db, now);
};

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("floor store, %s", (_name, setup) => {
  it("starts with the main office, which is common", async () => {
    const store = await setup(() => 5000);
    expect(await store.list()).toEqual([
      { id: "office", name: "Main office", common: true, createdAt: 0 },
    ]);
    expect(await store.get("office")).toMatchObject({ common: true });
  });

  it("does not know a floor nobody made", async () => {
    const store = await setup(() => 0);
    expect(await store.get("hr")).toBeNull();
  });

  it("creates a floor that is not common, after the ones there are", async () => {
    let now = 1000;
    const store = await setup(() => now);
    const hr = await store.create({ id: "hr", name: "Human Resources" });
    expect(hr).toEqual({
      id: "hr",
      name: "Human Resources",
      common: false,
      createdAt: 1000,
    });
    now = 2000;
    await store.create({ id: "lab", name: "Lab" });
    expect((await store.list()).map((floor) => floor.id)).toEqual([
      "office",
      "hr",
      "lab",
    ]);
    expect(await store.get("hr")).toEqual(hr);
  });

  it("keeps floors made at the same moment in a steady order", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "b", name: "B" });
    await store.create({ id: "a", name: "A" });
    expect((await store.list()).map((floor) => floor.id)).toEqual([
      "office",
      "a",
      "b",
    ]);
  });

  it("does not make a second floor with the same id, nor change the first", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "Human Resources" });
    expect(await store.create({ id: "hr", name: "Other" })).toBeNull();
    expect(await store.create({ id: "office", name: "Other" })).toBeNull();
    expect((await store.get("hr"))?.name).toBe("Human Resources");
    expect((await store.get("office"))?.name).toBe("Main office");
  });

  it("renames a floor and keeps everything else", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "Human Resources" });
    expect(await store.rename("hr", "People")).toEqual({
      id: "hr",
      name: "People",
      common: false,
      createdAt: 1000,
    });
    expect((await store.get("hr"))?.name).toBe("People");
    expect((await store.rename("office", "Lobby"))?.common).toBe(true);
  });

  it("cannot rename a floor that does not exist", async () => {
    const store = await setup(() => 0);
    expect(await store.rename("nope", "X")).toBeNull();
  });

  it("archives a floor and brings it back, keeping everything else", async () => {
    let now = 1000;
    const store = await setup(() => now);
    await store.create({ id: "hr", name: "Human Resources" });
    await store.grant("hr", "user_ana");
    now = 5000;
    expect(await store.archive("hr")).toEqual({
      id: "hr",
      name: "Human Resources",
      common: false,
      createdAt: 1000,
      archivedAt: 5000,
    });
    expect(await store.get("hr")).toMatchObject({ archivedAt: 5000 });
    expect(
      (await store.list()).find((floor) => floor.id === "hr"),
    ).toMatchObject({ archivedAt: 5000 });
    // Nothing else is lost: the entry is still there for when it comes back
    expect(await store.floorsOf("user_ana")).toEqual(["hr"]);
    const back = await store.unarchive("hr");
    expect(back).toEqual({
      id: "hr",
      name: "Human Resources",
      common: false,
      createdAt: 1000,
    });
    expect(back).not.toHaveProperty("archivedAt");
    expect(await store.floorsOf("user_ana")).toEqual(["hr"]);
  });

  it("keeps the first moment of an archive when it is archived again", async () => {
    let now = 1000;
    const store = await setup(() => now);
    await store.create({ id: "hr", name: "HR" });
    now = 2000;
    await store.archive("hr");
    now = 3000;
    expect((await store.archive("hr"))?.archivedAt).toBe(2000);
  });

  it("cannot archive or bring back a floor that does not exist", async () => {
    const store = await setup(() => 0);
    expect(await store.archive("nope")).toBeNull();
    expect(await store.unarchive("nope")).toBeNull();
  });

  it("renames an archived floor and it stays archived", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "HR" });
    await store.archive("hr");
    expect(await store.rename("hr", "People")).toMatchObject({
      name: "People",
      archivedAt: 1000,
    });
  });

  it("gives and takes away an entry for a floor", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "Human Resources" });
    expect(await store.grant("hr", "user_ana")).toBe(true);
    expect(await store.floorsOf("user_ana")).toEqual(["hr"]);
    expect(await store.allGrants()).toEqual([
      { floor: "hr", userId: "user_ana" },
    ]);
    expect(await store.revoke("hr", "user_ana")).toBe(true);
    expect(await store.floorsOf("user_ana")).toEqual([]);
  });

  it("gives the same entry twice without a fuss, and keeps one", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "Human Resources" });
    expect(await store.grant("hr", "user_ana")).toBe(true);
    expect(await store.grant("hr", "user_ana")).toBe(true);
    expect(await store.allGrants()).toHaveLength(1);
  });

  it("cannot give an entry for a floor that does not exist", async () => {
    const store = await setup(() => 0);
    expect(await store.grant("nope", "user_ana")).toBe(false);
    expect(await store.allGrants()).toEqual([]);
  });

  it("says when there was no entry to take away", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "Human Resources" });
    expect(await store.revoke("hr", "user_ana")).toBe(false);
    expect(await store.revoke("nope", "user_ana")).toBe(false);
  });

  it("keeps entries apart by person and by floor", async () => {
    const store = await setup(() => 1000);
    await store.create({ id: "hr", name: "HR" });
    await store.create({ id: "lab", name: "Lab" });
    await store.grant("hr", "user_ana");
    await store.grant("lab", "user_ana");
    await store.grant("hr", "user_beto");
    expect(await store.floorsOf("user_ana")).toEqual(["hr", "lab"]);
    expect(await store.floorsOf("user_beto")).toEqual(["hr"]);
    await store.revoke("hr", "user_ana");
    expect(await store.floorsOf("user_ana")).toEqual(["lab"]);
    expect(await store.floorsOf("user_beto")).toEqual(["hr"]);
  });
});

describe("the floors migrations", () => {
  it("add the archive column once, empty for the floors there were", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await migrate(db);
    const { rows } = await db.query<{ archived_at: unknown }>(
      `SELECT archived_at FROM floors`,
    );
    expect(rows).toEqual([{ archived_at: null }]);
  });

  it("run again after the archive step was forgotten, without failing", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await db.query(
      `DELETE FROM schema_migrations WHERE id = '015_floor_archived_at'`,
    );
    await migrate(db);
    const { rows } = await db.query(`SELECT id FROM floors`);
    expect(rows).toHaveLength(1);
  });

  it("run twice change nothing, and the main office is seeded once", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await migrate(db);
    const { rows } = await db.query<{ id: string; common: boolean }>(
      `SELECT id, common FROM floors`,
    );
    expect(rows).toEqual([{ id: "office", common: true }]);
  });

  it("run again after the seed was already there, without failing or duplicating", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await db.query(
      `DELETE FROM schema_migrations
       WHERE id IN ('009_floors', '010_floors_seed_office', '011_floor_access')`,
    );
    await db.query(`DROP TABLE floor_access`);
    await migrate(db);
    const { rows } = await db.query(`SELECT id FROM floors`);
    expect(rows).toHaveLength(1);
  });

  it("are one statement per step, after the audit log", () => {
    const ids = MIGRATIONS.map((step) => step.id);
    expect(ids.indexOf("008_audit_log")).toBeLessThan(
      ids.indexOf("009_floors"),
    );
    for (const step of MIGRATIONS.filter((s) => s.id >= "009"))
      expect(step.sql.trim().replace(/;\s*$/, "")).not.toContain(";");
  });

  it("a Postgres store refuses an entry for a person on a floor twice and stays consistent after a restart", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    const first = new PgFloorStore(db, () => 1);
    await first.create({ id: "hr", name: "HR" });
    await first.grant("hr", "user_ana");
    const second = new PgFloorStore(db, () => 2);
    expect(await second.floorsOf("user_ana")).toEqual(["hr"]);
  });
});
