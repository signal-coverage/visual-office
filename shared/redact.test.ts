import { describe, expect, it } from "vitest";
import { redactContext, redactText } from "./redact.ts";

describe("redactText", () => {
  it("hides a database address with its password", () => {
    const text =
      "connect failed: postgresql://user:hunter2@db.neon.tech/app?sslmode=require";
    const out = redactText(text);
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("db.neon.tech");
    expect(out).toContain("connect failed");
  });

  it("hides any address that carries a username or password", () => {
    expect(redactText("see https://bob:pw@example.com/x")).not.toMatch(
      /bob|pw@/,
    );
  });

  it("hides bearer tokens and JWTs", () => {
    expect(redactText("Authorization: Bearer abc.def.ghi")).toBe(
      "Authorization: Bearer [redacted]",
    );
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
    expect(redactText(`token ${jwt} rejected`)).toBe(
      "token [redacted-token] rejected",
    );
  });

  it("hides Clerk-style keys", () => {
    const out = redactText(
      "keys sk_test_AbC123xyz456 and pk_live_Zz99Yy88Xx77",
    );
    expect(out).not.toMatch(/AbC123|Zz99/);
  });

  it("hides email addresses", () => {
    expect(redactText("user ana@acme.com not found")).toBe(
      "user [redacted-email] not found",
    );
  });

  it("hides query strings, where feed secrets and tokens live", () => {
    expect(
      redactText("GET https://cal.example.com/feed.ics?token=abc123"),
    ).toBe("GET https://cal.example.com/feed.ics?[redacted]");
  });

  it("hides the private part of a calendar feed address", () => {
    expect(
      redactText(
        "https://calendar.google.com/ical/x/private-0123456789abcdef0123/basic.ics",
      ),
    ).not.toContain("0123456789abcdef0123");
  });

  it("leaves ordinary text alone", () => {
    expect(redactText("Cannot read properties of undefined")).toBe(
      "Cannot read properties of undefined",
    );
  });
});

describe("redactContext", () => {
  it("keeps short plain values", () => {
    expect(
      redactContext({ route: "/admin/people", status: 500, ok: false }),
    ).toEqual({
      route: "/admin/people",
      status: 500,
      ok: false,
    });
  });

  it("drops what could hold secrets, people or content by name", () => {
    expect(
      redactContext({
        token: "x",
        Authorization: "y",
        body: "z",
        email: "a@b.co",
        password: "p",
        cookie: "c",
        route: "r",
      }),
    ).toEqual({ route: "r" });
  });

  it("redacts and shortens values, and ignores what is not plain", () => {
    const out = redactContext({
      message: "failed for ana@acme.com",
      long: "x".repeat(1000),
      nested: { a: 1 } as unknown as string,
    });
    expect(out.message).toBe("failed for [redacted-email]");
    expect(String(out.long).length).toBeLessThanOrEqual(200);
    expect(out).not.toHaveProperty("nested");
  });

  it("keeps a bounded number of entries", () => {
    const many = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`k${i}`, i]),
    );
    expect(Object.keys(redactContext(many)).length).toBeLessThanOrEqual(20);
  });
});
