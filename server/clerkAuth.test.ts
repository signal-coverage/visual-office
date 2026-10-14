import { describe, expect, it } from "vitest";
import {
  adminEmailsFromEnv,
  isTokenProblem,
  membershipCache,
} from "./clerkAuth.ts";

describe("isTokenProblem", () => {
  it("is true for what is wrong with the token itself (expired, forged, for another app)", () => {
    for (const reason of [
      "token-expired",
      "token-invalid",
      "token-invalid-signature",
      "token-invalid-authorized-parties",
      "token-not-active-yet",
    ])
      expect(isTokenProblem(reason), reason).toBe(true);
  });

  it("is false for what is wrong with checking it (keys, network), which is not the visitor's fault", () => {
    for (const reason of [
      "secret-key-invalid",
      "jwk-remote-failed-to-load",
      "jwk-failed-to-resolve",
      "jwk-local-missing",
      undefined,
    ])
      expect(isTokenProblem(reason), String(reason)).toBe(false);
  });
});

describe("adminEmailsFromEnv", () => {
  it("reads a comma separated list, lower-cased and trimmed", () => {
    expect(
      adminEmailsFromEnv({ ADMIN_EMAILS: " Ana@Acme.com ,beto@acme.com,, " }),
    ).toEqual(new Set(["ana@acme.com", "beto@acme.com"]));
  });

  it("is empty when there is none", () => {
    expect(adminEmailsFromEnv({})).toEqual(new Set());
    expect(adminEmailsFromEnv({ ADMIN_EMAILS: "" })).toEqual(new Set());
  });
});

describe("membershipCache", () => {
  it("asks once for the same person within the time, then again after it", async () => {
    let now = 0;
    let asked = 0;
    const check = membershipCache(
      async () => {
        asked++;
        return true;
      },
      () => now,
      1000,
    );
    await check("user_ana");
    await check("user_ana");
    expect(asked).toBe(1);
    now += 1001;
    await check("user_ana");
    expect(asked).toBe(2);
  });

  it("keeps people apart", async () => {
    const check = membershipCache(
      async (id) => id === "user_ana",
      () => 0,
      1000,
    );
    expect(await check("user_ana")).toBe(true);
    expect(await check("user_eve")).toBe(false);
  });

  it("does not remember a no, so somebody who has just accepted an invitation gets in at once", async () => {
    let invited = false;
    const check = membershipCache(
      async () => invited,
      () => 0,
      60_000,
    );
    expect(await check("user_eve")).toBe(false);
    invited = true;
    expect(await check("user_eve")).toBe(true);
  });

  it("does not remember a failure to ask", async () => {
    let fail = true;
    const check = membershipCache(
      async () => {
        if (fail) throw new Error("down");
        return true;
      },
      () => 0,
      1000,
    );
    await expect(check("user_ana")).rejects.toThrow();
    fail = false;
    expect(await check("user_ana")).toBe(true);
  });
});
