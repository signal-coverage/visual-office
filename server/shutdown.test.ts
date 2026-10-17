import { describe, expect, it } from "vitest";
import { createShutdown } from "./shutdown.ts";

function setup(
  steps: Array<{ name: string; run: () => Promise<unknown> }>,
  timeoutMs = 1000,
) {
  const exits: number[] = [];
  const logs: string[] = [];
  const shutdown = createShutdown({
    steps,
    timeoutMs,
    exit: (code) => exits.push(code),
    log: (line) => logs.push(line),
  });
  return { shutdown, exits, logs };
}

describe("createShutdown", () => {
  it("runs the steps in order and exits cleanly", async () => {
    const order: string[] = [];
    const { shutdown, exits } = setup([
      { name: "rooms", run: async () => void order.push("rooms") },
      { name: "database", run: async () => void order.push("database") },
    ]);
    await shutdown.run("SIGTERM");
    expect(order).toEqual(["rooms", "database"]);
    expect(exits).toEqual([0]);
  });

  it("knows it is shutting down from the first call", async () => {
    const { shutdown } = setup([{ name: "rooms", run: async () => {} }]);
    expect(shutdown.isShuttingDown()).toBe(false);
    const done = shutdown.run("SIGINT");
    expect(shutdown.isShuttingDown()).toBe(true);
    await done;
  });

  it("does it once, however many signals come", async () => {
    let runs = 0;
    const { shutdown, exits } = setup([
      {
        name: "rooms",
        run: async () => {
          runs++;
        },
      },
    ]);
    await Promise.all([shutdown.run("SIGTERM"), shutdown.run("SIGINT")]);
    expect(runs).toBe(1);
    expect(exits).toEqual([0]);
  });

  it("goes on to the next step when one fails, and says so without the secret", async () => {
    let closed = false;
    const { shutdown, exits, logs } = setup([
      {
        name: "rooms",
        run: async () => {
          throw new Error("broken postgres://u:pw@h/db");
        },
      },
      {
        name: "database",
        run: async () => {
          closed = true;
        },
      },
    ]);
    await shutdown.run("SIGTERM");
    expect(closed).toBe(true);
    expect(exits).toEqual([1]);
    expect(logs.join("\n")).toContain("rooms");
    expect(logs.join("\n")).not.toContain("pw");
  });

  it("exits anyway when a step takes too long", async () => {
    const { shutdown, exits, logs } = setup(
      [{ name: "rooms", run: () => new Promise(() => {}) }],
      30,
    );
    await shutdown.run("SIGTERM");
    expect(exits).toEqual([1]);
    expect(logs.join("\n")).toMatch(/time/i);
  });

  it("exits with the code it was asked to, after a crash", async () => {
    const { shutdown, exits } = setup([{ name: "rooms", run: async () => {} }]);
    await shutdown.run("uncaughtException", 1);
    expect(exits).toEqual([1]);
  });
});
