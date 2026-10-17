import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResult } from "./authenticate.ts";
import { handleFloorList } from "./floorList.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryGroupStore } from "./groupStore.ts";
import { MemoryUserStore } from "./userStore.ts";

describe("handleFloorList", () => {
  let floors: MemoryFloorStore;
  let users: MemoryUserStore;
  let groups: MemoryGroupStore;
  let who: AuthResult | null;
  const call = (
    path = "/account/floors",
    method = "GET",
    token: string | undefined = "t",
  ) =>
    handleFloorList(
      { method, path, token },
      {
        authenticate: async () => who,
        floors,
        groups,
        rolesOf: (id) => users.rolesOf(id),
      },
    );

  beforeEach(async () => {
    floors = new MemoryFloorStore(() => 1);
    users = new MemoryUserStore();
    groups = new MemoryGroupStore(() => 1, floors);
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "lab", name: "Lab" });
    await floors.grant("lab", "user_ana");
    who = {
      ok: true,
      user: { id: "user_ana", email: null, name: "Ana", isAdmin: false },
    };
  });

  it("answers nothing for another path", async () => {
    expect(await call("/account/session")).toBeNull();
    expect(await call("/admin/floors")).toBeNull();
  });

  it("says which rooms there are and which this person may enter, and nothing more", async () => {
    const reply = await call();
    expect(reply?.status).toBe(200);
    expect(reply?.body).toEqual({
      floors: [
        { id: "office", name: "Main office", common: true, canEnter: true },
        { id: "hr", name: "People", common: false, canEnter: false },
        { id: "lab", name: "Lab", common: false, canEnter: true },
      ],
    });
  });

  it("counts the rooms of the groups the person is in", async () => {
    await groups.create({ id: "people", name: "People" });
    await groups.setFloor("people", "hr", true);
    expect(
      ((await call())?.body.floors as Array<{ id: string; canEnter: boolean }>)
        .filter((floor) => floor.id === "hr")
        .map((floor) => floor.canEnter),
    ).toEqual([false]);
    await groups.setMember("people", "user_ana", true);
    expect(
      ((await call())?.body.floors as Array<{ id: string; canEnter: boolean }>)
        .filter((floor) => floor.id === "hr")
        .map((floor) => floor.canEnter),
    ).toEqual([true]);
  });

  it("does not list an archived room, for anybody, and lists it again when it is brought back", async () => {
    await users.setAdmin("user_ana", true);
    await floors.archive("lab");
    const ids = () =>
      (async () =>
        ((await call())?.body.floors as Array<{ id: string }>).map(
          (floor) => floor.id,
        ))();
    expect(await ids()).toEqual(["office", "hr"]);
    expect(JSON.stringify((await call())?.body)).not.toContain("Lab");
    await floors.unarchive("lab");
    expect(await ids()).toEqual(["office", "hr", "lab"]);
  });

  it("never lists who else has an entry, nor who is head", async () => {
    await floors.grant("hr", "user_other");
    await users.upsert({ id: "user_other", email: null, name: "Other" });
    await users.addHead("hr", "user_other");
    const text = JSON.stringify((await call())?.body);
    expect(text).not.toContain("user_other");
    expect(text).not.toContain("Other");
  });

  it("lets an admin into every room, and a head into theirs", async () => {
    await users.setAdmin("user_ana", true);
    const all = (await call())?.body.floors as Array<{ canEnter: boolean }>;
    expect(all.every((floor) => floor.canEnter)).toBe(true);
    await users.setAdmin("user_ana", false);
    await floors.revoke("lab", "user_ana");
    await users.addHead("hr", "user_ana");
    const mine = (await call())?.body.floors as Array<{
      id: string;
      canEnter: boolean;
    }>;
    expect(mine.map((floor) => [floor.id, floor.canEnter])).toEqual([
      ["office", true],
      ["hr", true],
      ["lab", false],
    ]);
  });

  it("lets everybody into every room when sign-in is off", async () => {
    who = null;
    const reply = await call("/account/floors", "GET", undefined);
    expect(reply?.status).toBe(200);
    expect(
      (reply?.body.floors as Array<{ canEnter: boolean }>).every(
        (floor) => floor.canEnter,
      ),
    ).toBe(true);
  });

  it("is for members: no token, a bad one or somebody outside the company is refused", async () => {
    who = { ok: false, reason: "missing" };
    expect((await call())?.status).toBe(401);
    who = { ok: false, reason: "invalid" };
    expect((await call())?.status).toBe(401);
    who = { ok: false, reason: "not_member" };
    expect((await call())?.status).toBe(403);
    who = { ok: false, reason: "unavailable" };
    expect((await call())?.status).toBe(503);
  });

  it("only answers GET", async () => {
    expect((await call("/account/floors", "POST"))?.status).toBe(405);
  });

  it("says the database cannot be reached rather than guessing", async () => {
    floors.list = async () => {
      throw new Error("down");
    };
    expect((await call())?.status).toBe(503);
  });
});
