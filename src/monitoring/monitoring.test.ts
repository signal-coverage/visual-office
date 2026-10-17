import { afterEach, describe, expect, it } from "vitest";
import { reportClientError, setClientReporter } from "./reporter";
import { startMonitoring } from "./start";

afterEach(() => setClientReporter(null));

type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

function setup() {
  const target = new EventTarget();
  const calls = { load: 0, idle: 0 };
  let runIdle: () => void = () => {};
  const sent: unknown[] = [];
  const deps = {
    target,
    whenIdle: (run: () => void) => {
      calls.idle++;
      runIdle = run;
    },
    load: async (): Promise<{
      createClientReporter: (dsn: string) => Reporter | null;
    }> => {
      calls.load++;
      return {
        createClientReporter: () => (error, context) =>
          void sent.push([error, context]),
      };
    },
  };
  const fire = (type: string, props: object) =>
    target.dispatchEvent(Object.assign(new Event(type), props));
  return {
    deps,
    calls,
    sent,
    fire,
    idle: async () => {
      runIdle();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

describe("startMonitoring", () => {
  it("does nothing at all without a DSN: nothing is scheduled, loaded or listened to", () => {
    for (const dsn of [undefined, "", "   "]) {
      const { deps, calls } = setup();
      let listened = 0;
      deps.target.addEventListener = () => void listened++;
      expect(startMonitoring(dsn, deps)).toBe(false);
      expect(calls).toEqual({ load: 0, idle: 0 });
      expect(listened).toBe(0);
    }
    expect(() => reportClientError(new Error("x"))).not.toThrow();
  });

  it("waits until the page is idle before loading the reporter", async () => {
    const { deps, calls, idle } = setup();
    expect(startMonitoring("https://k@o1.ingest.sentry.io/1", deps)).toBe(true);
    expect(calls).toEqual({ load: 0, idle: 1 });
    await idle();
    expect(calls.load).toBe(1);
  });

  it("reports uncaught errors and unhandled rejections once loaded", async () => {
    const { deps, sent, fire, idle } = setup();
    startMonitoring("https://k@o1.ingest.sentry.io/1", deps);
    await idle();
    const error = new Error("boom");
    fire("error", { error, message: "boom" });
    const reason = new Error("late");
    fire("unhandledrejection", { reason });
    expect(sent).toEqual([
      [error, { source: "window.onerror" }],
      [reason, { source: "unhandledrejection" }],
    ]);
  });

  it("keeps what happened before it was loaded, and sends it after", async () => {
    const { deps, sent, fire, idle } = setup();
    startMonitoring("https://k@o1.ingest.sentry.io/1", deps);
    const early = new Error("early");
    fire("error", { error: early });
    expect(sent).toEqual([]);
    await idle();
    expect(sent).toEqual([[early, { source: "window.onerror" }]]);
  });

  it("keeps only a few of the early ones", async () => {
    const { deps, sent, fire, idle } = setup();
    startMonitoring("https://k@o1.ingest.sentry.io/1", deps);
    for (let i = 0; i < 50; i++) fire("error", { error: new Error(`e${i}`) });
    await idle();
    expect(sent.length).toBeLessThanOrEqual(10);
  });

  it("is quiet when the DSN is not usable or the chunk cannot be loaded", async () => {
    const unusable = setup();
    unusable.deps.load = async () => ({ createClientReporter: () => null });
    startMonitoring("nonsense", unusable.deps);
    await unusable.idle();
    expect(() => reportClientError(new Error("x"))).not.toThrow();

    const broken = setup();
    broken.deps.load = async () => {
      throw new Error("chunk blocked");
    };
    startMonitoring("https://k@o1.ingest.sentry.io/1", broken.deps);
    await broken.idle();
    expect(() => reportClientError(new Error("x"))).not.toThrow();
  });
});

describe("reportClientError", () => {
  it("does nothing without a reporter", () => {
    expect(() => reportClientError(new Error("x"), { a: 1 })).not.toThrow();
  });

  it("hands the error to the reporter and never lets it throw", () => {
    const seen: unknown[] = [];
    setClientReporter((error) => void seen.push(error));
    const error = new Error("x");
    reportClientError(error, { source: "ErrorBoundary" });
    expect(seen).toEqual([error]);
    setClientReporter(() => {
      throw new Error("reporter broke");
    });
    expect(() => reportClientError(error)).not.toThrow();
  });
});
