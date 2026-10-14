import { describe, expect, it } from "vitest";
import {
  LOOK_COOLDOWN_MS,
  mayChangeLook,
  nextLook,
  waitedEnough,
} from "./look.ts";

const look = {
  skin: 1,
  hairColor: 2,
  hairStyle: 0,
  shirt: 3,
  pants: 4,
  facialHair: 1,
  glasses: 2,
  headwear: 0,
  top: 3,
  shoes: 2,
  accessory: 1,
};

describe("nextLook", () => {
  it("is the new look when something really changed", () => {
    expect(nextLook(look, { ...look, shirt: 5 })).toEqual({
      ...look,
      shirt: 5,
    });
  });

  it("is nothing when the look is the same one: there is nothing to tell anybody", () => {
    expect(nextLook(look, { ...look })).toBeNull();
  });

  it("changes only what is a valid choice and keeps the rest as it was", () => {
    expect(nextLook(look, { ...look, shirt: 5, pants: 999 })).toEqual({
      ...look,
      shirt: 5,
    });
  });

  it("changes the extra parts too, and only when they are valid choices", () => {
    expect(nextLook(look, { ...look, glasses: 3, headwear: 2 })).toEqual({
      ...look,
      glasses: 3,
      headwear: 2,
    });
    expect(nextLook(look, { ...look, glasses: 99, top: -1 })).toBeNull();
  });

  it("keeps the extras when an old client that only knows five parts changes one of them", () => {
    const oldClient = {
      skin: 4,
      hairColor: 2,
      hairStyle: 0,
      shirt: 3,
      pants: 4,
    };
    expect(nextLook(look, oldClient)).toEqual({ ...look, skin: 4 });
  });

  it("is nothing for what is not a look at all", () => {
    for (const raw of [null, undefined, "text", 42, [], {}, { admin: true }])
      expect(nextLook(look, raw), JSON.stringify(raw)).toBeNull();
  });

  it("is nothing when every part sent is invalid", () => {
    expect(nextLook(look, { skin: -1, shirt: "red" })).toBeNull();
  });

  it("drops anything that is not part of a look", () => {
    expect(nextLook(look, { ...look, shirt: 5, isAdmin: true })).toEqual({
      ...look,
      shirt: 5,
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
