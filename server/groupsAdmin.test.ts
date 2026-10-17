import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_GROUP_FLOORS,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS,
} from "../shared/groups.ts";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { handleGroupsAdmin } from "./groupsAdmin.ts";
import { MemoryGroupStore } from "./groupStore.ts";
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

interface Body {
  error?: string;
  [key: string]: unknown;
}

describe("handleGroupsAdmin", () => {
  let floors: MemoryFloorStore;
  let groups: MemoryGroupStore;
  let users: MemoryUserStore;
  let recorded: AuditInput[];
  let changed: Array<[string, string]>;

  const call = async (
    actor: Actor | undefined,
    method: string,
    path: string,
    body?: unknown,
  ) => {
    const reply = await handleGroupsAdmin(
      { method, path, body, actor },
      {
        groups,
        floors,
        users,
        audit: async (entry) => {
          recorded.push(entry);
        },
        onAccessChanged: (floor, userId) => changed.push([floor, userId]),
      },
    );
    return reply && { status: reply.status, body: reply.body as Body };
  };
  const make = (name = "Human Resources") =>
    call(boss, "POST", "/admin/groups", { name });

  beforeEach(async () => {
    floors = new MemoryFloorStore(() => 1000);
    groups = new MemoryGroupStore(() => 2000, floors);
    users = new MemoryUserStore();
    for (const [id, name] of [
      ["user_ana", "Ana"],
      ["user_beto", "Beto"],
      ["user_cris", "Cris"],
    ])
      await users.upsert({ id, email: null, name });
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "lab", name: "Lab" });
    recorded = [];
    changed = [];
  });

  it("answers nothing for paths that are not its own", async () => {
    expect(await call(boss, "GET", "/health")).toBeNull();
    expect(await call(boss, "GET", "/admin/people")).toBeNull();
    expect(await call(boss, "GET", "/admin/floors")).toBeNull();
    expect(await call(boss, "POST", "/admin/groupsx")).toBeNull();
    expect(await call(boss, "POST", "/admin/groups/a/b/c")).toBeNull();
    expect(await call(boss, "POST", "/admin/groups/hr/other")).toBeNull();
  });

  describe("who may", () => {
    it("is for admins and the server's own tools, nobody else: not the head of a floor", async () => {
      expect((await call(boss, "GET", "/admin/groups"))?.status).toBe(200);
      expect((await call(machine, "GET", "/admin/groups"))?.status).toBe(200);
      expect((await call(hana, "GET", "/admin/groups"))?.status).toBe(403);
      expect((await call(ana, "GET", "/admin/groups"))?.status).toBe(403);
      for (const actor of [hana, ana])
        for (const path of [
          "/admin/groups",
          "/admin/groups/hr",
          "/admin/groups/hr/delete",
          "/admin/groups/hr/members",
          "/admin/groups/hr/floors",
        ])
          expect((await call(actor, "POST", path, {}))?.status, path).toBe(403);
    });

    it("needs a caller", async () => {
      expect((await call(undefined, "GET", "/admin/groups"))?.status).toBe(401);
    });

    it("changes nothing for somebody who may not", async () => {
      await call(hana, "POST", "/admin/groups", { name: "Mine" });
      expect(await groups.list()).toEqual([]);
      expect(recorded).toEqual([]);
    });
  });

  describe("the list", () => {
    it("is empty at first, and says the limits", async () => {
      const reply = await call(boss, "GET", "/admin/groups");
      expect(reply?.body).toEqual({
        groups: [],
        limits: { groups: 30, members: 200, floors: 40 },
      });
    });

    it("gives every group with its rooms and members", async () => {
      await make();
      await call(boss, "POST", "/admin/groups/human-resources/floors", {
        floor: "hr",
        allowed: true,
      });
      await call(boss, "POST", "/admin/groups/human-resources/members", {
        userId: "user_ana",
        member: true,
      });
      const reply = await call(boss, "GET", "/admin/groups");
      expect(reply?.body.groups).toEqual([
        {
          id: "human-resources",
          name: "Human Resources",
          createdAt: 2000,
          floors: ["hr"],
          members: ["user_ana"],
        },
      ]);
    });

    it("answers only GET and POST", async () => {
      expect((await call(boss, "PUT", "/admin/groups"))?.status).toBe(405);
      expect((await call(boss, "DELETE", "/admin/groups"))?.status).toBe(405);
    });
  });

  describe("making a group", () => {
    it("makes the id from the name and keeps a clean name, noting it", async () => {
      const reply = await call(boss, "POST", "/admin/groups", {
        name: "  Human   Resources ",
      });
      expect(reply?.status).toBe(201);
      expect(reply?.body).toEqual({
        group: {
          id: "human-resources",
          name: "Human Resources",
          createdAt: 2000,
          floors: [],
          members: [],
        },
      });
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "group.create",
          detail: { group: "human-resources", name: "Human Resources" },
        },
      ]);
    });

    it("refuses a missing, empty or unusable name, and unknown fields", async () => {
      for (const body of [
        undefined,
        {},
        { name: "" },
        { name: "   " },
        { name: 3 },
        { name: "¡¡¡" },
        { name: "Ok", extra: true },
        [],
        "Ok",
      ])
        expect(
          (await call(boss, "POST", "/admin/groups", body))?.status,
          JSON.stringify(body),
        ).toBe(400);
      expect(await groups.list()).toEqual([]);
      expect(recorded).toEqual([]);
    });

    it("refuses a name that makes the id of another group, or is another group's name", async () => {
      await make("Human Resources");
      expect((await make("human-resources"))?.status).toBe(409);
      expect((await make("HUMAN RESOURCES"))?.status).toBe(409);
      expect(await groups.list()).toHaveLength(1);
    });

    it("refuses the 31st group", async () => {
      for (let n = 1; n <= MAX_GROUPS; n++)
        expect((await make(`Group ${n}`))?.status).toBe(201);
      const reply = await make("One more");
      expect(reply?.status).toBe(409);
      expect(reply?.body.error).toMatch(/30/);
      expect(await groups.list()).toHaveLength(MAX_GROUPS);
    });
  });

  describe("renaming a group", () => {
    beforeEach(async () => {
      await make("People");
      recorded.length = 0;
    });

    it("changes the name and keeps the id, members and rooms, noting it", async () => {
      await call(boss, "POST", "/admin/groups/people/members", {
        userId: "user_ana",
        member: true,
      });
      recorded.length = 0;
      const reply = await call(boss, "POST", "/admin/groups/people", {
        name: " Human  Resources ",
      });
      expect(reply?.status).toBe(200);
      expect(reply?.body).toMatchObject({
        group: {
          id: "people",
          name: "Human Resources",
          members: ["user_ana"],
        },
      });
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "group.rename",
          detail: { group: "people", from: "People", to: "Human Resources" },
        },
      ]);
    });

    it("notes nothing when the name is the same", async () => {
      expect(
        (await call(boss, "POST", "/admin/groups/people", { name: "People" }))
          ?.status,
      ).toBe(200);
      expect(recorded).toEqual([]);
    });

    it("refuses an unusable name, another group's name, and a group that does not exist", async () => {
      await make("Ops");
      recorded.length = 0;
      for (const body of [{}, { name: "  " }, { name: 4 }, { name: "A", x: 1 }])
        expect(
          (await call(boss, "POST", "/admin/groups/people", body))?.status,
        ).toBe(400);
      expect(
        (await call(boss, "POST", "/admin/groups/people", { name: "ops" }))
          ?.status,
      ).toBe(409);
      expect(
        (await call(boss, "POST", "/admin/groups/nope", { name: "X Y" }))
          ?.status,
      ).toBe(404);
      expect(recorded).toEqual([]);
    });
  });

  describe("members", () => {
    const path = "/admin/groups/people/members";
    const set = (userId: unknown, member: unknown, actor: Actor = boss) =>
      call(actor, "POST", path, { userId, member });

    beforeEach(async () => {
      await make("People");
      await call(boss, "POST", "/admin/groups/people/floors", {
        floor: "hr",
        allowed: true,
      });
      await call(boss, "POST", "/admin/groups/people/floors", {
        floor: "lab",
        allowed: true,
      });
      recorded.length = 0;
      changed.length = 0;
    });

    it("adds a person, noting who and the group, and tells nobody (nobody lost anything)", async () => {
      const reply = await set("user_ana", true);
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({
        group: "people",
        userId: "user_ana",
        member: true,
      });
      expect((await groups.get("people"))?.members).toEqual(["user_ana"]);
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "group.member",
          targetUserId: "user_ana",
          targetName: "Ana",
          detail: { group: "people", name: "People", member: true },
        },
      ]);
      expect(changed).toEqual([]);
    });

    it("removes a person and tells the rooms of the group, so they are moved out if that was their way in", async () => {
      await set("user_ana", true);
      recorded.length = 0;
      expect((await set("user_ana", false))?.status).toBe(200);
      expect((await groups.get("people"))?.members).toEqual([]);
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({
        action: "group.member",
        detail: { member: false },
      });
      expect(changed).toEqual([
        ["hr", "user_ana"],
        ["lab", "user_ana"],
      ]);
    });

    it("notes and tells nothing when it was already so", async () => {
      await set("user_ana", true);
      recorded.length = 0;
      await set("user_ana", true);
      await set("user_beto", false);
      expect(recorded).toEqual([]);
      expect(changed).toEqual([]);
    });

    it("says nobody has that id when they never signed in, and there is no such group", async () => {
      expect((await set("user_nobody", true))?.status).toBe(404);
      expect(
        (
          await call(boss, "POST", "/admin/groups/nope/members", {
            userId: "user_ana",
            member: true,
          })
        )?.status,
      ).toBe(404);
    });

    it("needs a person (text, up to 128 characters) and a real boolean", async () => {
      for (const [userId, member] of [
        [undefined, true],
        ["", true],
        [3, true],
        ["x".repeat(129), true],
        ["user_ana", "true"],
        ["user_ana", 1],
        ["user_ana", undefined],
      ])
        expect((await set(userId, member))?.status, String(userId)).toBe(400);
      expect(
        (
          await call(boss, "POST", path, {
            userId: "user_ana",
            member: true,
            x: 1,
          })
        )?.status,
      ).toBe(400);
      expect(await call(boss, "POST", path, "nope")).toMatchObject({
        status: 400,
      });
      expect(recorded).toEqual([]);
    });

    it("refuses the 201st member, and still accepts one who is already in", async () => {
      for (let n = 0; n < MAX_GROUP_MEMBERS; n++)
        await groups.setMember("people", `user_${n}`, true);
      const reply = await set("user_ana", true);
      expect(reply?.status).toBe(409);
      expect(reply?.body.error).toMatch(/200/);
      await users.upsert({ id: "user_0", email: null, name: "Zero" });
      expect((await set("user_0", true))?.status).toBe(200);
      expect((await groups.get("people"))?.members).toHaveLength(
        MAX_GROUP_MEMBERS,
      );
    });

    it("answers only POST", async () => {
      expect((await call(boss, "GET", path))?.status).toBe(405);
    });
  });

  describe("rooms of a group", () => {
    const path = "/admin/groups/people/floors";
    const set = (floor: unknown, allowed: unknown, actor: Actor = boss) =>
      call(actor, "POST", path, { floor, allowed });

    beforeEach(async () => {
      await make("People");
      await groups.setMember("people", "user_ana", true);
      await groups.setMember("people", "user_beto", true);
      recorded.length = 0;
      changed.length = 0;
    });

    it("gives a room, noting the room and the group, and tells nobody", async () => {
      const reply = await set("hr", true);
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({
        group: "people",
        floor: "hr",
        allowed: true,
      });
      expect((await groups.get("people"))?.floors).toEqual(["hr"]);
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "group.floor",
          floor: "hr",
          detail: { group: "people", name: "People", allowed: true },
        },
      ]);
      expect(changed).toEqual([]);
    });

    it("takes a room away and tells the rooms for every member, so they are moved out if that was their way in", async () => {
      await set("hr", true);
      recorded.length = 0;
      expect((await set("hr", false))?.status).toBe(200);
      expect((await groups.get("people"))?.floors).toEqual([]);
      expect(recorded).toHaveLength(1);
      expect(changed).toEqual([
        ["hr", "user_ana"],
        ["hr", "user_beto"],
      ]);
    });

    it("notes and tells nothing when it was already so", async () => {
      await set("hr", true);
      recorded.length = 0;
      await set("hr", true);
      await set("lab", false);
      expect(recorded).toEqual([]);
      expect(changed).toEqual([]);
    });

    it("refuses a room that does not exist, and a common room, which everybody enters anyway", async () => {
      expect((await set("nope", true))?.status).toBe(404);
      const reply = await set("office", true);
      expect(reply?.status).toBe(400);
      expect(reply?.body.error).toMatch(/common/i);
      expect((await groups.get("people"))?.floors).toEqual([]);
    });

    it("keeps a room that is archived, and lets it be taken away", async () => {
      await set("hr", true);
      await floors.archive("hr");
      expect((await groups.get("people"))?.floors).toEqual(["hr"]);
      expect((await set("hr", false))?.status).toBe(200);
    });

    it("needs a room (text) and a real boolean, and a group that exists", async () => {
      for (const [floor, allowed] of [
        [undefined, true],
        ["", true],
        [3, true],
        ["hr", "yes"],
        ["hr", undefined],
      ])
        expect((await set(floor, allowed))?.status, String(floor)).toBe(400);
      expect(
        (
          await call(boss, "POST", "/admin/groups/nope/floors", {
            floor: "hr",
            allowed: true,
          })
        )?.status,
      ).toBe(404);
    });

    it("refuses the 41st room", async () => {
      for (let n = 0; n < MAX_GROUP_FLOORS; n++) {
        await floors.create({ id: `room-${n}`, name: `Room ${n}` });
        await groups.setFloor("people", `room-${n}`, true);
      }
      const reply = await set("hr", true);
      expect(reply?.status).toBe(409);
      expect(reply?.body.error).toMatch(/40/);
    });

    it("answers only POST", async () => {
      expect((await call(boss, "GET", path))?.status).toBe(405);
    });
  });

  describe("deleting a group", () => {
    const path = "/admin/groups/people/delete";

    beforeEach(async () => {
      await make("People");
      await groups.setMember("people", "user_ana", true);
      await groups.setMember("people", "user_beto", true);
      await groups.setFloor("people", "hr", true);
      await groups.setFloor("people", "lab", true);
      recorded.length = 0;
      changed.length = 0;
    });

    it("deletes it with its members and rooms, noting it, and tells the rooms for everybody who could enter through it", async () => {
      const reply = await call(boss, "POST", path, {});
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({ group: "people", deleted: true });
      expect(await groups.get("people")).toBeNull();
      expect(recorded).toEqual([
        {
          actorUserId: "user_boss",
          actorName: "Boss",
          action: "group.delete",
          detail: { group: "people", name: "People" },
        },
      ]);
      expect(changed).toEqual([
        ["hr", "user_ana"],
        ["hr", "user_beto"],
        ["lab", "user_ana"],
        ["lab", "user_beto"],
      ]);
    });

    it("says there is no such group, and notes nothing", async () => {
      await call(boss, "POST", path, {});
      recorded.length = 0;
      expect((await call(boss, "POST", path, {}))?.status).toBe(404);
      expect(recorded).toEqual([]);
    });

    it("answers only POST", async () => {
      expect((await call(boss, "GET", path))?.status).toBe(405);
    });
  });

  it("says the database cannot be reached rather than guessing", async () => {
    groups.list = async () => {
      throw new Error("down");
    };
    expect((await call(boss, "GET", "/admin/groups"))?.status).toBe(503);
  });

  it("goes on when telling the rooms fails: the change is made", async () => {
    await make("People");
    await groups.setMember("people", "user_ana", true);
    await groups.setFloor("people", "hr", true);
    const reply = await handleGroupsAdmin(
      {
        method: "POST",
        path: "/admin/groups/people/members",
        body: { userId: "user_ana", member: false },
        actor: boss,
      },
      {
        groups,
        floors,
        users,
        onAccessChanged: () => {
          throw new Error("a room broke");
        },
      },
    );
    expect(reply?.status).toBe(200);
    expect((await groups.get("people"))?.members).toEqual([]);
  });
});
