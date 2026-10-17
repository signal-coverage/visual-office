import { describe, expect, it } from "vitest";
import { createHealthCheck, versionFromEnv } from "./health.ts";

const base = {
  uptimeSeconds: () => 42.7,
  version: "1.0.0",
  isShuttingDown: () => false,
};

describe("createHealthCheck", () => {
  it("says it is up, with no database when none is configured", async () => {
    const check = createHealthCheck({ ...base, ping: null });
    expect(await check()).toEqual({
      status: 200,
      body: { ok: true, uptime: 42, db: "none", version: "1.0.0" },
    });
  });

  it("pings the database and says it is up", async () => {
    let pinged = 0;
    const check = createHealthCheck({
      ...base,
      ping: async () => {
        pinged++;
      },
    });
    expect((await check()).body.db).toBe("up");
    expect(pinged).toBe(1);
  });

  it("says the database is down when the ping fails, and still answers 200", async () => {
    const check = createHealthCheck({
      ...base,
      ping: async () => {
        throw new Error("connection refused postgres://u:pw@h/db");
      },
    });
    const reply = await check();
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: true, db: "down" });
    expect(JSON.stringify(reply)).not.toMatch(/pw|refused/);
  });

  it("gives up on a slow database quickly", async () => {
    const check = createHealthCheck({
      ...base,
      timeoutMs: 20,
      ping: () => new Promise(() => {}),
    });
    const started = Date.now();
    expect((await check()).body.db).toBe("down");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("answers 503 while the server is shutting down, without touching the database", async () => {
    let pinged = 0;
    const check = createHealthCheck({
      ...base,
      isShuttingDown: () => true,
      ping: async () => {
        pinged++;
      },
    });
    const reply = await check();
    expect(reply.status).toBe(503);
    expect(reply.body.ok).toBe(false);
    expect(pinged).toBe(0);
  });

  it("only ever says these four things", async () => {
    const check = createHealthCheck({ ...base, ping: null });
    expect(Object.keys((await check()).body).sort()).toEqual([
      "db",
      "ok",
      "uptime",
      "version",
    ]);
  });
});

describe("versionFromEnv", () => {
  it("is the package version alone without a build id", () => {
    expect(versionFromEnv({}, "0.0.0")).toBe("0.0.0");
  });

  it("adds the short commit Railway gives", () => {
    expect(
      versionFromEnv(
        { RAILWAY_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567" },
        "0.0.0",
      ),
    ).toBe("0.0.0+0123456");
  });

  it("ignores a build id that is not a commit hash", () => {
    expect(versionFromEnv({ GIT_COMMIT_SHA: "not a sha; DROP" }, "1.2.3")).toBe(
      "1.2.3",
    );
  });
});
