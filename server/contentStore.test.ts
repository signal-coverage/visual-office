import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { CONTENT_LIMITS, type ContentFields } from "../shared/content.ts";
import { MemoryContentStore, type ContentStore } from "./contentStore.ts";
import { MIGRATIONS, migrate } from "./db/migrate.ts";
import { PgContentStore } from "./pgContentStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = (now: () => number) => Promise<ContentStore>;

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};

const memory: Factory = async (now) => new MemoryContentStore(now, counter());

const postgres: Factory = async (now) => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return new PgContentStore(db, now, counter());
};

const fields = (overrides: Partial<ContentFields> = {}): ContentFields => ({
  title: "Handbook",
  author: "Ana",
  body: "Chapter one",
  link: null,
  pinned: false,
  ...overrides,
});

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("content store, %s", (_name, setup) => {
  it("starts empty", async () => {
    const store = await setup(() => 1);
    expect(await store.list("office")).toEqual([]);
    expect(await store.get("nope")).toBeNull();
  });

  it("creates an item and reads it back, with its floor, kind and times", async () => {
    const store = await setup(() => 1000);
    const made = await store.create(
      "office",
      "book",
      fields({ link: "https://example.com/" }),
    );
    expect(made).toEqual({
      ok: true,
      item: {
        id: "id1",
        floor: "office",
        kind: "book",
        title: "Handbook",
        author: "Ana",
        body: "Chapter one",
        link: "https://example.com/",
        pinned: false,
        position: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
    });
    expect(await store.get("id1")).toEqual(made.ok && made.item);
  });

  it("lists the items of one floor and one kind, in the order they were made", async () => {
    let now = 1;
    const store = await setup(() => now++);
    await store.create("office", "book", fields({ title: "B1" }));
    await store.create("hr", "book", fields({ title: "Other floor" }));
    await store.create("office", "announcement", fields({ title: "A1" }));
    await store.create("office", "book", fields({ title: "B2" }));
    expect(
      (await store.list("office", "book")).map((item) => item.title),
    ).toEqual(["B1", "B2"]);
    expect(
      (await store.list("office", "announcement")).map((item) => item.title),
    ).toEqual(["A1"]);
    expect(
      (await store.list("office")).map((item) => item.title).sort(),
    ).toEqual(["A1", "B1", "B2"]);
    expect((await store.list("hr")).map((item) => item.title)).toEqual([
      "Other floor",
    ]);
  });

  it("lists the pinned first", async () => {
    let now = 1;
    const store = await setup(() => now++);
    await store.create("office", "announcement", fields({ title: "plain" }));
    await store.create(
      "office",
      "announcement",
      fields({ title: "pinned", pinned: true }),
    );
    expect(
      (await store.list("office", "announcement")).map((item) => item.title),
    ).toEqual(["pinned", "plain"]);
  });

  it("changes the words of an item, keeps its floor, kind and creation, and moves its update time", async () => {
    let now = 1000;
    const store = await setup(() => now);
    await store.create("office", "book", fields());
    now = 5000;
    const changed = await store.update(
      "id1",
      fields({ title: "New", body: "", link: "https://example.com/x" }),
    );
    expect(changed).toMatchObject({
      id: "id1",
      floor: "office",
      kind: "book",
      title: "New",
      body: "",
      link: "https://example.com/x",
      createdAt: 1000,
      updatedAt: 5000,
    });
    expect(await store.get("id1")).toEqual(changed);
  });

  it("cannot change an item that is not there", async () => {
    const store = await setup(() => 1);
    expect(await store.update("nope", fields())).toBeNull();
  });

  it("removes an item and says what it was", async () => {
    const store = await setup(() => 1);
    await store.create("office", "book", fields());
    expect(await store.remove("id1")).toMatchObject({ title: "Handbook" });
    expect(await store.get("id1")).toBeNull();
    expect(await store.remove("id1")).toBeNull();
  });

  it("allows 50 books and 50 announcements on a floor, and refuses the 51st of each", async () => {
    const store = await setup(() => 1);
    for (let i = 0; i < CONTENT_LIMITS.perKind; i++) {
      expect(
        await store.create("office", "book", fields({ title: `B${i}` })),
      ).toMatchObject({ ok: true });
    }
    expect(await store.create("office", "book", fields())).toEqual({
      ok: false,
      reason: "limit",
    });
    // The other kind and the other floors have their own room
    expect(
      await store.create("office", "announcement", fields()),
    ).toMatchObject({ ok: true });
    expect(await store.create("hr", "book", fields())).toMatchObject({
      ok: true,
    });
    expect(await store.list("office", "book")).toHaveLength(50);
  });

  it("has room again after one is removed", async () => {
    const store = await setup(() => 1);
    for (let i = 0; i < CONTENT_LIMITS.perKind; i++)
      await store.create("office", "book", fields());
    await store.remove("id1");
    expect(await store.create("office", "book", fields())).toMatchObject({
      ok: true,
    });
  });

  it("does not hand out a position twice, even after a removal", async () => {
    const store = await setup(() => 1);
    await store.create("office", "book", fields({ title: "one" }));
    await store.create("office", "book", fields({ title: "two" }));
    await store.remove("id1");
    const third = await store.create("office", "book", fields({ title: "3" }));
    expect(third.ok && third.item.position).toBe(3);
  });

  it("keeps text exactly as given: nothing is read as HTML", async () => {
    const store = await setup(() => 1);
    const body = '<img src=x onerror="alert(1)">\n**bold** & more';
    await store.create("office", "book", fields({ body }));
    expect((await store.get("id1"))?.body).toBe(body);
  });
});

describe("the content migrations", () => {
  it("run twice change nothing", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await migrate(db);
    const { rows } = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM floor_content`,
    );
    expect(rows[0].count).toBe(0);
  });

  it("run again when the table is already there, without failing", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await db.query(
      `DELETE FROM schema_migrations WHERE id LIKE '012%' OR id LIKE '013%'`,
    );
    await migrate(db);
    const { rows } = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'floor_content'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("come after the floor access step, one statement each", () => {
    const ids = MIGRATIONS.map((step) => step.id);
    expect(ids.indexOf("012_floor_content")).toBe(
      ids.indexOf("011_floor_access") + 1,
    );
    expect(ids).toContain("013_floor_content_floor_index");
  });

  it("only lets the two kinds in", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await expect(
      db.query(
        `INSERT INTO floor_content (id, floor, kind, title, position, created_at, updated_at)
         VALUES ('x', 'office', 'poster', 't', 1, 1, 1)`,
      ),
    ).rejects.toThrow();
  });

  it("a Postgres store keeps its items across a restart", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await new PgContentStore(db, () => 1, counter()).create(
      "office",
      "book",
      fields(),
    );
    const again = new PgContentStore(db, () => 2, counter());
    expect((await again.list("office")).map((item) => item.title)).toEqual([
      "Handbook",
    ]);
  });
});
