import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  calendarOptionsFromEnv,
  createFeedFetcher,
  feedUrlProblem,
  isPublicAddress,
  nodeNetwork,
  type FeedNetwork,
  type FeedResponse,
} from "./calendarFetch.ts";

const FEED = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";

describe("isPublicAddress", () => {
  it("accepts addresses of the public internet", () => {
    for (const address of [
      "8.8.8.8",
      "142.250.184.14",
      "172.32.0.1",
      "100.63.255.255",
      "2606:4700:4700::1111",
      "2a00:1450:4007:80f::200e",
    ])
      expect(isPublicAddress(address), address).toBe(true);
  });

  it("refuses private, loopback, link-local and reserved IPv4", () => {
    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "127.255.255.254",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.8",
      "192.168.1.1",
      "198.18.0.1",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
    ])
      expect(isPublicAddress(address), address).toBe(false);
  });

  it("refuses private, loopback, link-local and reserved IPv6", () => {
    for (const address of [
      "::",
      "::1",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "febf::1",
      "ff02::1",
      "2001:db8::1",
      "64:ff9b::7f00:1",
    ])
      expect(isPublicAddress(address), address).toBe(false);
  });

  it("looks inside IPv4-mapped and 6to4 addresses", () => {
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:7f00:1")).toBe(false);
    expect(isPublicAddress("::ffff:10.1.2.3")).toBe(false);
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicAddress("2002:7f00:1::1")).toBe(false);
  });

  it("refuses what is not an address", () => {
    for (const value of ["", "localhost", "1.2.3", "999.1.1.1", "1.2.3.4.5"])
      expect(isPublicAddress(value), value).toBe(false);
  });
});

describe("feedUrlProblem", () => {
  it("accepts an https address, and webcal as https", () => {
    expect(
      feedUrlProblem("https://calendar.google.com/x/basic.ics"),
    ).toBeNull();
    expect(feedUrlProblem("webcal://example.com/cal.ics")).toBeNull();
  });

  it("explains what is wrong with the others", () => {
    for (const url of [
      "",
      "not a url",
      "http://example.com/cal.ics",
      "ftp://example.com/cal.ics",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:secret@example.com/cal.ics",
      "https://example.com:8443/cal.ics",
      "https://localhost/cal.ics",
      "https://foo.localhost/cal.ics",
      "https://127.0.0.1/cal.ics",
      "https://[::1]/cal.ics",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/cal.ics",
      "https://printer.internal/cal.ics",
      `https://example.com/${"a".repeat(3000)}`,
    ])
      expect(feedUrlProblem(url), url).toEqual(expect.any(String));
  });
});

describe("calendarOptionsFromEnv", () => {
  it("is off by default", () => {
    expect(calendarOptionsFromEnv({}).allowLocalForTests).toBe(false);
  });

  it("can be turned on outside production, for tests", () => {
    expect(
      calendarOptionsFromEnv({ CALENDAR_ALLOW_LOCAL_FOR_TESTS: "1" })
        .allowLocalForTests,
    ).toBe(true);
  });

  it("refuses to turn on in production", () => {
    expect(
      calendarOptionsFromEnv({
        CALENDAR_ALLOW_LOCAL_FOR_TESTS: "1",
        NODE_ENV: "production",
      }).allowLocalForTests,
    ).toBe(false);
  });
});

interface Script {
  addresses?: Record<string, string[]>;
  responses: Array<Partial<FeedResponse> | Error>;
}

function fakeNetwork(script: Script) {
  const calls: Array<{ url: string; address: string; timeoutMs: number }> = [];
  const resolved: string[] = [];
  let index = 0;
  const network: FeedNetwork = {
    resolve: async (host) => {
      resolved.push(host);
      return script.addresses?.[host] ?? ["93.184.216.34"];
    },
    get: async ({ url, address, timeoutMs }) => {
      calls.push({ url: url.href, address, timeoutMs });
      const next =
        script.responses[Math.min(index++, script.responses.length - 1)];
      if (next instanceof Error) throw next;
      return { status: 200, contentType: "text/calendar", body: FEED, ...next };
    },
  };
  return { network, calls, resolved };
}

describe("createFeedFetcher", () => {
  const run = (url: string, script: Script, options = {}) => {
    const fake = fakeNetwork(script);
    const fetchFeed = createFeedFetcher({ network: fake.network, ...options });
    return fetchFeed(url).then((result) => ({ result, ...fake }));
  };

  it("fetches a feed from the address it resolved", async () => {
    const { result, calls } = await run("https://example.com/cal.ics?x=1", {
      responses: [{}],
    });
    expect(result).toEqual({ ok: true, text: FEED });
    expect(calls).toEqual([
      {
        url: "https://example.com/cal.ics?x=1",
        address: "93.184.216.34",
        timeoutMs: expect.any(Number),
      },
    ]);
  });

  it("turns webcal into https", async () => {
    const { calls } = await run("webcal://example.com/cal.ics", {
      responses: [{}],
    });
    expect(calls[0].url).toBe("https://example.com/cal.ics");
  });

  it("does not care what the content type says", async () => {
    for (const contentType of [
      undefined,
      "text/plain",
      "application/octet-stream",
    ]) {
      const { result } = await run("https://example.com/c", {
        responses: [{ contentType }],
      });
      expect(result.ok).toBe(true);
    }
  });

  it("says so when it is not a calendar", async () => {
    const { result } = await run("https://example.com/c", {
      responses: [{ body: "<html>Please sign in</html>" }],
    });
    expect(result).toEqual({
      ok: false,
      error: "That address does not give an iCalendar feed.",
    });
  });

  it("says so when the server says no", async () => {
    const { result } = await run("https://example.com/c", {
      responses: [{ status: 404 }],
    });
    expect(result).toEqual({
      ok: false,
      error: "The calendar server answered 404.",
    });
  });

  it("never connects to a host that resolves to a private address", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.1.1",
      "169.254.169.254",
      "::1",
      "::ffff:192.168.0.1",
    ]) {
      const { result, calls } = await run("https://example.com/c", {
        addresses: { "example.com": [address] },
        responses: [{}],
      });
      expect(result.ok, address).toBe(false);
      expect(calls, address).toEqual([]);
    }
  });

  it("refuses when any of the addresses is private", async () => {
    const { result, calls } = await run("https://example.com/c", {
      addresses: { "example.com": ["93.184.216.34", "127.0.0.1"] },
      responses: [{}],
    });
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("refuses an address that does not resolve", async () => {
    const { result } = await run("https://example.com/c", {
      addresses: { "example.com": [] },
      responses: [{}],
    });
    expect(result).toEqual({
      ok: false,
      error: "That address could not be found.",
    });
  });

  it("says so when the lookup fails", async () => {
    const fetchFeed = createFeedFetcher({
      network: {
        resolve: async () => {
          throw new Error("ENOTFOUND");
        },
        get: async () => {
          throw new Error("unreachable");
        },
      },
    });
    expect(await fetchFeed("https://nowhere.example/c")).toEqual({
      ok: false,
      error: "That address could not be found.",
    });
  });

  it("follows a few redirects and checks each one", async () => {
    const { result, calls, resolved } = await run("https://example.com/a", {
      responses: [
        { status: 302, location: "/b" },
        { status: 301, location: "https://cdn.example.net/c.ics" },
        {},
      ],
    });
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://cdn.example.net/c.ics",
    ]);
    expect(resolved).toEqual(["example.com", "example.com", "cdn.example.net"]);
  });

  it("stops after too many redirects", async () => {
    const { result, calls } = await run("https://example.com/a", {
      responses: [{ status: 302, location: "/again" }],
    });
    expect(result).toEqual({
      ok: false,
      error: "The calendar address redirects too many times.",
    });
    expect(calls).toHaveLength(4);
  });

  it("refuses a redirect to somewhere it would not go", async () => {
    for (const location of [
      "http://example.com/plain",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://internal.example/x",
      "file:///etc/passwd",
      "https://user:pass@example.com/x",
    ]) {
      const { result, calls } = await run("https://example.com/a", {
        addresses: { "internal.example": ["10.0.0.9"] },
        responses: [{ status: 302, location }, {}],
      });
      expect(result.ok, location).toBe(false);
      expect(calls, location).toHaveLength(1);
    }
  });

  it("refuses a redirect without a destination", async () => {
    const { result } = await run("https://example.com/a", {
      responses: [{ status: 302 }],
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a body past the size limit, even from a network that did not stop it", async () => {
    const { result } = await run(
      "https://example.com/c",
      { responses: [{ body: `${FEED}${"x".repeat(2000)}` }] },
      { maxBytes: 1000 },
    );
    expect(result).toEqual({
      ok: false,
      error: "The calendar is too big (over 1 MB).",
    });
  });

  it("explains a network failure without leaking the address", async () => {
    const { result } = await run("https://example.com/c?secret=abc", {
      responses: [new Error("connect ECONNREFUSED 93.184.216.34:443")],
    });
    expect(result).toEqual({
      ok: false,
      error: "The calendar could not be reached.",
    });
  });

  it("gives up when time runs out between hops", async () => {
    let now = 0;
    const fake = fakeNetwork({
      responses: [{ status: 302, location: "/b" }, {}],
    });
    const fetchFeed = createFeedFetcher({
      network: {
        ...fake.network,
        get: async (request) => {
          now += 6000;
          return fake.network.get(request);
        },
      },
      timeoutMs: 5000,
      now: () => now,
    });
    expect(await fetchFeed("https://example.com/a")).toEqual({
      ok: false,
      error: "The calendar took too long to answer.",
    });
  });

  it("only lets loopback and http in when the test-only flag is on", async () => {
    const script = { responses: [{}] };
    const off = await run("http://127.0.0.1:8080/cal.ics", script);
    expect(off.result.ok).toBe(false);
    const on = await run("http://127.0.0.1:8080/cal.ics", script, {
      allowLocalForTests: true,
    });
    expect(on.result.ok).toBe(true);
    expect(on.calls[0].address).toBe("127.0.0.1");
  });
});

describe("nodeNetwork (against a local server, test flag on)", () => {
  let server: Server | undefined;
  afterEach(async () => {
    await new Promise((done) =>
      server ? server.close(done) : done(undefined),
    );
    server = undefined;
  });

  const serve = async (
    handler: Parameters<typeof createServer>[1],
  ): Promise<URL> => {
    server = createServer(handler);
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    return new URL(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/cal.ics`,
    );
  };
  const get = (
    url: URL,
    extra: { timeoutMs?: number; maxBytes?: number } = {},
  ) =>
    nodeNetwork().get({
      url,
      address: "127.0.0.1",
      timeoutMs: 2000,
      maxBytes: 1_000_000,
      ...extra,
    });

  it("reads status, headers and body", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/calendar" });
      res.end(FEED);
    });
    expect(await get(url)).toEqual({
      status: 200,
      contentType: "text/calendar",
      location: undefined,
      body: FEED,
    });
  });

  it("does not follow a redirect by itself", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(302, { Location: "http://127.0.0.1:1/elsewhere" });
      res.end();
    });
    const response = await get(url);
    expect(response.status).toBe(302);
    expect(response.location).toBe("http://127.0.0.1:1/elsewhere");
  });

  it("stops reading past the size limit", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200);
      res.write("x".repeat(5000));
      res.end("y".repeat(5000));
    });
    await expect(get(url, { maxBytes: 1000 })).rejects.toThrow("too big");
  });

  it("gives up on a server that does not answer", async () => {
    const url = await serve(() => {
      // never answers
    });
    await expect(get(url, { timeoutMs: 100 })).rejects.toThrow("timeout");
  });

  it("refuses a compressed answer it did not ask for", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { "Content-Encoding": "gzip" });
      res.end("x");
    });
    await expect(get(url)).rejects.toThrow("compressed");
  });

  it("is refused by the fetcher without the flag", async () => {
    const url = await serve((_req, res) => {
      res.end(FEED);
    });
    const strict = createFeedFetcher({ network: nodeNetwork() });
    expect((await strict(url.href)).ok).toBe(false);
    const loose = createFeedFetcher({
      network: nodeNetwork(),
      allowLocalForTests: true,
    });
    expect(await loose(url.href)).toEqual({ ok: true, text: FEED });
  });
});
