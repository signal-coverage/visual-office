import { afterEach, describe, expect, it } from "vitest";
import {
  initErrorReporting,
  reportError,
  resetErrorReporting,
} from "./errorReporting.ts";

const DSN = "https://key@o1.ingest.sentry.io/5";

afterEach(() => resetErrorReporting());

describe("error reporting", () => {
  it("is off without SENTRY_DSN: nothing is loaded and nothing is sent", async () => {
    let loaded = 0;
    let fetched = 0;
    const summary = await initErrorReporting(
      {},
      {
        load: async () => {
          loaded++;
          throw new Error("must not load");
        },
        fetch: async () => {
          fetched++;
          return new Response();
        },
      },
    );
    reportError(new Error("x"));
    expect(loaded).toBe(0);
    expect(fetched).toBe(0);
    expect(summary).toMatch(/off/i);
  });

  it("treats a blank SENTRY_DSN as off", async () => {
    let loaded = 0;
    await initErrorReporting(
      { SENTRY_DSN: "   " },
      {
        load: async () => {
          loaded++;
          throw new Error("must not load");
        },
      },
    );
    expect(loaded).toBe(0);
  });

  it("loads the reporter on demand when the address is set, and sends through it", async () => {
    const urls: string[] = [];
    const summary = await initErrorReporting(
      { SENTRY_DSN: DSN, NODE_ENV: "production" },
      {
        load: () => import("../shared/sentryReporter.ts"),
        fetch: async (url) => {
          urls.push(String(url));
          return new Response();
        },
      },
    );
    reportError(new Error("boom"), { route: "/admin" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("ingest.sentry.io");
    expect(summary).toMatch(/on/i);
    expect(summary).not.toContain("key@");
  });

  it("stays off, and says so, when the address is not usable", async () => {
    const summary = await initErrorReporting(
      { SENTRY_DSN: "nonsense-secret" },
      { load: () => import("../shared/sentryReporter.ts") },
    );
    reportError(new Error("x"));
    expect(summary).toMatch(/not a valid/i);
    expect(summary).not.toContain("nonsense-secret");
  });

  it("stays off when the reporter cannot be loaded", async () => {
    const summary = await initErrorReporting(
      { SENTRY_DSN: DSN },
      {
        load: async () => {
          throw new Error("no module");
        },
      },
    );
    expect(summary).toMatch(/could not/i);
    expect(() => reportError(new Error("x"))).not.toThrow();
  });

  it("never throws from reporting, even before it was set up", () => {
    expect(() => reportError(new Error("x"), { a: 1 })).not.toThrow();
  });
});
