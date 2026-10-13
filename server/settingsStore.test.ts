import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./db/migrate.ts";
import { PgSettingsStore } from "./pgSettingsStore.ts";
import { MemorySettingsStore, type SettingsStore } from "./settingsStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = () => Promise<SettingsStore>;

const memory: Factory = async () => new MemorySettingsStore();

const postgres: Factory = async () => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return new PgSettingsStore(db);
};

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("settings store, %s", (_name, setup) => {
  it("has nothing until something is set", async () => {
    const store = await setup();
    expect(await store.get("company_organization_id")).toBeNull();
  });

  it("remembers what was set", async () => {
    const store = await setup();
    await store.set("company_organization_id", "org_123");
    expect(await store.get("company_organization_id")).toBe("org_123");
  });

  it("replaces a value that was set before", async () => {
    const store = await setup();
    await store.set("k", "one");
    await store.set("k", "two");
    expect(await store.get("k")).toBe("two");
  });

  it("keeps settings apart", async () => {
    const store = await setup();
    await store.set("a", "1");
    await store.set("b", "2");
    expect(await store.get("a")).toBe("1");
    expect(await store.get("b")).toBe("2");
  });

  it("sets a value only when there is none, and says whether it did", async () => {
    const store = await setup();
    expect(await store.setIfAbsent("k", "first")).toBe(true);
    expect(await store.setIfAbsent("k", "second")).toBe(false);
    expect(await store.get("k")).toBe("first");
  });

  it("lets only one of two simultaneous setIfAbsent win", async () => {
    const store = await setup();
    const results = await Promise.all([
      store.setIfAbsent("k", "ana"),
      store.setIfAbsent("k", "beto"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(["ana", "beto"]).toContain(await store.get("k"));
  });
});

describe("settings store, in Postgres only", () => {
  it("survives the server restarting", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await new PgSettingsStore(db).set("k", "kept");
    expect(await new PgSettingsStore(db).get("k")).toBe("kept");
  });
});
