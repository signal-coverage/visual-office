import { describe, expect, it } from "vitest";
import { createSentryReporter, parseDsn } from "./sentryReporter.ts";

const DSN = "https://abc123publickey@o4500.ingest.sentry.io/987";

describe("parseDsn", () => {
  it("reads the parts of a Sentry address", () => {
    expect(parseDsn(DSN)).toEqual({
      publicKey: "abc123publickey",
      endpoint:
        "https://o4500.ingest.sentry.io/api/987/envelope/?sentry_version=7&sentry_key=abc123publickey",
    });
  });

  it("keeps a path in front of the project", () => {
    expect(
      parseDsn("https://k@sentry.example.com/errors/12")?.endpoint,
    ).toMatch(/^https:\/\/sentry\.example\.com\/errors\/api\/12\/envelope\//);
  });

  it("refuses anything that is not an address with a key and a project", () => {
    for (const bad of [
      "",
      "nonsense",
      "https://host/1",
      "ftp://k@host/1",
      "https://k@host/",
      "https://k@host/abc",
    ])
      expect(parseDsn(bad)).toBeNull();
  });
});

interface Call {
  url: string;
  init: { method?: string; body?: string; headers?: Record<string, string> };
}

function setup(options: { maxPerMinute?: number; fail?: boolean } = {}) {
  const calls: Call[] = [];
  let now = 1_700_000_000_000;
  const report = createSentryReporter({
    dsn: DSN,
    platform: "node",
    environment: "production",
    release: "1.2.3",
    now: () => now,
    randomId: () => "0123456789abcdef0123456789abcdef",
    maxPerMinute: options.maxPerMinute,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init as Call["init"] });
      if (options.fail) throw new Error("offline");
      return new Response(null, { status: 200 });
    },
  });
  const events = () =>
    calls.map((call) => {
      const [header, item, payload] = call.init.body!.split("\n");
      return {
        header: JSON.parse(header),
        item: JSON.parse(item),
        event: JSON.parse(payload),
      };
    });
  return { report, calls, events, tick: (ms: number) => (now += ms) };
}

describe("createSentryReporter", () => {
  it("is off without a usable address", () => {
    expect(
      createSentryReporter({ dsn: "x", platform: "node", fetch: fetch }),
    ).toBeNull();
  });

  it("sends an event in an envelope to the ingest address", async () => {
    const { report, calls, events } = setup();
    report!(new TypeError("boom"), { route: "/admin/people", status: 500 });
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/987/envelope/");
    expect(calls[0].init.method).toBe("POST");
    const [sent] = events();
    expect(sent.header.event_id).toBe("0123456789abcdef0123456789abcdef");
    expect(sent.item).toEqual({ type: "event" });
    expect(sent.event).toMatchObject({
      level: "error",
      platform: "node",
      environment: "production",
      release: "1.2.3",
      exception: { values: [{ type: "TypeError", value: "boom" }] },
      tags: { route: "/admin/people", status: 500 },
    });
  });

  it("redacts the message, the stack and the context", async () => {
    const { report, events } = setup();
    const error = new Error(
      "failed postgresql://u:pw@db.example/app for ana@acme.com",
    );
    report!(error, { note: "Bearer sekrit", token: "t" });
    const text = JSON.stringify(events()[0].event);
    expect(text).not.toMatch(/pw@|ana@acme|sekrit|db\.example/);
    expect(events()[0].event.tags).not.toHaveProperty("token");
  });

  it("reports things that are not errors too", () => {
    const { report, events } = setup();
    report!("just a string");
    report!({ weird: true });
    expect(events()[0].event.exception.values[0].value).toBe("just a string");
    expect(events()[1].event.exception.values[0].type).toBe("Error");
  });

  it("sends no more than the limit a minute, then again when the minute is over", () => {
    const { report, calls, tick } = setup({ maxPerMinute: 2 });
    for (let i = 0; i < 5; i++) report!(new Error(`e${i}`));
    expect(calls).toHaveLength(2);
    tick(61_000);
    report!(new Error("later"));
    expect(calls).toHaveLength(3);
  });

  it("never throws, whatever the network does", async () => {
    const { report } = setup({ fail: true });
    expect(() => report!(new Error("x"))).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
