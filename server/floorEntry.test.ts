import { beforeEach, describe, expect, it } from "vitest";
import {
  FLOOR_FORBIDDEN_CODE,
  FLOOR_UNAVAILABLE_CODE,
  FLOOR_UNKNOWN_CODE,
} from "../shared/floors.ts";
import {
  checkEntry,
  floorFromOptions,
  statusBeforeTheRoom,
} from "./floorEntry.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryUserStore } from "./userStore.ts";

describe("floorFromOptions", () => {
  it("is the common floor when the player does not say (an older client, the lite screen)", () => {
    for (const options of [
      undefined,
      null,
      {},
      { floor: undefined },
      { floor: null },
      { floor: "" },
    ])
      expect(floorFromOptions(options), JSON.stringify(options)).toBe("office");
  });

  it("is the floor asked for when it is a valid id", () => {
    expect(floorFromOptions({ floor: "hr" })).toBe("hr");
    expect(floorFromOptions({ floor: "floor-2" })).toBe("floor-2");
  });

  it("is nothing for what is not an id, so it is never taken for the common floor", () => {
    for (const floor of ["HR", "a b", "../x", 3, {}, ["hr"], true, "admin"])
      expect(floorFromOptions({ floor }), JSON.stringify(floor)).toBeNull();
  });

  it("does not trust anything but the floor option", () => {
    expect(floorFromOptions({ room: "hr", floorId: "hr" })).toBe("office");
    expect(floorFromOptions("hr")).toBe("office");
  });
});

describe("checkEntry", () => {
  let floors: MemoryFloorStore;
  let users: MemoryUserStore;
  const check = (floor: string, userId: string | null) =>
    checkEntry(floor, userId, { floors, rolesOf: (id) => users.rolesOf(id) });

  beforeEach(async () => {
    floors = new MemoryFloorStore(() => 1);
    users = new MemoryUserStore();
    for (const id of ["user_ana", "user_beto", "user_cris", "user_dora"])
      await users.upsert({ id, email: null, name: id });
    await users.setAdmin("user_cris", true);
    await users.addHead("hr", "user_beto");
    await floors.create({ id: "hr", name: "People" });
    await floors.grant("hr", "user_dora");
  });

  it("lets anybody into the common floor, and says what it is called", async () => {
    expect(await check("office", "user_ana")).toEqual({
      ok: true,
      floor: expect.objectContaining({ id: "office", name: "Main office" }),
    });
  });

  it("refuses a floor that does not exist, with its own code", async () => {
    expect(await check("nope", "user_ana")).toMatchObject({
      ok: false,
      code: FLOOR_UNKNOWN_CODE,
    });
    expect(await check("nope", null)).toMatchObject({
      ok: false,
      code: FLOOR_UNKNOWN_CODE,
    });
  });

  it("keeps an ordinary member out of a floor that is not common, with a clear code and message", async () => {
    const refused = await check("hr", "user_ana");
    expect(refused).toMatchObject({ ok: false, code: FLOOR_FORBIDDEN_CODE });
    expect(refused.ok === false && refused.message).toMatch(/not allowed/i);
  });

  it("lets in an admin, the head of the floor and somebody with an entry", async () => {
    for (const id of ["user_cris", "user_beto", "user_dora"])
      expect((await check("hr", id)).ok, id).toBe(true);
  });

  it("lets everybody into every floor when sign-in is off", async () => {
    expect((await check("hr", null)).ok).toBe(true);
  });

  it("notices an entry taken away the next time it is asked", async () => {
    expect((await check("hr", "user_dora")).ok).toBe(true);
    await floors.revoke("hr", "user_dora");
    expect(await check("hr", "user_dora")).toMatchObject({
      ok: false,
      code: FLOOR_FORBIDDEN_CODE,
    });
  });

  it("refuses when it cannot find out, except for the common floor, which must not lock everybody out", async () => {
    floors.get = async () => {
      throw new Error("database down");
    };
    expect(await check("hr", "user_cris")).toMatchObject({
      ok: false,
      code: FLOOR_UNAVAILABLE_CODE,
    });
    expect((await check("office", "user_ana")).ok).toBe(true);
  });

  it("refuses when the roles cannot be looked up, rather than letting somebody in", async () => {
    const reply = await checkEntry("hr", "user_ana", {
      floors,
      rolesOf: async () => {
        throw new Error("down");
      },
    });
    expect(reply).toMatchObject({ ok: false, code: FLOOR_UNAVAILABLE_CODE });
  });
});

describe("statusBeforeTheRoom", () => {
  it("turns the codes of a refusal into ones an HTTP answer can carry, since the matchmaking answer is HTTP", () => {
    expect(statusBeforeTheRoom(FLOOR_UNKNOWN_CODE)).toBe(404);
    expect(statusBeforeTheRoom(FLOOR_UNAVAILABLE_CODE)).toBe(503);
    expect(statusBeforeTheRoom(FLOOR_FORBIDDEN_CODE)).toBe(403);
  });

  it("is always a valid HTTP status, even for a code it does not know", () => {
    for (const code of [0, 4003, 4401, 99999, 500, 404])
      expect(statusBeforeTheRoom(code)).toBeGreaterThanOrEqual(200);
    expect(statusBeforeTheRoom(4401)).toBeLessThanOrEqual(599);
    expect(statusBeforeTheRoom(99999)).toBeLessThanOrEqual(599);
  });
});
