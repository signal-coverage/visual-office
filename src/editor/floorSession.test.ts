import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloorSession, type SessionState } from "./floorSession";

interface Call {
  path: string;
  body: Record<string, unknown>;
}

function setup(
  answers: Record<string, { status: number; body: unknown } | "down">,
) {
  const calls: Call[] = [];
  const states: SessionState[] = [];
  const beacons: Call[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    const action = path.split("/").pop()!;
    calls.push({ path: action, body: JSON.parse(String(init.body ?? "{}")) });
    const answer = answers[action];
    if (!answer || answer === "down") throw new Error("connection refused");
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as unknown as typeof fetch;
  const session = new FloorSession({
    fetch: fetcher,
    holder: "editor-abc",
    onChange: (state) => states.push(state),
    beacon: (path, body) => {
      beacons.push({
        path: path.split("/").pop()!,
        body: body as Record<string, unknown>,
      });
      return true;
    },
  });
  return { session, calls, states, beacons };
}

const locked = {
  status: 200,
  body: { locked: true, heartbeatMs: 15000, told: 2 },
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("FloorSession", () => {
  it("starts out not editing", () => {
    expect(setup({}).session.state).toEqual({ kind: "idle" });
  });

  it("starts editing when the game server closes the floor, saying how many people were sent away", async () => {
    const { session, calls } = setup({ lock: locked });
    const result = await session.start();
    expect(result).toEqual({ ok: true, told: 2 });
    expect(session.state).toEqual({ kind: "editing", offline: false });
    expect(calls[0]).toEqual({
      path: "lock",
      body: { holder: "editor-abc", graceSeconds: 10 },
    });
  });

  it("talks to whatever address it is given, so it can run inside the game too", async () => {
    const urls: string[] = [];
    const beacons: string[] = [];
    const session = new FloorSession({
      fetch: (async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify(locked.body), { status: 200 });
      }) as unknown as typeof fetch,
      base: "https://office.example.com/admin/floors/office",
      holder: "editor-abc",
      onChange: () => {},
      beacon: (url) => {
        beacons.push(url);
        return true;
      },
    });
    await session.start();
    session.leavingPage();
    expect(urls).toEqual([
      "https://office.example.com/admin/floors/office/lock",
    ]);
    expect(beacons).toEqual([
      "https://office.example.com/admin/floors/office/unlock",
    ]);
    await session.finish();
    expect(urls.at(-1)).toBe(
      "https://office.example.com/admin/floors/office/unlock",
    );
  });

  it("says it is starting while it waits", async () => {
    const { session, states } = setup({ lock: locked });
    await session.start();
    expect(states[0]).toEqual({ kind: "starting" });
  });

  it("is refused when somebody else is editing, and says who", async () => {
    const { session } = setup({
      lock: {
        status: 409,
        body: {
          error: "editor-xyz is already editing this floor.",
          heldBy: "editor-xyz",
        },
      },
    });
    const result = await session.start();
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "editor-xyz" });
    expect(session.state).toEqual({ kind: "idle" });
  });

  it("says the game server cannot be reached, and does not start on its own", async () => {
    const { session } = setup({ lock: "down" });
    const result = await session.start();
    expect(result).toEqual({ ok: false, reason: "unreachable" });
    expect(session.state).toEqual({ kind: "idle" });
  });

  it("can carry on without a lock when told to, since nobody is there to lock out", async () => {
    const { session, calls } = setup({ lock: "down" });
    session.startOffline();
    expect(session.state).toEqual({ kind: "editing", offline: true });
    vi.advanceTimersByTime(60_000);
    expect(calls).toEqual([]); // nothing to keep alive
  });

  it("any other refusal is reported, not hidden", async () => {
    const { session } = setup({
      lock: { status: 403, body: { error: "Not allowed." } },
    });
    expect(await session.start()).toEqual({
      ok: false,
      reason: "refused",
      message: "Not allowed.",
    });
  });

  describe("keeping the lock", () => {
    it("tells the game server it is still there, as often as it asked", async () => {
      const { session, calls } = setup({
        lock: locked,
        heartbeat: { status: 200, body: { renewed: true } },
      });
      await session.start();
      await vi.advanceTimersByTimeAsync(15_000);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(calls.filter((c) => c.path === "heartbeat")).toHaveLength(2);
      expect(session.state.kind).toBe("editing");
    });

    it("notices when the lock was lost and stops, so it does not carry on editing a floor it does not hold", async () => {
      const { session, calls } = setup({
        lock: locked,
        heartbeat: {
          status: 404,
          body: { error: "You no longer hold this floor." },
        },
      });
      await session.start();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(session.state).toEqual({ kind: "lost" });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls.filter((c) => c.path === "heartbeat")).toHaveLength(1);
    });

    it("notices when the person is no longer allowed to edit (the role was taken away) and stops", async () => {
      const { session } = setup({
        lock: locked,
        heartbeat: {
          status: 403,
          body: {
            error:
              "Only the head of this floor, or an admin, may close it to edit.",
          },
        },
      });
      await session.start();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(session.state).toEqual({ kind: "lost" });
    });

    it("keeps trying through a hiccup in the connection", async () => {
      const { session, calls } = setup({ lock: locked, heartbeat: "down" });
      await session.start();
      await vi.advanceTimersByTimeAsync(15_000);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(calls.filter((c) => c.path === "heartbeat")).toHaveLength(2);
      expect(session.state.kind).toBe("editing");
    });
  });

  describe("finishing", () => {
    it("opens the floor again and stops keeping it alive", async () => {
      const { session, calls } = setup({
        lock: locked,
        unlock: { status: 200, body: { released: true } },
      });
      await session.start();
      await session.finish();
      expect(calls.at(-1)).toEqual({
        path: "unlock",
        body: { holder: "editor-abc" },
      });
      expect(session.state).toEqual({ kind: "idle" });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls.filter((c) => c.path === "heartbeat")).toEqual([]);
    });

    it("is finished even if the game server cannot be told: the lock will run out by itself", async () => {
      const { session } = setup({ lock: locked, unlock: "down" });
      await session.start();
      await session.finish();
      expect(session.state).toEqual({ kind: "idle" });
    });

    it("does not ask the game server anything when it was never locked", async () => {
      const { session, calls } = setup({});
      session.startOffline();
      await session.finish();
      expect(calls).toEqual([]);
      expect(session.state).toEqual({ kind: "idle" });
    });

    it("does nothing when it was not editing", async () => {
      const { session, calls } = setup({});
      await session.finish();
      expect(calls).toEqual([]);
    });
  });

  describe("closing the page", () => {
    it("opens the floor on the way out, by a message that survives the page closing", async () => {
      const { session, beacons } = setup({ lock: locked });
      await session.start();
      session.leavingPage();
      expect(beacons).toEqual([
        { path: "unlock", body: { holder: "editor-abc" } },
      ]);
    });

    it("sends nothing when there is nothing to open", () => {
      const { session, beacons } = setup({});
      session.leavingPage();
      session.startOffline();
      session.leavingPage();
      expect(beacons).toEqual([]);
    });
  });
});
