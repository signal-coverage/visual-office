import { describe, expect, it } from "vitest";
import {
  clientIp,
  createIpLimiter,
  DEFAULT_REQUESTS_PER_MINUTE,
  requestsPerMinuteFromEnv,
} from "./httpRateLimit.ts";

function setup(limit = 3, windowMs = 60_000, maxKeys = 1000) {
  let now = 1_000_000;
  const limiter = createIpLimiter({ limit, windowMs, maxKeys, now: () => now });
  return { limiter, tick: (ms: number) => (now += ms) };
}

describe("createIpLimiter", () => {
  it("lets through up to the limit in a window", () => {
    const { limiter } = setup(3);
    expect([1, 2, 3].map(() => limiter.check("1.1.1.1").allowed)).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.check("1.1.1.1").allowed).toBe(false);
  });

  it("says how long to wait, in whole seconds, at least one", () => {
    const { limiter, tick } = setup(1, 60_000);
    limiter.check("a");
    tick(10_000);
    expect(limiter.check("a")).toEqual({
      allowed: false,
      retryAfterSeconds: 50,
    });
    tick(49_900);
    expect(limiter.check("a")).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it("starts again when the window is over", () => {
    const { limiter, tick } = setup(1, 60_000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    tick(60_000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each address on its own", () => {
    const { limiter } = setup(1);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("forgets expired entries", () => {
    const { limiter, tick } = setup(1, 1000, 5);
    for (const key of ["a", "b", "c"]) limiter.check(key);
    tick(1001);
    limiter.check("d");
    expect(limiter.size()).toBe(1);
  });

  it("never holds more addresses than its bound", () => {
    const { limiter } = setup(1, 60_000, 10);
    for (let i = 0; i < 200; i++) limiter.check(`ip-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(10);
  });

  it("is off when the limit is zero", () => {
    const { limiter } = setup(0);
    for (let i = 0; i < 10; i++) expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("is the connection's address without a trusted proxy, whatever the header says", () => {
    expect(
      clientIp({
        forwardedFor: "9.9.9.9",
        remoteAddress: "10.0.0.1",
        trustProxy: false,
      }),
    ).toBe("10.0.0.1");
  });

  it("is the last hop of the forwarded list behind a trusted proxy: the one the proxy added", () => {
    expect(
      clientIp({
        forwardedFor: "6.6.6.6, 203.0.113.9",
        remoteAddress: "10.0.0.1",
        trustProxy: true,
      }),
    ).toBe("203.0.113.9");
  });

  it("falls back to the connection when there is no header", () => {
    expect(clientIp({ remoteAddress: "10.0.0.1", trustProxy: true })).toBe(
      "10.0.0.1",
    );
  });

  it("drops the IPv4-in-IPv6 prefix", () => {
    expect(
      clientIp({ remoteAddress: "::ffff:127.0.0.1", trustProxy: false }),
    ).toBe("127.0.0.1");
  });

  it("has a name for an unknown one", () => {
    expect(clientIp({ trustProxy: false })).toBe("unknown");
  });
});

describe("requestsPerMinuteFromEnv", () => {
  it("is generous by default", () => {
    expect(requestsPerMinuteFromEnv({})).toBe(DEFAULT_REQUESTS_PER_MINUTE);
    expect(DEFAULT_REQUESTS_PER_MINUTE).toBeGreaterThanOrEqual(600);
  });

  it("takes a whole number from HTTP_RATE_LIMIT_PER_MINUTE, and zero turns it off", () => {
    expect(
      requestsPerMinuteFromEnv({ HTTP_RATE_LIMIT_PER_MINUTE: "300" }),
    ).toBe(300);
    expect(requestsPerMinuteFromEnv({ HTTP_RATE_LIMIT_PER_MINUTE: "0" })).toBe(
      0,
    );
  });

  it("ignores anything else", () => {
    for (const bad of ["", "abc", "-5", "1.5", "99999999999"])
      expect(
        requestsPerMinuteFromEnv({ HTTP_RATE_LIMIT_PER_MINUTE: bad }),
      ).toBe(DEFAULT_REQUESTS_PER_MINUTE);
  });
});
