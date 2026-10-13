import { describe, expect, it } from "vitest";
import { allowedOriginsFromEnv, corsHeadersFor } from "./cors.ts";

const allowed = new Set(["https://office.example.com"]);

describe("corsHeadersFor", () => {
  it("lets the game's own site call the admin API, and says so for that origin only", () => {
    expect(
      corsHeadersFor("https://office.example.com", allowed, false),
    ).toMatchObject({
      "Access-Control-Allow-Origin": "https://office.example.com",
      Vary: "Origin",
    });
  });

  it("allows the headers a signed-in call needs, and nothing broad", () => {
    const headers = corsHeadersFor(
      "https://office.example.com",
      allowed,
      false,
    )!;
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Authorization, Content-Type",
    );
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });

  it("says nothing to other sites, so the browser keeps them out", () => {
    for (const origin of [
      "https://evil.example.com",
      "https://office.example.com.evil.com",
      "http://office.example.com",
      "null",
    ])
      expect(corsHeadersFor(origin, allowed, false), origin).toBeNull();
  });

  it("says nothing when the request does not come from a page", () => {
    expect(corsHeadersFor(undefined, allowed, false)).toBeNull();
  });

  it("lets this machine's pages in during development, on any port", () => {
    for (const origin of [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
    ])
      expect(corsHeadersFor(origin, new Set(), true), origin).not.toBeNull();
  });

  it("does not trust localhost in production", () => {
    expect(
      corsHeadersFor("http://localhost:5173", new Set(), false),
    ).toBeNull();
  });

  it("does not take a look-alike for localhost", () => {
    expect(
      corsHeadersFor("http://localhost.evil.com:5173", new Set(), true),
    ).toBeNull();
  });
});

describe("allowedOriginsFromEnv", () => {
  it("reads a comma separated list, trimmed and without a trailing slash", () => {
    expect(
      allowedOriginsFromEnv({
        ALLOWED_ORIGINS:
          " https://office.example.com/ ,https://staging.example.com,, ",
      }),
    ).toEqual(
      new Set(["https://office.example.com", "https://staging.example.com"]),
    );
  });

  it("is empty when there is none", () => {
    expect(allowedOriginsFromEnv({})).toEqual(new Set());
    expect(allowedOriginsFromEnv({ ALLOWED_ORIGINS: "" })).toEqual(new Set());
  });
});
