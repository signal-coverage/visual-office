import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { MIGRATIONS, migrate } from "./db/migrate.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryGroupStore, type GroupStore } from "./groupStore.ts";
import { PgFloorStore } from "./pgFloorStore.ts";
import { PgGroupStore } from "./pgGroupStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

interface Setup {
  groups: GroupStore;
  makeFloor: (id: string) => Promise<void>;
}
type Factory = (now: () => number) => Promise<Setup>;

const memory: Factory = async (now) => {
  const floors = new MemoryFloorStore(now);
  return {
    groups: new MemoryGroupStore(now, floors),
    makeFloor: async (id) => {
      await floors.create({ id, name: id });
    },
  };
};

const postgres: Factory = async (now) => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  const floors = new PgFloorStore(db, now);
  return {
    groups: new PgGroupStore(db, now),
    makeFloor: async (id) => {
      await floors.create({ id, name: id });
    },
  };
};

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("group store, %s", (_name, setup) => {
  it("starts with no groups", async () => {
    const { groups } = await setup(() => 1);
    expect(await groups.list()).toEqual([]);
    expect(await groups.get("hr")).toBeNull();
  });

  it("creates a group, empty, after the ones there are", async () => {
    let now = 1000;
    const { groups } = await setup(() => now);
    const hr = await groups.create({ id: "hr", name: "Human Resources" });
    expect(hr).toEqual({
      id: "hr",
      name: "Human Resources",
      createdAt: 1000,
      floors: [],
      members: [],
    });
    now = 2000;
    await groups.create({ id: "ops", name: "Operations" });
    expect((await groups.list()).map((group) => group.id)).toEqual([
      "hr",
      "ops",
    ]);
    expect(await groups.get("hr")).toEqual(hr);
  });

  it("does not make a second group with the same id, nor change the first", async () => {
    const { groups } = await setup(() => 1);
    await groups.create({ id: "hr", name: "Human Resources" });
    expect(await groups.create({ id: "hr", name: "Other" })).toBeNull();
    expect((await groups.get("hr"))?.name).toBe("Human Resources");
  });

  it("renames a group and keeps its members and rooms", async () => {
    const { groups, makeFloor } = await setup(() => 1);
    await makeFloor("lab");
    await groups.create({ id: "hr", name: "People" });
    await groups.setMember("hr", "user_ana", true);
    await groups.setFloor("hr", "lab", true);
    expect(await groups.rename("hr", "Human Resources")).toEqual({
      id: "hr",
      name: "Human Resources",
      createdAt: 1,
      floors: ["lab"],
      members: ["user_ana"],
    });
    expect(await groups.rename("nope", "X")).toBeNull();
  });

  it("adds and removes members, keeping them sorted and once each", async () => {
    const { groups } = await setup(() => 1);
    await groups.create({ id: "hr", name: "HR" });
    expect(await groups.setMember("hr", "user_beto", true)).toBe(true);
    expect(await groups.setMember("hr", "user_ana", true)).toBe(true);
    expect(await groups.setMember("hr", "user_ana", true)).toBe(true);
    expect((await groups.get("hr"))?.members).toEqual([
      "user_ana",
      "user_beto",
    ]);
    expect(await groups.setMember("hr", "user_ana", false)).toBe(true);
    expect(await groups.setMember("hr", "user_ana", false)).toBe(true);
    expect((await groups.get("hr"))?.members).toEqual(["user_beto"]);
  });

  it("cannot add a member to a group that does not exist", async () => {
    const { groups } = await setup(() => 1);
    expect(await groups.setMember("nope", "user_ana", true)).toBe(false);
    expect(await groups.setMember("nope", "user_ana", false)).toBe(false);
  });

  it("gives and takes away rooms, once each and sorted", async () => {
    const { groups, makeFloor } = await setup(() => 1);
    await makeFloor("lab");
    await makeFloor("dev");
    await groups.create({ id: "hr", name: "HR" });
    expect(await groups.setFloor("hr", "lab", true)).toBe(true);
    expect(await groups.setFloor("hr", "dev", true)).toBe(true);
    expect(await groups.setFloor("hr", "dev", true)).toBe(true);
    expect((await groups.get("hr"))?.floors).toEqual(["dev", "lab"]);
    expect(await groups.setFloor("hr", "dev", false)).toBe(true);
    expect((await groups.get("hr"))?.floors).toEqual(["lab"]);
  });

  it("cannot give a room that does not exist, nor to a group that does not exist", async () => {
    const { groups, makeFloor } = await setup(() => 1);
    await makeFloor("lab");
    await groups.create({ id: "hr", name: "HR" });
    expect(await groups.setFloor("hr", "nope", true)).toBe(false);
    expect(await groups.setFloor("nope", "lab", true)).toBe(false);
    expect((await groups.get("hr"))?.floors).toEqual([]);
  });

  it("deletes a group with its members and rooms, and says when there was none", async () => {
    const { groups, makeFloor } = await setup(() => 1);
    await makeFloor("lab");
    await groups.create({ id: "hr", name: "HR" });
    await groups.setMember("hr", "user_ana", true);
    await groups.setFloor("hr", "lab", true);
    expect(await groups.remove("hr")).toBe(true);
    expect(await groups.get("hr")).toBeNull();
    expect(await groups.groupsOf("user_ana")).toEqual([]);
    expect(await groups.remove("hr")).toBe(false);
    // The id is free again, and the new group starts empty
    expect(await groups.create({ id: "hr", name: "HR" })).toMatchObject({
      floors: [],
      members: [],
    });
  });

  it("says which groups somebody is in, with their rooms", async () => {
    const { groups, makeFloor } = await setup(() => 1);
    await makeFloor("lab");
    await makeFloor("dev");
    await groups.create({ id: "hr", name: "HR" });
    await groups.create({ id: "ops", name: "Ops" });
    await groups.setMember("hr", "user_ana", true);
    await groups.setMember("ops", "user_ana", true);
    await groups.setMember("ops", "user_beto", true);
    await groups.setFloor("hr", "lab", true);
    await groups.setFloor("ops", "dev", true);
    expect(
      (await groups.groupsOf("user_ana")).map((group) => [
        group.id,
        group.floors,
      ]),
    ).toEqual([
      ["hr", ["lab"]],
      ["ops", ["dev"]],
    ]);
    expect((await groups.groupsOf("user_beto")).map((g) => g.id)).toEqual([
      "ops",
    ]);
    expect(await groups.groupsOf("user_nobody")).toEqual([]);
  });
});

describe("the groups migrations", () => {
  it("come after the archive column, one step each", () => {
    const ids = MIGRATIONS.map((step) => step.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "015_floor_archived_at",
        "016_groups",
        "017_group_members",
        "018_group_floors",
      ]),
    );
    expect(ids.indexOf("014_floor_layout_shell")).toBeLessThan(
      ids.indexOf("015_floor_archived_at"),
    );
  });

  it("run twice change nothing, and again after a step was forgotten", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    await migrate(db);
    await db.query(
      `DELETE FROM schema_migrations WHERE id IN ('016_groups', '017_group_members', '018_group_floors')`,
    );
    await migrate(db);
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM groups`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("a Postgres store keeps the groups after a restart", async () => {
    const db = new PGlite();
    databases.push(db);
    await migrate(db);
    const first = new PgGroupStore(db, () => 1);
    await first.create({ id: "hr", name: "HR" });
    await first.setMember("hr", "user_ana", true);
    const second = new PgGroupStore(db, () => 2);
    expect((await second.groupsOf("user_ana")).map((g) => g.id)).toEqual([
      "hr",
    ]);
  });
});
