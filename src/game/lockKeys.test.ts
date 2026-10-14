import { describe, expect, it } from "vitest";
import { shouldDropKeys } from "./lockKeys";

describe("shouldDropKeys", () => {
  it("drops the held keys when the mouse is let go: their release never reaches the game", () => {
    expect(shouldDropKeys(true, false)).toBe(true);
  });

  it("drops them when the mouse is captured again, for keys pressed while it was free", () => {
    expect(shouldDropKeys(false, true)).toBe(true);
  });

  it("keeps them when the lock is announced again while it was never lost (a click on the scene while walking)", () => {
    expect(shouldDropKeys(true, true)).toBe(false);
  });

  it("drops them when nothing was locked before or after", () => {
    expect(shouldDropKeys(false, false)).toBe(true);
  });
});
