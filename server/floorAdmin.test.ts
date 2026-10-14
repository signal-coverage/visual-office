import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { authorizeAdmin, handleFloorAdmin } from "./floorAdmin.ts";
import { FloorLocks } from "./floorLocks.ts";

describe("authorizeAdmin", () => {
  const base = {
    header: undefined,
    token: undefined,
    production: false,
    remoteAddress: "127.0.0.1",
  };

  describe("with a token configured", () => {
    it("accepts the right one", () => {
      expect(
        authorizeAdmin({ ...base, token: "s3cret", header: "Bearer s3cret" }),
      ).toBe(true);
    });

    it("refuses a wrong, missing or malformed one", () => {
      for (const header of [
        undefined,
        "",
        "Bearer wrong",
        "s3cret",
        "Bearer",
        "bearer s3cret",
        "Bearer s3cret ",
      ]) {
        expect(
          authorizeAdmin({ ...base, token: "s3cret", header }),
          String(header),
        ).toBe(false);
      }
    });

    it("needs it even from this machine, and in production", () => {
      expect(
        authorizeAdmin({ ...base, token: "s3cret", production: true }),
      ).toBe(false);
      expect(
        authorizeAdmin({
          ...base,
          token: "s3cret",
          header: "Bearer s3cret",
          production: true,
        }),
      ).toBe(true);
    });
  });

  describe("without a token", () => {
    it("is off in production, so the internet cannot close the office", () => {
      expect(authorizeAdmin({ ...base, production: true })).toBe(false);
      expect(
        authorizeAdmin({
          ...base,
          production: true,
          header: "Bearer anything",
        }),
      ).toBe(false);
    });

    it("works in development, but only from this machine", () => {
      for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
        expect(authorizeAdmin({ ...base, remoteAddress }), remoteAddress).toBe(
          true,
        );
      }
      for (const remoteAddress of [
        "192.168.1.20",
        "10.0.0.5",
        "8.8.8.8",
        undefined,
        "::ffff:192.168.1.1",
      ]) {
        expect(
          authorizeAdmin({ ...base, remoteAddress }),
          String(remoteAddress),
        ).toBe(false);
      }
    });
  });

  it("treats an empty token as no token", () => {
    expect(
      authorizeAdmin({
        ...base,
        token: "",
        production: true,
        header: "Bearer ",
      }),
    ).toBe(false);
  });
});

describe("handleFloorAdmin", () => {
  let locks: FloorLocks;
  let closed: Array<[string, number]>;
  let now: number;
  const deps = () => ({
    locks,
    knownFloors: ["office"],
    closeFloor: (floor: string, grace: number) => {
      closed.push([floor, grace]);
      return 3;
    },
  });
  const call = (method: string, path: string, body?: unknown) =>
    handleFloorAdmin({ method, path, body }, deps());

  beforeEach(() => {
    now = 1_000_000;
    locks = new FloorLocks(() => now, 45_000);
    closed = [];
  });

  it("answers nothing for a path that is not its own", async () => {
    expect(await call("GET", "/health")).toBeNull();
    expect(await call("GET", "/admin/other")).toBeNull();
  });

  it("says a floor is open", async () => {
    expect(await call("GET", "/admin/floors/office")).toMatchObject({
      status: 200,
      body: { locked: false },
    });
  });

  it("does not know floors that do not exist", async () => {
    expect((await call("GET", "/admin/floors/nowhere"))?.status).toBe(404);
    expect(
      (await call("POST", "/admin/floors/nowhere/lock", { holder: "ana" }))
        ?.status,
    ).toBe(404);
    expect((await call("GET", "/admin/floors/../etc"))?.status).toBe(404);
  });

  describe("lock", () => {
    it("locks the floor, closes it to the people inside, and says how many were told", async () => {
      const reply = (await call("POST", "/admin/floors/office/lock", {
        holder: "ana",
        graceSeconds: 5,
      }))!;
      expect(reply.status).toBe(200);
      expect(reply.body).toMatchObject({
        locked: true,
        holder: "ana",
        told: 3,
      });
      expect(closed).toEqual([["office", 5]]);
      expect((await call("GET", "/admin/floors/office"))?.body).toMatchObject({
        locked: true,
        holder: "ana",
      });
    });

    it("gives people ten seconds to finish, unless told otherwise", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      expect(closed).toEqual([["office", 10]]);
    });

    it("never gives more time than a sensible minute or two, or a negative one", async () => {
      await call("POST", "/admin/floors/office/lock", {
        holder: "ana",
        graceSeconds: 9999,
      });
      expect(closed[0][1]).toBeLessThanOrEqual(120);
      await locks.release("office", "ana");
      await call("POST", "/admin/floors/office/lock", {
        holder: "ana",
        graceSeconds: -5,
      });
      expect(closed[1][1]).toBe(0);
    });

    it("refuses a second editor and says who has it, without closing anything again", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      closed.length = 0;
      const reply = (await call("POST", "/admin/floors/office/lock", {
        holder: "beto",
      }))!;
      expect(reply.status).toBe(409);
      expect(reply.body).toMatchObject({ heldBy: "ana" });
      expect(closed).toEqual([]);
    });

    it("does not send everyone away again when the same editor asks twice", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      closed.length = 0;
      expect(
        (await call("POST", "/admin/floors/office/lock", { holder: "ana" }))
          ?.status,
      ).toBe(200);
      expect(closed).toEqual([]);
    });

    it("needs a holder", async () => {
      for (const body of [
        undefined,
        null,
        {},
        { holder: "" },
        { holder: 5 },
        { holder: "x".repeat(65) },
        [],
      ]) {
        expect(
          (await call("POST", "/admin/floors/office/lock", body))?.status,
          JSON.stringify(body),
        ).toBe(400);
      }
      expect(closed).toEqual([]);
    });

    it("says so, and closes nothing, when the database cannot be reached", async () => {
      locks = {
        current: async () => {
          throw new Error("connection refused");
        },
        acquire: async () => {
          throw new Error("connection refused");
        },
        renew: async () => false,
        release: async () => false,
      } as unknown as FloorLocks;
      const reply = await call("POST", "/admin/floors/office/lock", {
        holder: "ana",
      });
      expect(reply?.status).toBe(503);
      expect(closed).toEqual([]);
    });
  });

  describe("heartbeat", () => {
    it("keeps the lock alive", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      now += 40_000;
      expect(
        (
          await call("POST", "/admin/floors/office/heartbeat", {
            holder: "ana",
          })
        )?.status,
      ).toBe(200);
      now += 40_000;
      expect((await call("GET", "/admin/floors/office"))?.body).toMatchObject({
        locked: true,
      });
    });

    it("tells an editor who lost the lock, so it does not carry on thinking it has it", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      now += 50_000; // ran out
      await call("POST", "/admin/floors/office/lock", { holder: "beto" });
      expect(
        (
          await call("POST", "/admin/floors/office/heartbeat", {
            holder: "ana",
          })
        )?.status,
      ).toBe(404);
    });
  });

  describe("unlock", () => {
    it("opens the floor", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      expect(
        await call("POST", "/admin/floors/office/unlock", { holder: "ana" }),
      ).toMatchObject({
        status: 200,
        body: { released: true },
      });
      expect((await call("GET", "/admin/floors/office"))?.body).toMatchObject({
        locked: false,
      });
    });

    it("does not let somebody else open it", async () => {
      await call("POST", "/admin/floors/office/lock", { holder: "ana" });
      expect(
        (await call("POST", "/admin/floors/office/unlock", { holder: "beto" }))
          ?.status,
      ).toBe(404);
      expect((await call("GET", "/admin/floors/office"))?.body).toMatchObject({
        locked: true,
        holder: "ana",
      });
    });
  });

  it("only answers the methods it knows", async () => {
    expect((await call("DELETE", "/admin/floors/office/lock"))?.status).toBe(
      405,
    );
    expect((await call("GET", "/admin/floors/office/lock"))?.status).toBe(405);
  });
});

describe("handleFloorAdmin, for a person who signed in", () => {
  const person = (
    roles: { admin?: boolean; headOf?: string[] },
    id = "user_ana",
  ): Actor => ({
    kind: "user",
    user: { id, email: null, name: "Ana", isAdmin: !!roles.admin },
    roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
  });
  let locks: FloorLocks;
  let closed: Array<[string, number]>;
  const call = (actor: Actor, method: string, path: string, body?: unknown) =>
    handleFloorAdmin(
      { method, path, body, actor },
      {
        locks,
        knownFloors: ["office"],
        closeFloor: (floor, grace) => {
          closed.push([floor, grace]);
          return 0;
        },
      },
    );

  beforeEach(() => {
    locks = new FloorLocks(() => 1_000_000, 45_000);
    closed = [];
  });

  it("lets the head of the floor close it, as themselves", async () => {
    const reply = await call(
      person({ headOf: ["office"] }),
      "POST",
      "/admin/floors/office/lock",
    );
    expect(reply?.status).toBe(200);
    expect(reply?.body).toMatchObject({ holder: "user_ana" });
    expect((await locks.current("office"))?.holder).toBe("user_ana");
    expect(closed).toHaveLength(1);
  });

  it("ignores who the request says is holding the floor: it is who the token says", async () => {
    await call(
      person({ headOf: ["office"] }),
      "POST",
      "/admin/floors/office/lock",
      { holder: "somebody-else" },
    );
    expect((await locks.current("office"))?.holder).toBe("user_ana");
  });

  it("lets an admin close any floor", async () => {
    const reply = await call(
      person({ admin: true }),
      "POST",
      "/admin/floors/office/lock",
    );
    expect(reply?.status).toBe(200);
  });

  it("refuses somebody who is not its head, and closes nothing", async () => {
    for (const roles of [{}, { headOf: ["another-floor"] }]) {
      const reply = await call(
        person(roles),
        "POST",
        "/admin/floors/office/lock",
      );
      expect(reply?.status).toBe(403);
      expect(String(reply?.body.error)).toMatch(/head|admin/i);
    }
    expect(await locks.current("office")).toBeNull();
    expect(closed).toEqual([]);
  });

  it("keeps their lock alive and lets them open the floor again", async () => {
    const ana = person({ headOf: ["office"] });
    await call(ana, "POST", "/admin/floors/office/lock");
    expect(
      (await call(ana, "POST", "/admin/floors/office/heartbeat"))?.status,
    ).toBe(200);
    expect(
      (await call(ana, "POST", "/admin/floors/office/unlock"))?.status,
    ).toBe(200);
    expect(await locks.current("office")).toBeNull();
  });

  it("does not let somebody else open a floor its head closed, even an admin without the lock", async () => {
    await call(
      person({ headOf: ["office"] }),
      "POST",
      "/admin/floors/office/lock",
    );
    const admin = person({ admin: true }, "user_boss");
    expect(
      (await call(admin, "POST", "/admin/floors/office/unlock"))?.status,
    ).toBe(404);
    expect((await locks.current("office"))?.holder).toBe("user_ana");
  });

  it("refuses to heartbeat or unlock for somebody who may not edit the floor", async () => {
    for (const action of ["heartbeat", "unlock"]) {
      expect(
        (await call(person({}), "POST", `/admin/floors/office/${action}`))
          ?.status,
        action,
      ).toBe(403);
    }
  });

  it("lets anybody who signed in see whether the floor is closed", async () => {
    const reply = await call(person({}), "GET", "/admin/floors/office");
    expect(reply?.status).toBe(200);
    expect(reply?.body).toMatchObject({ locked: false });
  });
});

describe("handleFloorAdmin, who may edit a floor (access)", () => {
  const request = (actor?: Actor) => ({
    method: "GET",
    path: "/admin/floors/office/access",
    actor,
  });
  const deps = {
    locks: new FloorLocks(),
    knownFloors: ["office"],
    closeFloor: () => 0,
  };
  const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
    kind: "user",
    user: { id: "user_ana", email: null, name: "Ana", isAdmin: !!roles.admin },
    roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
  });

  it("says yes to editing to the head of the floor, who may not manage people", async () => {
    expect(
      await handleFloorAdmin(request(person({ headOf: ["office"] })), deps),
    ).toEqual({
      status: 200,
      body: { floor: "office", canEdit: true, canManage: false },
    });
  });

  it("says yes to everything to an admin", async () => {
    expect(
      await handleFloorAdmin(request(person({ admin: true })), deps),
    ).toEqual({
      status: 200,
      body: { floor: "office", canEdit: true, canManage: true },
    });
  });

  it("says no, and not an error, to everybody else who signed in", async () => {
    for (const roles of [{}, { headOf: ["another-floor"] }]) {
      expect(await handleFloorAdmin(request(person(roles)), deps)).toEqual({
        status: 200,
        body: { floor: "office", canEdit: false, canManage: false },
      });
    }
  });

  it("says yes to the server's own tools", async () => {
    expect(await handleFloorAdmin(request(), deps)).toMatchObject({
      body: { canEdit: true, canManage: true },
    });
  });

  it("does not know floors that do not exist, and only answers GET", async () => {
    expect(
      (
        await handleFloorAdmin(
          { method: "GET", path: "/admin/floors/nowhere/access" },
          deps,
        )
      )?.status,
    ).toBe(404);
    expect(
      (
        await handleFloorAdmin(
          { method: "POST", path: "/admin/floors/office/access" },
          deps,
        )
      )?.status,
    ).toBe(405);
  });
});

describe("handleFloorAdmin audit", () => {
  let locks: FloorLocks;
  let recorded: AuditInput[];
  const ana: Actor = {
    kind: "user",
    user: { id: "user_ana", email: null, name: "Ana", isAdmin: false },
    roles: { admin: false, headOf: ["office"] },
  };
  const call = (actor: Actor, action: string, body: unknown = {}) =>
    handleFloorAdmin(
      { method: "POST", path: `/admin/floors/office/${action}`, body, actor },
      {
        locks,
        knownFloors: ["office"],
        closeFloor: () => 2,
        audit: async (entry) => {
          recorded.push(entry);
        },
      },
    );

  beforeEach(() => {
    locks = new FloorLocks();
    recorded = [];
  });

  it("records who closed a floor, and how many people were inside", async () => {
    await call(ana, "lock", { graceSeconds: 5 });
    expect(recorded).toEqual([
      {
        actorUserId: "user_ana",
        actorName: "Ana",
        action: "floor.lock",
        floor: "office",
        detail: { graceSeconds: 5, told: 2 },
      },
    ]);
  });

  it("records who opened it again", async () => {
    await call(ana, "lock");
    recorded.length = 0;
    await call(ana, "unlock");
    expect(recorded).toEqual([
      {
        actorUserId: "user_ana",
        actorName: "Ana",
        action: "floor.unlock",
        floor: "office",
      },
    ]);
  });

  it("says the server's own tools did it, when they did", async () => {
    await call({ kind: "machine" }, "lock", { holder: "dev editor" });
    expect(recorded[0]).toMatchObject({
      actorUserId: null,
      actorName: "Server tools",
      action: "floor.lock",
    });
  });

  it("records nothing for what did not happen", async () => {
    await call(ana, "lock");
    recorded.length = 0;
    // The same editor asking again carries on: nothing new happened
    await call(ana, "lock");
    // Somebody else is refused
    await call(
      { ...ana, user: { ...ana.user, id: "user_beto", name: "Beto" } },
      "lock",
    );
    // Opening a floor they do not hold
    await call(
      { ...ana, user: { ...ana.user, id: "user_beto", name: "Beto" } },
      "unlock",
    );
    // A heartbeat is not news
    await call(ana, "heartbeat");
    // A member is refused
    await call(
      {
        kind: "user",
        user: { ...ana.user, id: "user_eve" },
        roles: { admin: false, headOf: [] },
      },
      "lock",
    );
    expect(recorded).toEqual([]);
  });

  it("still closes the floor when nothing can record it", async () => {
    const reply = await handleFloorAdmin(
      {
        method: "POST",
        path: "/admin/floors/office/lock",
        body: {},
        actor: ana,
      },
      { locks, knownFloors: ["office"], closeFloor: () => 0 },
    );
    expect(reply?.status).toBe(200);
  });
});

describe("floors made while the server runs", () => {
  it("are known to the lock API when the list is asked for each time", async () => {
    const floors = ["office"];
    const deps = {
      locks: new FloorLocks(),
      knownFloors: async () => floors,
      closeFloor: () => 0,
    };
    const ask = () =>
      handleFloorAdmin({ method: "GET", path: "/admin/floors/hr" }, deps);
    expect((await ask())?.status).toBe(404);
    floors.push("hr");
    expect((await ask())?.status).toBe(200);
  });
});
