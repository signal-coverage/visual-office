import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimiter.ts";

describe("RateLimiter", () => {
  function setup(capacity = 3, perSecond = 2) {
    let now = 1_000_000;
    const limiter = new RateLimiter(capacity, perSecond, () => now);
    return { limiter, advance: (ms: number) => (now += ms) };
  }

  it("lets a burst through, up to its capacity", () => {
    const { limiter } = setup(3, 2);
    expect([1, 2, 3].map(() => limiter.allow("a"))).toEqual([true, true, true]);
    expect(limiter.allow("a")).toBe(false);
  });

  it("recovers at its steady rate", () => {
    const { limiter, advance } = setup(3, 2);
    for (let i = 0; i < 3; i++) limiter.allow("a");
    expect(limiter.allow("a")).toBe(false);

    advance(500); // 2 per second: one token
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
  });

  it("never stores more than its capacity, however long it was idle", () => {
    const { limiter, advance } = setup(3, 2);
    advance(60_000);
    expect([1, 2, 3, 4].map(() => limiter.allow("a"))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("counts each player separately", () => {
    const { limiter } = setup(1, 1);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
  });

  it("forgets a player who left", () => {
    const { limiter } = setup(1, 1);
    limiter.allow("a");
    limiter.forget("a");
    expect(limiter.allow("a")).toBe(true);
  });
});
