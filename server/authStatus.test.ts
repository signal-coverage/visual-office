import { describe, expect, it } from "vitest";
import { authStatusFromEnv } from "./authStatus.ts";

const secret = "sk_test_AbCdEf1234567890SECRETVALUE";
const publishable = "pk_test_AbCdEf1234567890PUBLICVALUE";

describe("authStatusFromEnv", () => {
  it("says sign-in is ready when both keys are there and agree", () => {
    const status = authStatusFromEnv({
      CLERK_SECRET_KEY: secret,
      VITE_CLERK_PUBLISHABLE_KEY: publishable,
    });
    expect(status.ready).toBe(true);
    expect(status.summary).toMatch(/ready/i);
    expect(status.summary).toMatch(/test/i);
  });

  it("never prints a key, whatever the outcome", () => {
    for (const env of [
      { CLERK_SECRET_KEY: secret, VITE_CLERK_PUBLISHABLE_KEY: publishable },
      { CLERK_SECRET_KEY: secret },
      { CLERK_SECRET_KEY: publishable, VITE_CLERK_PUBLISHABLE_KEY: secret },
      { CLERK_SECRET_KEY: "nonsense-SECRETVALUE" },
    ]) {
      const { summary } = authStatusFromEnv(env);
      expect(summary).not.toContain("SECRETVALUE");
      expect(summary).not.toContain("PUBLICVALUE");
      expect(summary).not.toContain("AbCdEf");
    }
  });

  it("is off, quietly, when nothing is configured", () => {
    const status = authStatusFromEnv({});
    expect(status.ready).toBe(false);
    expect(status.summary).toMatch(/off/i);
  });

  it("names the key that is missing", () => {
    expect(
      authStatusFromEnv({ VITE_CLERK_PUBLISHABLE_KEY: publishable }).summary,
    ).toContain("CLERK_SECRET_KEY");
    expect(authStatusFromEnv({ CLERK_SECRET_KEY: secret }).summary).toContain(
      "VITE_CLERK_PUBLISHABLE_KEY",
    );
  });

  it("notices keys that are swapped, which is an easy mistake", () => {
    const status = authStatusFromEnv({
      CLERK_SECRET_KEY: publishable,
      VITE_CLERK_PUBLISHABLE_KEY: secret,
    });
    expect(status.ready).toBe(false);
    expect(status.summary).toContain("CLERK_SECRET_KEY");
    expect(status.summary).toMatch(/sk_/);
  });

  it("notices a test key paired with a live one, which belong to different Clerk instances", () => {
    const status = authStatusFromEnv({
      CLERK_SECRET_KEY: "sk_live_x",
      VITE_CLERK_PUBLISHABLE_KEY: publishable,
    });
    expect(status.ready).toBe(false);
    expect(status.summary).toMatch(/test.*live|live.*test/i);
  });

  it("treats spaces or line breaks pasted around a key as part of nothing", () => {
    expect(
      authStatusFromEnv({
        CLERK_SECRET_KEY: `  ${secret}\n`,
        VITE_CLERK_PUBLISHABLE_KEY: `${publishable} `,
      }).ready,
    ).toBe(true);
  });

  it("counts an empty variable as not set", () => {
    expect(
      authStatusFromEnv({
        CLERK_SECRET_KEY: "",
        VITE_CLERK_PUBLISHABLE_KEY: publishable,
      }).summary,
    ).toContain("CLERK_SECRET_KEY");
  });

  it("accepts the publishable key under its server-side name too", () => {
    expect(
      authStatusFromEnv({
        CLERK_SECRET_KEY: secret,
        CLERK_PUBLISHABLE_KEY: publishable,
      }).ready,
    ).toBe(true);
  });
});
