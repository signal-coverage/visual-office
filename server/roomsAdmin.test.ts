import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { handleRoomsAdmin } from "./roomsAdmin.ts";
import { MemoryUserStore } from "./userStore.ts";

const person = (
  roles: { admin?: boolean; headOf?: string[] },
  id: string,
  name: string,
): Actor => ({
  kind: "user",
  user: { id, email: null, name, isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const boss = person({ admin: true }, "user_boss", "Boss");
const hana = person({ headOf: ["hr"] }, "user_hana", "Hana");
const ana = person({}, "user_ana", "Ana");
const machine: Actor = { kind: "machine" };

describe("handleRoomsAdmin", () => {
  let floors: MemoryFloorStore;
  let users: MemoryUserStore;
  let recorded: AuditInput[];
  let changed: Array<[string, string]>;
  const call = (
    actor: Actor | undefined,
    method: string,
    path: string,
    body?: unknown,
  ) =>
    handleRoomsAdmin(
      { method, path, body, actor },
      {
        floors,
        users,
        audit: async (entry) => {
          recorded.push(entry);
        },
        onAccessChanged: (floor, userId) => changed.push([floor, userId]),
      },
    );

  beforeEach(async () => {
    floors = new MemoryFloorStore(() => 1000);
    users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    recorded = [];
    changed = [];
  });

  it("answers nothing for paths that are not its own", async () => {
    expect(await call(boss, "GET", "/health")).toBeNull();
    expect(await call(boss, "GET", "/admin/people")).toBeNull();
    expect(await call(boss, "POST", "/admin/floors/office/lock")).toBeNull();
    expect(await call(boss, "POST", "/admin/floors/office/heads")).toBeNull();
    expect(await call(boss, "GET", "/admin/floors/office")).toBeNull();
    expect(await call(boss, "GET", "/admin/floors/office/access")).toBeNull();
  });

  describe("the list of floors", () => {
    it("gives every floor with its name and whether it is common", async () => {
      const reply = await call(boss, "GET", "/admin/floors");
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({
        floors: [
          { id: "office", name: "Main office", common: true, createdAt: 0 },
        ],
      });
    });

    it("is for admins and the server's own tools, not for heads or members", async () => {
      expect((await call(machine, "GET", "/admin/floors"))?.status).toBe(200);
      expect((await call(hana, "GET", "/admin/floors"))?.status).toBe(403);
      expect((await call(ana, "GET", "/admin/floors"))?.status).toBe(403);
    });

    it("needs a caller, and a GET", async () => {
      expect((await call(undefined, "GET", "/admin/floors"))?.status).toBe(401);
      expect((await call(boss, "PUT", "/admin/floors"))?.status).toBe(405);
    });
  });

  describe("creating a floor", () => {
    it("makes the id from the name and stores a clean name", async () => {
      const reply = await call(boss, "POST", "/admin/floors", {
        name: "  Human   Resources ",
      });
      expect(reply?.status).toBe(201);
      expect(reply?.body).toEqual({
        floor: {
          id: "human-resources",
          name: "Human Resources",
          common: false,
          createdAt: 1000,
        },
      });
      expect(await floors.get("human-resources")).not.toBeNull();
    });

    it("takes an id when one is given", async () => {
      const reply = await call(boss, "POST", "/admin/floors", {
        name: "Human Resources",
        id: "hr",
      });
      expect(reply?.status).toBe(201);
      expect((reply?.body.floor as { id: string }).id).toBe("hr");
    });

    it("refuses a bad id without fixing it up", async () => {
      for (const id of ["HR", "h r", "admin", "../x", "", 3, "a".repeat(40)]) {
        const reply = await call(boss, "POST", "/admin/floors", {
          name: "People",
          id,
        });
        expect(reply?.status, JSON.stringify(id)).toBe(400);
      }
      expect(await floors.list()).toHaveLength(1);
    });

    it("refuses a missing, empty or unusable name", async () => {
      for (const body of [
        undefined,
        {},
        { name: "" },
        { name: "   " },
        { name: 3 },
        { name: "¡¡¡" },
        { name: "Admin" },
      ])
        expect(
          (await call(boss, "POST", "/admin/floors", body))?.status,
          JSON.stringify(body),
        ).toBe(400);
    });

    it("refuses an id that is taken and changes nothing", async () => {
      await call(boss, "POST", "/admin/floors", { name: "People", id: "hr" });
      const reply = await call(boss, "POST", "/admin/floors", {
        name: "Another",
        id: "hr",
      });
      expect(reply?.status).toBe(409);
      expect((await floors.get("hr"))?.name).toBe("People");
      expect(
        (await call(boss, "POST", "/admin/floors", { name: "Main office" }))
          ?.status,
      ).toBe(201);
    });

    it("never makes a floor common", async () => {
      await call(boss, "POST", "/admin/floors", {
        name: "People",
        common: true,
      });
      expect((await floors.get("people"))?.common).toBe(false);
    });

    it("is for admins and the server's own tools only", async () => {
      expect(
        (await call(hana, "POST", "/admin/floors", { name: "X Y" }))?.status,
      ).toBe(403);
      expect(
        (await call(ana, "POST", "/admin/floors", { name: "X Y" }))?.status,
      ).toBe(403);
      expect(
        (await call(machine, "POST", "/admin/floors", { name: "X Y" }))?.status,
      ).toBe(201);
      expect(
        (await call(undefined, "POST", "/admin/floors", { name: "X Z" }))
          ?.status,
      ).toBe(401);
    });

    it("notes who made it", async () => {
      await call(boss, "POST", "/admin/floors", { name: "People", id: "hr" });
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "floor.create",
          floor: "hr",
          detail: { name: "People" },
        },
      ]);
    });

    it("notes nothing when nothing was made", async () => {
      await call(boss, "POST", "/admin/floors", { name: "" });
      await call(boss, "POST", "/admin/floors", { name: "Dup", id: "office" });
      expect(recorded).toEqual([]);
    });
  });

  describe("renaming a floor", () => {
    beforeEach(async () => {
      await floors.create({ id: "hr", name: "People" });
    });

    it("changes the name and keeps the id", async () => {
      const reply = await call(boss, "POST", "/admin/floors/hr", {
        name: " Human  Resources ",
      });
      expect(reply?.status).toBe(200);
      expect(reply?.body).toMatchObject({
        floor: { id: "hr", name: "Human Resources" },
      });
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "floor.rename",
          floor: "hr",
          detail: { from: "People", to: "Human Resources" },
        },
      ]);
    });

    it("notes nothing when the name is the same", async () => {
      await call(boss, "POST", "/admin/floors/hr", { name: "People" });
      expect(recorded).toEqual([]);
    });

    it("refuses an unusable name, and a floor that does not exist", async () => {
      expect(
        (await call(boss, "POST", "/admin/floors/hr", { name: "  " }))?.status,
      ).toBe(400);
      expect(
        (await call(boss, "POST", "/admin/floors/nope", { name: "X Y" }))
          ?.status,
      ).toBe(404);
    });

    it("is for admins and the server's own tools only: the head of the floor cannot", async () => {
      expect(
        (await call(hana, "POST", "/admin/floors/hr", { name: "Mine" }))
          ?.status,
      ).toBe(403);
      expect(
        (await call(machine, "POST", "/admin/floors/hr", { name: "Mine" }))
          ?.status,
      ).toBe(200);
    });

    it("can rename the main office, which stays common", async () => {
      await call(boss, "POST", "/admin/floors/office", { name: "Lobby" });
      expect(await floors.get("office")).toMatchObject({
        name: "Lobby",
        common: true,
      });
    });
  });

  describe("who may enter a floor", () => {
    beforeEach(async () => {
      await floors.create({ id: "hr", name: "People" });
    });
    const grant = (actor: Actor | undefined, body: unknown, floor = "hr") =>
      call(actor, "POST", `/admin/floors/${floor}/access`, body);

    it("gives an entry and takes it away, and says what it did", async () => {
      expect(
        (await grant(boss, { userId: "user_ana", allowed: true }))?.body,
      ).toEqual({ floor: "hr", userId: "user_ana", allowed: true });
      expect(await floors.floorsOf("user_ana")).toEqual(["hr"]);
      expect(
        (await grant(boss, { userId: "user_ana", allowed: false }))?.body,
      ).toEqual({ floor: "hr", userId: "user_ana", allowed: false });
      expect(await floors.floorsOf("user_ana")).toEqual([]);
    });

    it("is for admins and the server's own tools only: a head cannot give entries", async () => {
      for (const actor of [hana, ana])
        expect(
          (await grant(actor, { userId: "user_ana", allowed: true }))?.status,
        ).toBe(403);
      expect(await floors.floorsOf("user_ana")).toEqual([]);
      expect(
        (await grant(machine, { userId: "user_ana", allowed: true }))?.status,
      ).toBe(200);
      expect(
        (await grant(undefined, { userId: "user_ana", allowed: true }))?.status,
      ).toBe(401);
    });

    it("refuses a body that does not say who and whether", async () => {
      for (const body of [
        undefined,
        {},
        { userId: "user_ana" },
        { allowed: true },
        { userId: "", allowed: true },
        { userId: "x".repeat(200), allowed: true },
        { userId: "user_ana", allowed: "yes" },
        { userId: 3, allowed: true },
      ])
        expect((await grant(boss, body))?.status, JSON.stringify(body)).toBe(
          400,
        );
    });

    it("refuses a floor that does not exist and somebody who never signed in", async () => {
      expect(
        (await grant(boss, { userId: "user_ana", allowed: true }, "nope"))
          ?.status,
      ).toBe(404);
      expect(
        (await grant(boss, { userId: "user_ghost", allowed: true }))?.status,
      ).toBe(404);
      expect(await floors.allGrants()).toEqual([]);
    });

    it("refuses an entry for a common floor: everybody may enter it already", async () => {
      expect(
        (await grant(boss, { userId: "user_ana", allowed: true }, "office"))
          ?.status,
      ).toBe(400);
      expect(await floors.allGrants()).toEqual([]);
    });

    it("notes who gave or took away an entry, once for each change", async () => {
      await grant(boss, { userId: "user_ana", allowed: true });
      await grant(boss, { userId: "user_ana", allowed: true });
      await grant(boss, { userId: "user_ana", allowed: false });
      await grant(boss, { userId: "user_ana", allowed: false });
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "floor.access",
          targetUserId: "user_ana",
          targetName: "Ana",
          floor: "hr",
          detail: { allowed: true },
        },
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "floor.access",
          targetUserId: "user_ana",
          targetName: "Ana",
          floor: "hr",
          detail: { allowed: false },
        },
      ]);
    });

    it("tells the rooms only when an entry was taken away", async () => {
      await grant(boss, { userId: "user_ana", allowed: true });
      expect(changed).toEqual([]);
      await grant(boss, { userId: "user_ana", allowed: false });
      expect(changed).toEqual([["hr", "user_ana"]]);
    });
  });

  it("says the database cannot be reached rather than guessing", async () => {
    const broken = {
      floors: {
        ...floors,
        list: async () => {
          throw new Error("down");
        },
      } as unknown as MemoryFloorStore,
      users,
    };
    const reply = await handleRoomsAdmin(
      { method: "GET", path: "/admin/floors", actor: machine },
      broken,
    );
    expect(reply?.status).toBe(503);
  });
});
