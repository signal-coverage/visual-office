import { describe, expect, it } from "vitest";
import { devBackend, gameBackend, httpUrlOf } from "./backend";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(answer: unknown = { ok: true }) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer));
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

describe("httpUrlOf", () => {
  it("turns the game server's websocket address into its web address", () => {
    expect(httpUrlOf("ws://localhost:2567")).toBe("http://localhost:2567");
    expect(httpUrlOf("wss://office.example.com")).toBe(
      "https://office.example.com",
    );
  });

  it("drops a trailing slash and keeps an address that is already web", () => {
    expect(httpUrlOf("wss://office.example.com/")).toBe(
      "https://office.example.com",
    );
    expect(httpUrlOf("https://office.example.com")).toBe(
      "https://office.example.com",
    );
  });
});

describe("devBackend", () => {
  it("talks to the development server's own editor endpoints", () => {
    const backend = devBackend();
    expect(backend.floorBase).toBe("/__editor/floor");
    expect(backend.layoutUrl).toBe("/__editor/floor/layout");
    expect(backend.publishUrl).toBe("/__editor/floor/publish");
  });

  it("can edit another room, through its own routes", () => {
    const backend = devBackend("marketing");
    expect(backend.floorBase).toBe("/__editor/floors/marketing");
    expect(backend.layoutUrl).toBe("/__editor/floors/marketing/layout");
    expect(backend.publishUrl).toBe("/__editor/floors/marketing/publish");
    expect(backend.floor).toBe("marketing");
    expect(devBackend().floor).toBeUndefined();
  });

  it("has the tools that only make sense on a developer's machine", () => {
    expect(devBackend().devTools).toBe(true);
  });
});

describe("gameBackend", () => {
  const make = (answer?: unknown, token: string | null = "tok-1") => {
    const { calls, fetcher } = fakeFetch(answer);
    const backend = gameBackend({
      serverUrl: "wss://office.example.com",
      floor: "office",
      getToken: async () => token,
      models: ["bookshelf.glb", "plant.glb"],
      fetch: fetcher,
    });
    return { backend, calls };
  };

  it("talks to the game server's admin API for that floor", () => {
    const { backend } = make();
    expect(backend.floorBase).toBe(
      "https://office.example.com/admin/floors/office",
    );
    expect(backend.layoutUrl).toBe(
      "https://office.example.com/admin/floors/office/layout",
    );
    expect(backend.publishUrl).toBe(backend.layoutUrl);
  });

  it("has no tools that write to the developer's files", () => {
    expect(make().backend.devTools).toBe(false);
  });

  it("proves who is asking with a fresh token on every call", async () => {
    const { backend, calls } = make();
    await backend.request(backend.layoutUrl);
    expect(new Headers(calls[0].init?.headers).get("Authorization")).toBe(
      "Bearer tok-1",
    );
  });

  it("keeps the headers the caller asked for", async () => {
    const { backend, calls } = make();
    await backend.request(backend.publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tok-1");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("does not pretend to be signed in when there is no token", async () => {
    const { backend, calls } = make(undefined, null);
    await backend.request(backend.layoutUrl);
    expect(new Headers(calls[0].init?.headers).has("Authorization")).toBe(
      false,
    );
  });

  it("lists the models that came with the build", async () => {
    expect(await make().backend.listModels()).toEqual([
      "bookshelf.glb",
      "plant.glb",
    ]);
  });

  it("opens the floor on the way out with the last token it used, since a page that is closing cannot ask for one", async () => {
    const { backend, calls } = make();
    await backend.request(backend.layoutUrl);
    calls.length = 0;
    expect(backend.beacon(`${backend.floorBase}/unlock`, { holder: "x" })).toBe(
      true,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://office.example.com/admin/floors/office/unlock",
    );
    expect(calls[0].init?.keepalive).toBe(true);
    expect(calls[0].init?.method).toBe("POST");
    expect(new Headers(calls[0].init?.headers).get("Authorization")).toBe(
      "Bearer tok-1",
    );
  });

  it("does not send anything on the way out when it never had a token", () => {
    const { backend, calls } = make(undefined, null);
    expect(backend.beacon(`${backend.floorBase}/unlock`, {})).toBe(false);
    expect(calls).toEqual([]);
  });
});
