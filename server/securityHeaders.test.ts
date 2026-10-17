import { describe, expect, it } from "vitest";
import { applySecurityHeaders, SECURITY_HEADERS } from "./securityHeaders.ts";

describe("security headers", () => {
  it("stops browsers guessing types and keeps the address out of referrers", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("no-referrer");
  });

  it("adds no content security policy: it could break sign-in and voice", () => {
    expect(
      Object.keys(SECURITY_HEADERS).map((name) => name.toLowerCase()),
    ).not.toContain("content-security-policy");
  });

  it("sets them all on a response", () => {
    const set: Record<string, string> = {};
    applySecurityHeaders({
      setHeader: (name, value) => void (set[name] = value),
    });
    expect(set).toEqual(SECURITY_HEADERS);
  });
});
