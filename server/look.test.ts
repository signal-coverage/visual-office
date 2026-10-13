import { describe, expect, it } from "vitest";
import {
  LOOK_COOLDOWN_MS,
  mayChangeLook,
  nextLook,
  waitedEnough,
} from "./look.ts";

const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };

describe("nextLook", () => {
  it("is the new look when something really changed", () => {
    expect(nextLook(look, { ...look, shirt: 7 })).toEqual({
      ...look,
      shirt: 7,
    });
  });

  it("is nothing when the look is the same one: there is nothing to tell anybody", () => {
    expect(nextLook(look, { ...look })).toBeNull();
  });

  it("changes only what is a valid choice and keeps the rest as it was", () => {
    expect(nextLook(look, { ...look, shirt: 7, pants: 999 })).toEqual({
      ...look,
      shirt: 7,
    });
  });

  it("is nothing for what is not a look at all", () => {
    for (const raw of [null, undefined, "text", 42, [], {}, { admin: true }])
      expect(nextLook(look, raw), JSON.stringify(raw)).toBeNull();
  });

  it("is nothing when every part sent is invalid", () => {
    expect(nextLook(look, { skin: -1, shirt: "red" })).toBeNull();
  });

  it("drops anything that is not part of a look", () => {
    expect(nextLook(look, { ...look, shirt: 7, isAdmin: true })).toEqual({
      ...look,
      shirt: 7,
    });
  });
});

describe("mayChangeLook", () => {
  it("lets everybody for now: the company may decide who can, later", () => {
    expect(mayChangeLook(null)).toBe(true);
    expect(
      mayChangeLook({ id: "u", email: null, name: "Ana", isAdmin: false }),
    ).toBe(true);
  });
});

describe("waitedEnough", () => {
  it("lets the first change through", () => {
    expect(waitedEnough(undefined, 1_000)).toBe(true);
  });

  it("holds back changes that come too close together, so nobody can flood the room", () => {
    expect(waitedEnough(1_000, 1_000 + LOOK_COOLDOWN_MS - 1)).toBe(false);
  });

  it("lets one through once the time has passed", () => {
    expect(waitedEnough(1_000, 1_000 + LOOK_COOLDOWN_MS)).toBe(true);
  });
});
