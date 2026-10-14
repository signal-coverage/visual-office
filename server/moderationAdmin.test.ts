import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { MemoryBanStore } from "./banStore.ts";
import { handleModerationAdmin } from "./moderationAdmin.ts";
import type { ModerationRooms } from "./moderationService.ts";
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
const hana = person({ headOf: ["office"] }, "user_hana", "Hana");
const ana = person({}, "user_ana", "Ana");
const machine: Actor = { kind: "machine" };

describe("handleModerationAdmin", () => {
  let users: MemoryUserStore;
  let bans: MemoryBanStore;
  let recorded: AuditInput[];
  let removed: string[];
  const rooms: ModerationRooms = {
    removeUser: (_floor, userId) => {
      removed.push(userId);
      return 1;
    },
    setVoiceMuted: async () => 1,
  };
  const call = (
    actor: Actor | undefined,
    body: unknown,
    method = "POST",
    path = "/admin/moderation",
  ) =>
    handleModerationAdmin(
      { method, path, body, actor },
      {
        users,
        bans,
        rooms,
        audit: async (entry) => {
          recorded.push(entry);
        },
        now: () => 1_000,
        knownFloors: ["office"],
        floor: "office",
      },
    );

  beforeEach(async () => {
    users = new MemoryUserStore();
    for (const [id, name] of [
      ["user_boss", "Boss"],
      ["user_hana", "Hana"],
      ["user_ana", "Ana"],
      ["user_beto", "Beto"],
    ])
      await users.upsert({ id, email: null, name });
    await users.setAdmin("user_boss", true);
    await users.addHead("office", "user_hana");
    bans = new MemoryBanStore();
    recorded = [];
    removed = [];
  });

  it("answers nothing for paths that are not about moderation", async () => {
    expect(await call(boss, {}, "POST", "/admin/people")).toBeNull();
    expect(await call(boss, {}, "POST", "/admin/moderation/x")).toBeNull();
  });

  it("refuses somebody who is not signed in", async () => {
    expect(
      (await call(undefined, { action: "kick", userId: "user_beto" }))?.status,
    ).toBe(401);
  });

  it("lets an admin and the head of the floor remove somebody", async () => {
    for (const actor of [boss, hana]) {
      const reply = await call(actor, { action: "kick", userId: "user_beto" });
      expect(reply).toEqual({
        status: 200,
        body: { ok: true, action: "kick", name: "Beto" },
      });
    }
    expect(removed).toEqual(["user_beto", "user_beto"]);
  });

  it("refuses a member with 403 and does nothing", async () => {
    const reply = await call(ana, { action: "kick", userId: "user_beto" });
    expect(reply?.status).toBe(403);
    expect(removed).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it("refuses to act on an admin or on yourself with 403", async () => {
    expect(
      (await call(hana, { action: "kick", userId: "user_boss" }))?.status,
    ).toBe(403);
    expect(
      (await call(boss, { action: "ban", userId: "user_boss" }))?.status,
    ).toBe(403);
  });

  it("bans for the minutes asked, keeping them inside the bounds", async () => {
    const reply = await call(boss, {
      action: "ban",
      userId: "user_beto",
      minutes: 1_000_000,
    });
    expect(reply?.body).toMatchObject({ action: "ban", minutes: 240 });
    expect(await bans.activeUntil("user_beto", 1_000)).toBe(
      1_000 + 240 * 60_000,
    );
  });

  it("takes the actor from the token, not from the request", async () => {
    await call(hana, {
      action: "kick",
      userId: "user_beto",
      actor: "user_boss",
      actorName: "Boss",
    });
    expect(recorded[0]).toMatchObject({
      actorUserId: "user_hana",
      actorName: "Hana",
    });
  });

  it("lets the server's own tools moderate, recorded as them", async () => {
    await call(machine, { action: "ban", userId: "user_beto" });
    expect(recorded[0]).toMatchObject({
      actorUserId: null,
      actorName: "Server tools",
      action: "moderation.ban",
    });
  });

  it("says when nobody has that id (404) or the person is not here (409)", async () => {
    expect(
      (await call(boss, { action: "kick", userId: "user_nobody" }))?.status,
    ).toBe(404);
    const away: ModerationRooms = { ...rooms, removeUser: () => 0 };
    const reply = await handleModerationAdmin(
      {
        method: "POST",
        path: "/admin/moderation",
        body: { action: "kick", userId: "user_beto" },
        actor: boss,
      },
      {
        users,
        bans,
        rooms: away,
        audit: async () => {},
        now: () => 0,
        knownFloors: ["office"],
        floor: "office",
      },
    );
    expect(reply?.status).toBe(409);
  });

  it("lifts a ban, and says 409 when there is none", async () => {
    expect(
      (await call(boss, { action: "unban", userId: "user_beto" }))?.status,
    ).toBe(409);
    await bans.ban("user_beto", 10, 1_000);
    expect(
      (await call(boss, { action: "unban", userId: "user_beto" }))?.status,
    ).toBe(200);
  });

  it("refuses a request that makes no sense with 400", async () => {
    for (const body of [
      undefined,
      null,
      [],
      {},
      { action: "kick" },
      { userId: "user_beto" },
      { action: "delete", userId: "user_beto" },
      { action: "kick", userId: 5 },
      { action: "kick", userId: "" },
      { action: "kick", userId: "x".repeat(200) },
    ])
      expect((await call(boss, body))?.status, JSON.stringify(body)).toBe(400);
  });

  it("does not know floors that do not exist", async () => {
    expect(
      (
        await call(boss, {
          action: "kick",
          userId: "user_beto",
          floor: "nowhere",
        })
      )?.status,
    ).toBe(404);
  });

  it("only answers POST", async () => {
    expect((await call(boss, {}, "GET"))?.status).toBe(405);
  });

  it("says so when the database cannot be reached", async () => {
    users.get = async () => {
      throw new Error("connection refused");
    };
    expect(
      (await call(boss, { action: "kick", userId: "user_beto" }))?.status,
    ).toBe(503);
  });
});
