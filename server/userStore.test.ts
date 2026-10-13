import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { migrate } from "./db/migrate.ts";
import { MemoryUserStore, type UserStore } from "./userStore.ts";
import { PgUserStore } from "./pgUserStore.ts";

const databases: PGlite[] = [];
afterAll(async () => {
  await Promise.all(databases.map((db) => db.close()));
});

type Factory = () => Promise<UserStore>;

const memory: Factory = async () => new MemoryUserStore();

const postgres: Factory = async () => {
  const db = new PGlite();
  databases.push(db);
  await migrate(db);
  return new PgUserStore(db);
};

const ana = { id: "user_ana", email: "ana@example.com", name: "Ana Pérez" };
const beto = { id: "user_beto", email: null, name: "Beto" };

describe.each([
  ["in memory", memory],
  ["in Postgres", postgres],
] as Array<[string, Factory]>)("user store, %s", (_name, setup) => {
  it("does not know somebody who never signed in", async () => {
    const store = await setup();
    expect(await store.get("user_ana")).toBeNull();
  });

  it("remembers who signed in, as an ordinary member", async () => {
    const store = await setup();
    const user = await store.upsert(ana);
    expect(user).toEqual({ ...ana, isAdmin: false });
    expect(await store.get("user_ana")).toEqual({ ...ana, isAdmin: false });
  });

  it("keeps people without an email", async () => {
    const store = await setup();
    expect((await store.upsert(beto)).email).toBeNull();
  });

  it("updates the name and email when they changed in the sign-in service", async () => {
    const store = await setup();
    await store.upsert(ana);
    const again = await store.upsert({ ...ana, name: "Ana P.", email: null });
    expect(again).toMatchObject({ name: "Ana P.", email: null });
  });

  it("never loses the admin mark when somebody signs in again", async () => {
    const store = await setup();
    await store.upsert(ana);
    await store.setAdmin("user_ana", true);
    expect((await store.upsert(ana)).isAdmin).toBe(true);
  });

  it("makes somebody an admin, and takes it away", async () => {
    const store = await setup();
    await store.upsert(ana);
    expect(await store.setAdmin("user_ana", true)).toBe(true);
    expect((await store.rolesOf("user_ana")).admin).toBe(true);
    expect(await store.setAdmin("user_ana", false)).toBe(true);
    expect((await store.rolesOf("user_ana")).admin).toBe(false);
  });

  it("cannot make an admin of somebody who never signed in", async () => {
    const store = await setup();
    expect(await store.setAdmin("user_ghost", true)).toBe(false);
  });

  it("starts with no roles", async () => {
    const store = await setup();
    await store.upsert(ana);
    expect(await store.rolesOf("user_ana")).toEqual({
      admin: false,
      headOf: [],
    });
    expect(await store.rolesOf("user_ghost")).toEqual({
      admin: false,
      headOf: [],
    });
  });

  it("names somebody head of a floor, and several floors can have the same head", async () => {
    const store = await setup();
    await store.upsert(ana);
    expect(await store.addHead("marketing", "user_ana")).toBe(true);
    await store.addHead("sales", "user_ana");
    expect((await store.rolesOf("user_ana")).headOf.sort()).toEqual([
      "marketing",
      "sales",
    ]);
  });

  it("lets a floor have more than one head, and naming one twice changes nothing", async () => {
    const store = await setup();
    await store.upsert(ana);
    await store.upsert(beto);
    await store.addHead("marketing", "user_ana");
    await store.addHead("marketing", "user_ana");
    await store.addHead("marketing", "user_beto");
    expect((await store.headsOf("marketing")).sort()).toEqual([
      "user_ana",
      "user_beto",
    ]);
  });

  it("only names heads among people who signed in", async () => {
    const store = await setup();
    expect(await store.addHead("marketing", "user_ghost")).toBe(false);
    expect(await store.headsOf("marketing")).toEqual([]);
  });

  describe("the look somebody chose", () => {
    const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };

    it("is nothing until they choose one", async () => {
      const store = await setup();
      await store.upsert(ana);
      expect(await store.appearanceOf("user_ana")).toBeNull();
      expect(await store.appearanceOf("user_ghost")).toBeNull();
    });

    it("is remembered once they do, and the last choice replaces the one before", async () => {
      const store = await setup();
      await store.upsert(ana);
      expect(await store.setAppearance("user_ana", look)).toBe(true);
      expect(await store.appearanceOf("user_ana")).toEqual(look);
      await store.setAppearance("user_ana", { ...look, shirt: 7 });
      expect((await store.appearanceOf("user_ana"))?.shirt).toBe(7);
    });

    it("is kept apart for each person", async () => {
      const store = await setup();
      await store.upsert(ana);
      await store.upsert(beto);
      await store.setAppearance("user_ana", look);
      expect(await store.appearanceOf("user_beto")).toBeNull();
    });

    it("is not lost when their name or email is brought up to date", async () => {
      const store = await setup();
      await store.upsert(ana);
      await store.setAppearance("user_ana", look);
      await store.upsert({ ...ana, name: "Ana P." });
      expect(await store.appearanceOf("user_ana")).toEqual(look);
    });

    it("cannot be saved for somebody who never signed in", async () => {
      const store = await setup();
      expect(await store.setAppearance("user_ghost", look)).toBe(false);
    });
  });

  it("lists everybody who signed in, with what each may do, by name", async () => {
    const store = await setup();
    await store.upsert({
      id: "user_zoe",
      email: "zoe@example.com",
      name: "Zoe",
    });
    await store.upsert(ana);
    await store.upsert(beto);
    await store.setAdmin("user_ana", true);
    await store.addHead("marketing", "user_beto");
    await store.addHead("sales", "user_beto");
    expect(await store.list()).toEqual([
      { ...ana, isAdmin: true, headOf: [] },
      { ...beto, isAdmin: false, headOf: ["marketing", "sales"] },
      {
        id: "user_zoe",
        email: "zoe@example.com",
        name: "Zoe",
        isAdmin: false,
        headOf: [],
      },
    ]);
  });

  it("lists nobody before anybody signed in", async () => {
    expect(await (await setup()).list()).toEqual([]);
  });

  it("removes a head from one floor and leaves the others", async () => {
    const store = await setup();
    await store.upsert(ana);
    await store.addHead("marketing", "user_ana");
    await store.addHead("sales", "user_ana");
    expect(await store.removeHead("marketing", "user_ana")).toBe(true);
    expect((await store.rolesOf("user_ana")).headOf).toEqual(["sales"]);
    expect(await store.removeHead("marketing", "user_ana")).toBe(false);
  });
});
