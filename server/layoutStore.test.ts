import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import type { Furniture } from "../shared/furniture.ts";
import { MIGRATIONS, migrate } from "./db/migrate.ts";
import { templateById } from "../shared/floorTemplates.ts";
import { MemoryLayoutStore, type LayoutStore } from "./layoutStore.ts";
import { PgLayoutStore } from "./pgLayoutStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = () => Promise<LayoutStore>;

const memory: Factory = async () => {
  let now = 1_000;
  return new MemoryLayoutStore(() => (now += 1));
};

const postgres: Factory = async () => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  let now = 1_000;
  return new PgLayoutStore(db, () => (now += 1));
};

const desk = (x: number): Furniture => ({
  kind: "desk",
  x,
  z: 2,
  rotation: 0,
});
const model = (name: string) => ({
  model: name,
  at: [3, 4] as [number, number],
  footprint: [1, 1] as [number, number],
});

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("layout store, %s", (_name, setup) => {
  it("has no layout for a floor until one is published", async () => {
    const store = await setup();
    expect(await store.current("marketing")).toBeNull();
  });

  it("publishes a layout as version 1, remembering who and when", async () => {
    const store = await setup();
    const stored = await store.publish(
      "marketing",
      { furniture: [desk(1)], models: [model("plant.glb")] },
      "ana",
    );
    expect(stored).toMatchObject({
      floor: "marketing",
      version: 1,
      author: "ana",
      furniture: [desk(1)],
      models: [model("plant.glb")],
    });
    expect(stored.createdAt).toBeGreaterThan(0);
    expect(await store.current("marketing")).toEqual(stored);
  });

  it("numbers each publish after the last, and the newest is the current one", async () => {
    const store = await setup();
    await store.publish(
      "marketing",
      { furniture: [desk(1)], models: [] },
      "ana",
    );
    const second = await store.publish(
      "marketing",
      { furniture: [desk(1), desk(2)], models: [] },
      "beto",
    );
    expect(second.version).toBe(2);
    expect((await store.current("marketing"))?.furniture).toHaveLength(2);
  });

  it("keeps every old version as it was published", async () => {
    const store = await setup();
    await store.publish(
      "marketing",
      { furniture: [desk(1)], models: [] },
      "ana",
    );
    await store.publish("marketing", { furniture: [], models: [] }, "beto");
    expect((await store.get("marketing", 1))?.furniture).toEqual([desk(1)]);
    expect(await store.get("marketing", 99)).toBeNull();
  });

  it("lists the history newest first, without the contents", async () => {
    const store = await setup();
    await store.publish(
      "marketing",
      { furniture: [desk(1)], models: [] },
      "ana",
    );
    await store.publish("marketing", { furniture: [], models: [] }, "beto");
    const history = await store.history("marketing");
    expect(history.map((v) => [v.version, v.author])).toEqual([
      [2, "beto"],
      [1, "ana"],
    ]);
    expect(history[0]).not.toHaveProperty("furniture");
  });

  it("limits the history when asked", async () => {
    const store = await setup();
    for (let i = 0; i < 5; i++)
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
    expect(await store.history("marketing", 2)).toHaveLength(2);
  });

  it("keeps floors apart, each with its own numbering", async () => {
    const store = await setup();
    await store.publish(
      "marketing",
      { furniture: [desk(1)], models: [] },
      "ana",
    );
    const sales = await store.publish(
      "sales",
      { furniture: [], models: [] },
      "beto",
    );
    expect(sales.version).toBe(1);
    expect((await store.current("marketing"))?.furniture).toEqual([desk(1)]);
  });

  it("does not let a later change to what was passed in alter what is stored", async () => {
    const store = await setup();
    const furniture = [desk(1)];
    await store.publish("marketing", { furniture, models: [] }, "ana");
    furniture.push(desk(2));
    expect((await store.current("marketing"))?.furniture).toEqual([desk(1)]);
  });

  describe("the shell", () => {
    const meeting = () => structuredClone(templateById("meeting")!.shell);

    it("keeps the shell a layout is published with, in every way it is read", async () => {
      const store = await setup();
      const shell = meeting();
      const stored = await store.publish(
        "marketing",
        { furniture: [desk(1)], models: [], shell },
        "ana",
      );
      expect(stored.shell).toEqual(shell);
      expect((await store.current("marketing"))?.shell).toEqual(shell);
      expect((await store.get("marketing", 1))?.shell).toEqual(shell);
      await store.mark("marketing", 1, "ana");
      expect((await store.lastGood("marketing"))?.shell).toEqual(shell);
    });

    it("has no shell for a layout published without one, not even an empty one", async () => {
      const store = await setup();
      const stored = await store.publish(
        "marketing",
        { furniture: [], models: [] },
        "ana",
      );
      expect(stored).not.toHaveProperty("shell");
      expect(await store.current("marketing")).not.toHaveProperty("shell");
      expect(await store.get("marketing", 1)).not.toHaveProperty("shell");
    });

    it("keeps each version's own shell", async () => {
      const store = await setup();
      await store.publish(
        "marketing",
        { furniture: [], models: [], shell: meeting() },
        "ana",
      );
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      expect((await store.get("marketing", 1))?.shell).toEqual(meeting());
      expect(await store.get("marketing", 2)).not.toHaveProperty("shell");
    });

    it("cannot be changed through what was passed in or what was returned", async () => {
      const store = await setup();
      const shell = meeting();
      const stored = await store.publish(
        "marketing",
        { furniture: [], models: [], shell },
        "ana",
      );
      shell.width = 99;
      stored.shell!.depth = 99;
      expect((await store.current("marketing"))?.shell?.width).toBe(36);
      expect((await store.current("marketing"))?.shell?.depth).toBe(20);
    });

    it("does not show the shell in the history, which has no contents", async () => {
      const store = await setup();
      await store.publish(
        "marketing",
        { furniture: [], models: [], shell: meeting() },
        "ana",
      );
      expect((await store.history("marketing"))[0]).not.toHaveProperty("shell");
    });
  });

  describe("known-good versions", () => {
    it("lists versions as not good until somebody marks them", async () => {
      const store = await setup();
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      expect((await store.history("marketing"))[0].good).toBe(false);
      expect(await store.lastGood("marketing")).toBeNull();
    });

    it("marks a version as good, and says so in the history", async () => {
      const store = await setup();
      await store.publish(
        "marketing",
        { furniture: [desk(1)], models: [] },
        "ana",
      );
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      expect(await store.mark("marketing", 1, "ana")).toBe(true);
      const history = await store.history("marketing");
      expect(history.map((v) => [v.version, v.good])).toEqual([
        [2, false],
        [1, true],
      ]);
    });

    it("finds the newest version marked as good, whatever came after", async () => {
      const store = await setup();
      await store.publish(
        "marketing",
        { furniture: [desk(1)], models: [] },
        "ana",
      );
      await store.publish(
        "marketing",
        { furniture: [desk(2)], models: [] },
        "ana",
      );
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      await store.mark("marketing", 1, "ana");
      await store.mark("marketing", 2, "ana");
      expect((await store.lastGood("marketing"))?.version).toBe(2);
      expect((await store.lastGood("marketing"))?.furniture).toEqual([desk(2)]);
    });

    it("refuses to mark a version that does not exist, or of another floor", async () => {
      const store = await setup();
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      expect(await store.mark("marketing", 5, "ana")).toBe(false);
      expect(await store.mark("sales", 1, "ana")).toBe(false);
    });

    it("is harmless to mark the same version twice", async () => {
      const store = await setup();
      await store.publish("marketing", { furniture: [], models: [] }, "ana");
      await store.mark("marketing", 1, "ana");
      expect(await store.mark("marketing", 1, "beto")).toBe(true);
      expect((await store.history("marketing"))[0].good).toBe(true);
    });
  });
});

describe("layout store, in Postgres only", () => {
  it("survives the server restarting", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await new PgLayoutStore(db).publish(
      "marketing",
      { furniture: [desk(1)], models: [] },
      "ana",
    );
    const after = new PgLayoutStore(db);
    expect((await after.current("marketing"))?.version).toBe(1);
  });

  it("gives two simultaneous publishes different versions, losing neither", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    const store = new PgLayoutStore(db);
    const [a, b] = await Promise.all([
      store.publish("marketing", { furniture: [desk(1)], models: [] }, "ana"),
      store.publish("marketing", { furniture: [desk(2)], models: [] }, "beto"),
    ]);
    expect([a.version, b.version].sort()).toEqual([1, 2]);
  });
});

describe("the shell migration", () => {
  it("comes after the content steps, as its own step", () => {
    const ids = MIGRATIONS.map((step) => step.id);
    expect(ids.indexOf("014_floor_layout_shell")).toBe(
      ids.indexOf("013_floor_content_floor_index") + 1,
    );
  });

  it("run twice change nothing, and run again when the column is there", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await migrate(db);
    await db.query(
      `DELETE FROM schema_migrations WHERE id = '014_floor_layout_shell'`,
    );
    await migrate(db);
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'floor_layouts' AND column_name = 'shell'`,
    );
    expect(rows).toHaveLength(1);
  });

  it("leaves a layout stored before it as it was: no shell, so the default one", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    // The table as it was before the step
    await db.query(`ALTER TABLE floor_layouts DROP COLUMN shell`);
    await db.query(
      `DELETE FROM schema_migrations WHERE id = '014_floor_layout_shell'`,
    );
    await db.query(
      `INSERT INTO floor_layouts (floor, version, author, created_at, furniture, models)
       VALUES ('office', 1, 'ana', 5, '[]'::jsonb, '[]'::jsonb)`,
    );
    await migrate(db);
    const store = new PgLayoutStore(db);
    const old = await store.current("office");
    expect(old).toMatchObject({ floor: "office", version: 1, author: "ana" });
    expect(old).not.toHaveProperty("shell");
    // And a new version can carry one
    const next = await store.publish(
      "office",
      { furniture: [], models: [], shell: templateById("open")!.shell },
      "ana",
    );
    expect(next.version).toBe(2);
    expect(next.shell?.width).toBe(24);
  });
});
