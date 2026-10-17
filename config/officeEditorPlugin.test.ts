import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  exportPublished,
  floorRouteOf,
  forwardFloor,
  isLocalHost,
  listModelFiles,
  MAX_BODY_BYTES,
  MAX_MODEL_BYTES,
  saveModelFile,
  saveOffice,
  validateGlb,
} from "./officeEditorPlugin.ts";

const desk = { kind: "desk", x: 1, z: 2, rotation: 0 };
const shelf = { model: "shelf.glb", at: [4, -6], footprint: [1.6, 0.4] };

function deps() {
  const written: string[] = [];
  return {
    written,
    format: async (source: string) => `/* formatted */\n${source}`,
    write: async (text: string) => {
      written.push(text);
    },
  };
}

describe("saveOffice", () => {
  it("writes the layout and says how much it saved", async () => {
    const d = deps();
    const result = await saveOffice(
      JSON.stringify({ furniture: [desk], models: [shelf] }),
      d,
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      saved: true,
      furniture: 1,
      models: 1,
      dropped: 0,
    });
    expect(d.written).toHaveLength(1);
    expect(d.written[0]).toContain("/* formatted */");
    expect(d.written[0]).toContain('"desk"');
  });

  it("tells how many entries it left out because they were not valid", async () => {
    const d = deps();
    const result = await saveOffice(
      JSON.stringify({
        furniture: [desk, { kind: "spaceship", x: 0, z: 0 }],
        models: [shelf, { model: "../x.glb", at: [0, 0] }],
      }),
      d,
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ furniture: 1, models: 1, dropped: 2 });
  });

  it("refuses text that is not JSON, and writes nothing", async () => {
    const d = deps();
    const result = await saveOffice("{nope", d);
    expect(result.status).toBe(400);
    expect(d.written).toEqual([]);
  });

  it("refuses a body without both lists", async () => {
    for (const body of [
      "[]",
      "null",
      "{}",
      JSON.stringify({ furniture: [] }),
      JSON.stringify({ furniture: 5, models: [] }),
    ]) {
      const d = deps();
      expect((await saveOffice(body, d)).status, body).toBe(400);
      expect(d.written).toEqual([]);
    }
  });

  it("refuses a body that is too large", async () => {
    const d = deps();
    const result = await saveOffice("x".repeat(MAX_BODY_BYTES + 1), d);
    expect(result.status).toBe(413);
    expect(d.written).toEqual([]);
  });

  it("reports a failure to write instead of crashing the dev server", async () => {
    const result = await saveOffice(
      JSON.stringify({ furniture: [], models: [] }),
      {
        format: async (s) => s,
        write: async () => {
          throw new Error("disk full");
        },
      },
    );
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).toContain("disk full");
  });
});

/** The smallest well-formed GLB: a header and one JSON chunk. */
function glb(
  json: unknown = { asset: { version: "2.0" } },
  tweak: (view: DataView, bytes: Uint8Array) => void = () => {},
): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += " "; // chunks are padded to 4 bytes
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(12 + 8 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  bytes.set(body, 20);
  tweak(view, bytes);
  return bytes;
}

describe("exportPublished", () => {
  const published = (reply: {
    status: number;
    body: Record<string, unknown>;
  }) => ({
    read: async () => reply,
  });

  it("writes the published layout to the file, which becomes the default, and says which version", async () => {
    const d = deps();
    const result = await exportPublished(
      published({
        status: 200,
        body: { version: 7, furniture: [desk], models: [shelf] },
      }),
      d,
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ exported: true, version: 7 });
    expect(d.written).toHaveLength(1);
    expect(d.written[0]).toContain('"desk"');
    expect(d.written[0]).toContain("shelf.glb");
  });

  it("says there is nothing to export when nothing was published, and writes nothing", async () => {
    const d = deps();
    const result = await exportPublished(
      published({
        status: 404,
        body: { error: "This floor has no stored layout." },
      }),
      d,
    );
    expect(result.status).toBe(404);
    expect(String(result.body.error)).toMatch(/published|stored/i);
    expect(d.written).toEqual([]);
  });

  it("passes on why the game server could not give it, and writes nothing", async () => {
    const d = deps();
    const result = await exportPublished(
      published({
        status: 502,
        body: { error: "did not answer", unreachable: true },
      }),
      d,
    );
    expect(result.status).toBe(502);
    expect(d.written).toEqual([]);
  });

  it("leaves out anything malformed in what it was given, as saving does", async () => {
    const d = deps();
    const result = await exportPublished(
      published({
        status: 200,
        body: {
          version: 1,
          furniture: [desk, { kind: "spaceship", x: 0, z: 0 }],
          models: [],
        },
      }),
      d,
    );
    expect(result.body).toMatchObject({ furniture: 1, dropped: 1 });
  });

  it("reports a failure to write", async () => {
    const result = await exportPublished(
      published({
        status: 200,
        body: { version: 1, furniture: [], models: [] },
      }),
      {
        format: async (s) => s,
        write: async () => {
          throw new Error("disk full");
        },
      },
    );
    expect(result.status).toBe(500);
  });
});

describe("validateGlb", () => {
  it("accepts a well-formed GLB", () => {
    expect(validateGlb(glb())).toBeNull();
  });

  it("refuses something that is not a GLB at all", () => {
    expect(
      validateGlb(new TextEncoder().encode("<html>hello</html>")),
    ).not.toBeNull();
    expect(validateGlb(new Uint8Array(0))).not.toBeNull();
    expect(validateGlb(new Uint8Array(10))).not.toBeNull();
  });

  it("refuses a different version of the format", () => {
    expect(validateGlb(glb(undefined, (v) => v.setUint32(4, 1, true)))).toMatch(
      /version/i,
    );
  });

  it("refuses a file that is cut short or has something added after it", () => {
    const whole = glb();
    expect(validateGlb(whole.slice(0, whole.length - 4))).toMatch(
      /size|complete|length/i,
    );
    const longer = new Uint8Array(whole.length + 8);
    longer.set(whole);
    expect(validateGlb(longer)).toMatch(/size|complete|length/i);
  });

  it("refuses a first chunk that is not the JSON one", () => {
    expect(
      validateGlb(glb(undefined, (v) => v.setUint32(16, 0x004e4942, true))),
    ).not.toBeNull();
  });

  it("refuses a JSON chunk that claims to be longer than the file", () => {
    expect(
      validateGlb(glb(undefined, (v) => v.setUint32(12, 9999, true))),
    ).not.toBeNull();
  });

  it("refuses a JSON chunk that is not JSON", () => {
    const bytes = glb();
    bytes.set(new TextEncoder().encode("{{{{"), 20);
    expect(validateGlb(bytes)).not.toBeNull();
  });

  it("refuses glTF data that is not version 2", () => {
    expect(validateGlb(glb({ asset: { version: "1.0" } }))).not.toBeNull();
    expect(validateGlb(glb({}))).not.toBeNull();
  });
});

describe("saveModelFile", () => {
  function files(existing: string[] = []) {
    const written = new Map<string, Uint8Array>();
    return {
      written,
      exists: async (name: string) =>
        existing.includes(name) || written.has(name),
      write: async (name: string, bytes: Uint8Array) => {
        written.set(name, bytes);
      },
    };
  }

  it("saves a model under the name it was given", async () => {
    const f = files();
    const bytes = glb();
    const result = await saveModelFile("sofa.glb", bytes, false, f);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ saved: true, name: "sofa.glb" });
    expect(f.written.get("sofa.glb")).toEqual(bytes);
  });

  it("refuses a name that could reach outside the models folder, or that is not a .glb", async () => {
    for (const name of ["../sofa.glb", "a/b.glb", "sofa.png", "", ".glb"]) {
      const f = files();
      const result = await saveModelFile(name, glb(), false, f);
      expect(result.status, name).toBe(400);
      expect(f.written.size).toBe(0);
    }
  });

  it("refuses something that is not a GLB, whatever its name says", async () => {
    const f = files();
    const result = await saveModelFile(
      "sofa.glb",
      new TextEncoder().encode("not a model"),
      false,
      f,
    );
    expect(result.status).toBe(400);
    expect(f.written.size).toBe(0);
  });

  it("refuses a file that is too large", async () => {
    const f = files();
    const huge = new Uint8Array(MAX_MODEL_BYTES + 1);
    const result = await saveModelFile("sofa.glb", huge, false, f);
    expect(result.status).toBe(413);
    expect(f.written.size).toBe(0);
  });

  it("does not replace a model that is already there, unless told to", async () => {
    const f = files(["sofa.glb"]);
    const refused = await saveModelFile("sofa.glb", glb(), false, f);
    expect(refused.status).toBe(409);
    expect(f.written.size).toBe(0);

    const replaced = await saveModelFile("sofa.glb", glb(), true, f);
    expect(replaced.status).toBe(200);
    expect(f.written.has("sofa.glb")).toBe(true);
  });

  it("reports a failure to write instead of crashing", async () => {
    const result = await saveModelFile("sofa.glb", glb(), false, {
      exists: async () => false,
      write: async () => {
        throw new Error("disk full");
      },
    });
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).toContain("disk full");
  });
});

describe("forwardFloor", () => {
  function fakeServer(answer: { status: number; body: unknown } | Error): {
    calls: Array<{ url: string; init: RequestInit }>;
    fetch: typeof fetch;
  } {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    return {
      calls,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (answer instanceof Error) throw answer;
        return new Response(JSON.stringify(answer.body), {
          status: answer.status,
        });
      }) as typeof fetch,
    };
  }
  const base = "http://localhost:2567";

  it("asks the game server to lock the floor, saying who is editing", async () => {
    const server = fakeServer({ status: 200, body: { locked: true } });
    const reply = await forwardFloor(
      "lock",
      { holder: "me", graceSeconds: 5 },
      { fetch: server.fetch, baseUrl: base },
    );
    expect(reply).toEqual({ status: 200, body: { locked: true } });
    expect(server.calls[0].url).toBe(`${base}/admin/floors/office/lock`);
    expect(server.calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(server.calls[0].init.body))).toEqual({
      holder: "me",
      graceSeconds: 5,
    });
  });

  it("talks about another room when told which", async () => {
    const server = fakeServer({ status: 200, body: { locked: true } });
    await forwardFloor(
      "lock",
      { holder: "me" },
      { fetch: server.fetch, baseUrl: base, floor: "marketing" },
    );
    expect(server.calls[0].url).toBe(`${base}/admin/floors/marketing/lock`);
  });

  it("asks how the floor is with a GET and no body", async () => {
    const server = fakeServer({ status: 200, body: { locked: false } });
    await forwardFloor("status", undefined, {
      fetch: server.fetch,
      baseUrl: base,
    });
    expect(server.calls[0].url).toBe(`${base}/admin/floors/office`);
    expect(server.calls[0].init.method).toBe("GET");
    expect(server.calls[0].init.body).toBeUndefined();
  });

  it("reads the stored layout with a GET", async () => {
    const server = fakeServer({ status: 200, body: { version: 3 } });
    const reply = await forwardFloor("layout", undefined, {
      fetch: server.fetch,
      baseUrl: base,
    });
    expect(reply.body).toEqual({ version: 3 });
    expect(server.calls[0].url).toBe(`${base}/admin/floors/office/layout`);
    expect(server.calls[0].init.method).toBe("GET");
    expect(server.calls[0].init.body).toBeUndefined();
  });

  it("publishes a layout with a POST to the same address", async () => {
    const server = fakeServer({ status: 200, body: { version: 4 } });
    await forwardFloor(
      "publish",
      { author: "me", furniture: [], models: [] },
      { fetch: server.fetch, baseUrl: base },
    );
    expect(server.calls[0].url).toBe(`${base}/admin/floors/office/layout`);
    expect(server.calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(server.calls[0].init.body))).toEqual({
      author: "me",
      furniture: [],
      models: [],
    });
  });

  it("brings the admin token when there is one, and never when there is not", async () => {
    const withToken = fakeServer({ status: 200, body: {} });
    await forwardFloor(
      "heartbeat",
      { holder: "me" },
      { fetch: withToken.fetch, baseUrl: base, token: "s3cret" },
    );
    expect(
      (withToken.calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer s3cret");

    const without = fakeServer({ status: 200, body: {} });
    await forwardFloor(
      "heartbeat",
      { holder: "me" },
      { fetch: without.fetch, baseUrl: base },
    );
    expect(
      (without.calls[0].init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("passes on what the game server answers, refusals included", async () => {
    const server = fakeServer({
      status: 409,
      body: { error: "ana is already editing this floor.", heldBy: "ana" },
    });
    const reply = await forwardFloor(
      "lock",
      { holder: "me" },
      { fetch: server.fetch, baseUrl: base },
    );
    expect(reply.status).toBe(409);
    expect(reply.body).toMatchObject({ heldBy: "ana" });
  });

  it("says the game server cannot be reached, so the editor can decide what to do", async () => {
    const server = fakeServer(new Error("connect ECONNREFUSED"));
    const reply = await forwardFloor(
      "lock",
      { holder: "me" },
      { fetch: server.fetch, baseUrl: base },
    );
    expect(reply.status).toBe(502);
    expect(reply.body).toMatchObject({ unreachable: true });
  });

  it("copes with an answer that is not JSON", async () => {
    const reply = await forwardFloor(
      "lock",
      { holder: "me" },
      {
        baseUrl: base,
        fetch: (async () =>
          new Response("<html>oops</html>", { status: 500 })) as typeof fetch,
      },
    );
    expect(reply.status).toBe(502);
  });

  it("does not wait forever for a game server that does not answer", async () => {
    const reply = await forwardFloor(
      "lock",
      { holder: "me" },
      {
        baseUrl: base,
        timeoutMs: 20,
        fetch: ((_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          })) as typeof fetch,
      },
    );
    expect(reply.status).toBe(502);
    expect(reply.body).toMatchObject({ unreachable: true });
  });
});

describe("floorRouteOf", () => {
  it("knows the routes of the main office, as they always were", () => {
    expect(floorRouteOf("/floor/lock")).toEqual({
      action: "lock",
      floor: undefined,
    });
    expect(floorRouteOf("/floor/layout")).toEqual({
      action: "layout",
      floor: undefined,
    });
  });

  it("knows the routes of a room", () => {
    expect(floorRouteOf("/floors/marketing/publish")).toEqual({
      action: "publish",
      floor: "marketing",
    });
  });

  it("does not take an id that is not a room's, or an action that is not one", () => {
    expect(floorRouteOf("/floors/Not Valid/lock")).toBeNull();
    expect(floorRouteOf("/floors/../lock")).toBeNull();
    expect(floorRouteOf("/floors/admin/lock")).toBeNull();
    expect(floorRouteOf("/floor/delete")).toBeNull();
    expect(floorRouteOf("/floors/marketing/lock/extra")).toBeNull();
  });
});

describe("isLocalHost", () => {
  it("accepts this machine, with or without a port", () => {
    for (const host of [
      "localhost",
      "localhost:5173",
      "127.0.0.1:5173",
      "[::1]:5173",
    ]) {
      expect(isLocalHost(host), host).toBe(true);
    }
  });

  it("refuses anything else, including look-alikes", () => {
    for (const host of [
      undefined,
      "",
      "example.com",
      "localhost.evil.com",
      "evil.com:5173",
      "192.168.1.20:5173",
      "127.0.0.1.evil.com",
    ]) {
      expect(isLocalHost(host), String(host)).toBe(false);
    }
  });
});

describe("listModelFiles", () => {
  it("lists the .glb files in a folder, by name, and nothing else", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "models-"));
    try {
      for (const name of [
        "sofa.glb",
        "bookshelf.glb",
        "notes.txt",
        "bad name.glb",
        "image.png",
      ])
        await writeFile(path.join(dir, name), "x");
      expect(await listModelFiles(dir)).toEqual(["bookshelf.glb", "sofa.glb"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty list when the folder is not there", async () => {
    expect(
      await listModelFiles(path.join(tmpdir(), "nope-" + Date.now())),
    ).toEqual([]);
  });
});
