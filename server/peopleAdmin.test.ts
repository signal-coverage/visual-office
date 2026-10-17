import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { MemoryBanStore } from "./banStore.ts";
import { handlePeopleAdmin } from "./peopleAdmin.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryGroupStore } from "./groupStore.ts";
import { MemoryUserStore } from "./userStore.ts";

const person = (
  roles: { admin?: boolean; headOf?: string[] },
  id = "user_boss",
): Actor => ({
  kind: "user",
  user: { id, email: null, name: "Boss", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const admin = person({ admin: true });

describe("handlePeopleAdmin", () => {
  let users: MemoryUserStore;
  const call = (actor: Actor, method: string, path: string, body?: unknown) =>
    handlePeopleAdmin(
      { method, path, body, actor },
      { users, knownFloors: ["office", "sales"] },
    );

  beforeEach(async () => {
    users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: "ana@acme.com", name: "Ana" });
    await users.upsert({ id: "user_beto", email: null, name: "Beto" });
    await users.addHead("office", "user_beto");
  });

  it("answers nothing for paths that are not about people", async () => {
    expect(await call(admin, "GET", "/health")).toBeNull();
    expect(await call(admin, "GET", "/admin/floors/office")).toBeNull();
    expect(await call(admin, "POST", "/admin/floors/office/lock")).toBeNull();
    expect(await call(admin, "GET", "/admin/floors/office/layout")).toBeNull();
  });

  describe("the list of people", () => {
    it("gives the floors there are and everybody who signed in, with their roles", async () => {
      const reply = await call(admin, "GET", "/admin/people");
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({
        floors: ["office", "sales"],
        people: [
          {
            id: "user_ana",
            name: "Ana",
            email: "ana@acme.com",
            isAdmin: false,
            headOf: [],
          },
          {
            id: "user_beto",
            name: "Beto",
            email: null,
            isAdmin: false,
            headOf: ["office"],
          },
        ],
      });
    });

    it("is for admins and for the server's own tools", async () => {
      expect(
        (await call({ kind: "machine" }, "GET", "/admin/people"))?.status,
      ).toBe(200);
    });

    it("is not for anybody else, not even the head of a floor: it holds everybody's email", async () => {
      for (const actor of [person({}), person({ headOf: ["office"] })])
        expect((await call(actor, "GET", "/admin/people"))?.status).toBe(403);
    });

    it("only answers GET", async () => {
      expect((await call(admin, "POST", "/admin/people"))?.status).toBe(405);
    });
  });

  describe("naming a head", () => {
    const path = "/admin/floors/sales/heads";

    it("makes somebody head of a floor", async () => {
      const reply = await call(admin, "POST", path, {
        userId: "user_ana",
        head: true,
      });
      expect(reply).toEqual({
        status: 200,
        body: { floor: "sales", userId: "user_ana", head: true },
      });
      expect((await users.rolesOf("user_ana")).headOf).toEqual(["sales"]);
    });

    it("takes the role away, and says so even if they were not head", async () => {
      expect(
        (
          await call(admin, "POST", "/admin/floors/office/heads", {
            userId: "user_beto",
            head: false,
          })
        )?.body,
      ).toMatchObject({ head: false });
      expect((await users.rolesOf("user_beto")).headOf).toEqual([]);
      expect(
        (await call(admin, "POST", path, { userId: "user_ana", head: false }))
          ?.status,
      ).toBe(200);
    });

    it("naming the same head twice changes nothing", async () => {
      await call(admin, "POST", path, { userId: "user_ana", head: true });
      expect(
        (await call(admin, "POST", path, { userId: "user_ana", head: true }))
          ?.status,
      ).toBe(200);
      expect(await users.headsOf("sales")).toEqual(["user_ana"]);
    });

    it("works for the server's own tools too", async () => {
      expect(
        (
          await call({ kind: "machine" }, "POST", path, {
            userId: "user_ana",
            head: true,
          })
        )?.status,
      ).toBe(200);
    });

    it("is not for anybody else, and changes nothing", async () => {
      for (const actor of [person({}), person({ headOf: ["sales"] })]) {
        const reply = await call(actor, "POST", path, {
          userId: "user_ana",
          head: true,
        });
        expect(reply?.status).toBe(403);
      }
      expect(await users.headsOf("sales")).toEqual([]);
    });

    it("says nobody has that id when they never signed in", async () => {
      const reply = await call(admin, "POST", path, {
        userId: "user_ghost",
        head: true,
      });
      expect(reply?.status).toBe(404);
      expect(String(reply?.body.error)).toMatch(/signed in/i);
    });

    it("does not know floors that do not exist", async () => {
      expect(
        (
          await call(admin, "POST", "/admin/floors/nowhere/heads", {
            userId: "user_ana",
            head: true,
          })
        )?.status,
      ).toBe(404);
    });

    it("needs a person and a yes or no", async () => {
      for (const body of [
        undefined,
        null,
        [],
        {},
        { userId: "user_ana" },
        { head: true },
        { userId: "", head: true },
        { userId: 5, head: true },
        { userId: "x".repeat(200), head: true },
        { userId: "user_ana", head: "yes" },
        { userId: "user_ana", head: 1 },
      ])
        expect(
          (await call(admin, "POST", path, body))?.status,
          JSON.stringify(body),
        ).toBe(400);
      expect(await users.headsOf("sales")).toEqual([]);
    });

    it("only answers POST", async () => {
      expect((await call(admin, "GET", path))?.status).toBe(405);
    });
  });

  it("says so when the database cannot be reached", async () => {
    users.list = async () => {
      throw new Error("connection refused");
    };
    expect((await call(admin, "GET", "/admin/people"))?.status).toBe(503);
  });
});

describe("handlePeopleAdmin audit", () => {
  let users: MemoryUserStore;
  let recorded: AuditInput[];
  const boss = person({ admin: true });
  const call = (body: unknown, actor: Actor = boss) =>
    handlePeopleAdmin(
      {
        method: "POST",
        path: "/admin/floors/office/heads",
        body,
        actor,
      },
      {
        users,
        knownFloors: ["office"],
        audit: async (entry) => {
          recorded.push(entry);
        },
      },
    );

  beforeEach(async () => {
    users = new MemoryUserStore();
    await users.upsert({ id: "user_beto", email: null, name: "Beto" });
    recorded = [];
  });

  it("records who named a head, and who", async () => {
    await call({ userId: "user_beto", head: true });
    expect(recorded).toEqual([
      {
        actorUserId: "user_boss",
        actorName: "Boss",
        action: "head.assign",
        targetUserId: "user_beto",
        targetName: "Beto",
        floor: "office",
      },
    ]);
  });

  it("records taking it away", async () => {
    await users.addHead("office", "user_beto");
    await call({ userId: "user_beto", head: false });
    expect(recorded).toEqual([
      expect.objectContaining({
        action: "head.remove",
        targetUserId: "user_beto",
        targetName: "Beto",
        floor: "office",
      }),
    ]);
  });

  it("records only what changed: naming a head twice, or removing a non-head, is not news", async () => {
    await call({ userId: "user_beto", head: false });
    await call({ userId: "user_beto", head: true });
    recorded.length = 0;
    await call({ userId: "user_beto", head: true });
    expect(recorded).toEqual([]);
  });

  it("records nothing when it refused", async () => {
    await call({ userId: "user_nobody", head: true });
    await call(
      { userId: "user_beto", head: true },
      person({ headOf: ["office"] }),
    );
    await call({ nonsense: true });
    expect(recorded).toEqual([]);
  });
});

describe("handlePeopleAdmin and bans", () => {
  it("says until when each person is banned, when it knows about bans", async () => {
    const users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    await users.upsert({ id: "user_beto", email: null, name: "Beto" });
    const bans = new MemoryBanStore();
    await bans.ban("user_beto", 10, 1_000);
    const reply = await handlePeopleAdmin(
      {
        method: "GET",
        path: "/admin/people",
        actor: person({ admin: true }),
      },
      { users, knownFloors: ["office"], bans, now: () => 2_000 },
    );
    const people = reply?.body.people as Array<{
      id: string;
      bannedUntil: number | null;
    }>;
    expect(people.map((p) => [p.id, p.bannedUntil])).toEqual([
      ["user_ana", null],
      ["user_beto", 1_000 + 10 * 60_000],
    ]);
  });
});

describe("floors made while the server runs", () => {
  it("are listed with the people and can have heads", async () => {
    const users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    const floors = ["office"];
    const deps = { users, knownFloors: async () => floors };
    const list = async () =>
      handlePeopleAdmin(
        { method: "GET", path: "/admin/people", actor: { kind: "machine" } },
        deps,
      );
    expect((await list())?.body.floors).toEqual(["office"]);
    floors.push("hr");
    expect((await list())?.body.floors).toEqual(["office", "hr"]);
    const named = await handlePeopleAdmin(
      {
        method: "POST",
        path: "/admin/floors/hr/heads",
        body: { userId: "user_ana", head: true },
        actor: { kind: "machine" },
      },
      deps,
    );
    expect(named?.status).toBe(200);
  });
});

describe("people and the rooms they can enter", () => {
  const setup = async () => {
    const users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    await users.upsert({ id: "user_beto", email: null, name: "Beto" });
    await users.upsert({ id: "user_cris", email: null, name: "Cris" });
    await users.setAdmin("user_cris", true);
    await users.addHead("lab", "user_beto");
    const floorStore = new MemoryFloorStore(() => 1);
    await floorStore.create({ id: "hr", name: "People" });
    await floorStore.create({ id: "lab", name: "Lab" });
    await floorStore.grant("hr", "user_ana");
    const changed: Array<[string, string]> = [];
    const deps = {
      users,
      knownFloors: ["office", "hr", "lab"],
      floors: floorStore,
      onAccessChanged: (floor: string, userId: string) =>
        changed.push([floor, userId]),
    };
    return { users, deps, changed };
  };

  it("gives the names of the floors, and for each person the entries they were given and every floor they can enter", async () => {
    const { deps } = await setup();
    const reply = await handlePeopleAdmin(
      { method: "GET", path: "/admin/people", actor: { kind: "machine" } },
      deps,
    );
    expect(reply?.body.floorInfo).toEqual([
      { id: "office", name: "Main office", common: true },
      { id: "hr", name: "People", common: false },
      { id: "lab", name: "Lab", common: false },
    ]);
    const people = reply?.body.people as Array<Record<string, unknown>>;
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    expect(byId.user_ana).toMatchObject({
      access: ["hr"],
      canEnter: ["office", "hr"],
    });
    expect(byId.user_beto).toMatchObject({
      access: [],
      canEnter: ["office", "lab"],
    });
    expect(byId.user_cris).toMatchObject({
      access: [],
      canEnter: ["office", "hr", "lab"],
    });
  });

  it("tells the rooms when a head is taken away, and only then", async () => {
    const { deps, changed } = await setup();
    const call = (head: boolean) =>
      handlePeopleAdmin(
        {
          method: "POST",
          path: "/admin/floors/lab/heads",
          body: { userId: "user_beto", head },
          actor: { kind: "machine" },
        },
        deps,
      );
    await call(true);
    expect(changed).toEqual([]);
    await call(false);
    expect(changed).toEqual([["lab", "user_beto"]]);
    await call(false);
    expect(changed).toEqual([["lab", "user_beto"]]);
  });
});

describe("people, groups and archived rooms", () => {
  const setup = async () => {
    const users = new MemoryUserStore();
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    await users.upsert({ id: "user_beto", email: null, name: "Beto" });
    await users.upsert({ id: "user_cris", email: null, name: "Cris" });
    await users.setAdmin("user_cris", true);
    const floors = new MemoryFloorStore(() => 1);
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "lab", name: "Lab" });
    await floors.create({ id: "old", name: "Old" });
    await floors.grant("lab", "user_ana");
    await floors.grant("old", "user_ana");
    await floors.archive("old");
    const groups = new MemoryGroupStore(() => 1, floors);
    await groups.create({ id: "people", name: "Human Resources" });
    await groups.setFloor("people", "hr", true);
    await groups.setFloor("people", "lab", true);
    await groups.setFloor("people", "old", true);
    await groups.setMember("people", "user_ana", true);
    await groups.setMember("people", "user_beto", true);
    const deps = {
      users,
      knownFloors: ["office", "hr", "lab", "old"],
      floors,
      groups,
    };
    const list = async () => {
      const reply = await handlePeopleAdmin(
        { method: "GET", path: "/admin/people", actor: { kind: "machine" } },
        deps,
      );
      const people = reply?.body.people as Array<Record<string, unknown>>;
      return {
        reply,
        byId: Object.fromEntries(people.map((p) => [p.id, p])),
      };
    };
    return { list };
  };

  it("leaves archived rooms out of the rooms to choose from", async () => {
    const { list } = await setup();
    const { reply } = await list();
    expect(
      (reply?.body.floorInfo as Array<{ id: string }>).map((f) => f.id),
    ).toEqual(["office", "hr", "lab"]);
  });

  it("says for each person which groups they are in", async () => {
    const { list } = await setup();
    const { byId } = await list();
    expect(byId.user_ana.groups).toEqual([
      { id: "people", name: "Human Resources" },
    ]);
    expect(byId.user_cris.groups).toEqual([]);
  });

  it("counts the rooms of the groups in what each person can enter, with the source of every entry", async () => {
    const { list } = await setup();
    const { byId } = await list();
    expect(byId.user_ana).toMatchObject({
      access: ["lab", "old"],
      canEnter: ["office", "hr", "lab"],
      effectiveAccess: [
        { floor: "hr", sources: ["group:Human Resources"] },
        { floor: "lab", sources: ["direct", "group:Human Resources"] },
      ],
    });
    expect(byId.user_beto).toMatchObject({
      access: [],
      canEnter: ["office", "hr", "lab"],
      effectiveAccess: [
        { floor: "hr", sources: ["group:Human Resources"] },
        { floor: "lab", sources: ["group:Human Resources"] },
      ],
    });
    expect(byId.user_cris).toMatchObject({
      canEnter: ["office", "hr", "lab"],
      effectiveAccess: [],
    });
  });
});
