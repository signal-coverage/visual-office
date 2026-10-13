import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import { handleLayoutAdmin, MAX_LAYOUT_BODY_BYTES } from "./layoutAdmin.ts";
import { FloorLocks } from "./floorLocks.ts";
import { MemoryLayoutStore } from "./layoutStore.ts";

// Somewhere in the open office, so it raises no problems
const desk = { kind: "desk" as const, x: -3, z: 3, rotation: 0 as const };

describe("handleLayoutAdmin", () => {
  let layouts: MemoryLayoutStore;
  let locks: FloorLocks;
  let onPublished: ((floor: string, version: number) => void) | undefined;
  const call = (method: string, path: string, body?: unknown) =>
    handleLayoutAdmin(
      { method, path, body },
      { layouts, locks, knownFloors: ["office"], onPublished },
    );
  // Publishing needs the floor locked by whoever publishes: take it for them
  const asAuthor = async (method: string, path: string, body?: unknown) => {
    const author = (body as { author?: unknown } | null | undefined)?.author;
    if (typeof author === "string" && author) {
      const held = await locks.current("office");
      if (held && held.holder !== author)
        await locks.release("office", held.holder);
      await locks.acquire("office", author);
    }
    return call(method, path, body);
  };

  beforeEach(() => {
    layouts = new MemoryLayoutStore();
    locks = new FloorLocks();
    onPublished = undefined;
  });

  it("answers nothing for paths that are not about layouts", async () => {
    expect(await call("GET", "/health")).toBeNull();
    expect(await call("GET", "/admin/floors/office")).toBeNull();
    expect(await call("POST", "/admin/floors/office/lock")).toBeNull();
  });

  it("does not know floors that do not exist", async () => {
    expect((await call("GET", "/admin/floors/nowhere/layout"))?.status).toBe(
      404,
    );
  });

  it("says there is no layout yet, so the game can fall back to the default", async () => {
    expect((await call("GET", "/admin/floors/office/layout"))?.status).toBe(
      404,
    );
  });

  describe("publishing", () => {
    it("stores what was sent as the next version and says which", async () => {
      const reply = await asAuthor("POST", "/admin/floors/office/layout", {
        author: "ana",
        furniture: [desk],
        models: [],
      });
      expect(reply?.status).toBe(200);
      expect(reply?.body).toMatchObject({ version: 1, dropped: 0 });
      const current = await call("GET", "/admin/floors/office/layout");
      expect(current?.body).toMatchObject({
        version: 1,
        author: "ana",
        furniture: [desk],
      });
    });

    it("keeps only valid entries and says how many were left out", async () => {
      const reply = await asAuthor("POST", "/admin/floors/office/layout", {
        author: "ana",
        furniture: [desk, { kind: "spaceship", x: 1, z: 1, rotation: 0 }, 7],
        models: [{ model: "../../etc/passwd", at: [1, 1] }],
      });
      expect(reply?.body).toMatchObject({ dropped: 3 });
      expect((await layouts.current("office"))?.furniture).toEqual([desk]);
      expect((await layouts.current("office"))?.models).toEqual([]);
    });

    const insideAWall = {
      author: "ana",
      furniture: [{ kind: "desk", x: -50, z: -50, rotation: 0 }],
      models: [],
    };

    it("refuses a layout with problems (a piece inside a wall…) unless the author accepts them, and lists them", async () => {
      const reply = await asAuthor(
        "POST",
        "/admin/floors/office/layout",
        insideAWall,
      );
      expect(reply?.status).toBe(422);
      expect(reply?.body).toMatchObject({ needsConfirmation: true });
      expect((reply?.body.problems as string[]).length).toBeGreaterThan(0);
      expect(await layouts.current("office")).toBeNull();
    });

    it("stores a layout with problems once the author accepts them, and still lists them", async () => {
      const reply = await asAuthor("POST", "/admin/floors/office/layout", {
        ...insideAWall,
        acceptProblems: true,
      });
      expect(reply?.status).toBe(200);
      expect((reply?.body.problems as string[]).length).toBeGreaterThan(0);
      expect((await layouts.current("office"))?.version).toBe(1);
    });

    it("only takes a true as accepting", async () => {
      for (const acceptProblems of ["true", 1, "yes", null]) {
        const reply = await asAuthor("POST", "/admin/floors/office/layout", {
          ...insideAWall,
          acceptProblems,
        });
        expect(reply?.status, String(acceptProblems)).toBe(422);
      }
    });

    it("tells the rooms when a layout is stored, and not when it is refused", async () => {
      const told: Array<[string, number]> = [];
      onPublished = (floor, version) => told.push([floor, version]);
      await asAuthor("POST", "/admin/floors/office/layout", insideAWall);
      expect(told).toEqual([]);
      await asAuthor("POST", "/admin/floors/office/layout", {
        author: "ana",
        furniture: [desk],
        models: [],
      });
      expect(told).toEqual([["office", 1]]);
    });

    it("needs an author, and both lists", async () => {
      for (const body of [
        undefined,
        null,
        [],
        { furniture: [], models: [] },
        { author: "", furniture: [], models: [] },
        { author: "x".repeat(65), furniture: [], models: [] },
        { author: "ana", furniture: "no", models: [] },
        { author: "ana", furniture: [] },
      ]) {
        expect(
          (await asAuthor("POST", "/admin/floors/office/layout", body))?.status,
          JSON.stringify(body),
        ).toBe(400);
      }
      expect(await layouts.current("office")).toBeNull();
    });
  });

  describe("needs the floor to be closed by whoever publishes", () => {
    const body = { author: "ana", furniture: [], models: [] };

    it("refuses when nobody has locked the floor, so people could be inside", async () => {
      const reply = await call("POST", "/admin/floors/office/layout", body);
      expect(reply?.status).toBe(409);
      expect(await layouts.current("office")).toBeNull();
    });

    it("refuses when somebody else holds the lock", async () => {
      await locks.acquire("office", "beto");
      const reply = await call("POST", "/admin/floors/office/layout", body);
      expect(reply?.status).toBe(409);
      expect(reply?.body).toMatchObject({ heldBy: "beto" });
      expect(await layouts.current("office")).toBeNull();
    });

    it("accepts the one who holds it", async () => {
      await locks.acquire("office", "ana");
      expect(
        (await call("POST", "/admin/floors/office/layout", body))?.status,
      ).toBe(200);
    });

    it("also needs it to go back to an earlier version", async () => {
      await asAuthor("POST", "/admin/floors/office/layout", body);
      await locks.release("office", "ana");
      const reply = await call("POST", "/admin/floors/office/layout/revert", {
        author: "ana",
        version: 1,
      });
      expect(reply?.status).toBe(409);
    });
  });

  describe("history", () => {
    beforeEach(async () => {
      await asAuthor("POST", "/admin/floors/office/layout", {
        author: "ana",
        furniture: [desk],
        models: [],
      });
      await asAuthor("POST", "/admin/floors/office/layout", {
        author: "beto",
        furniture: [],
        models: [],
      });
    });

    it("lists the versions, newest first", async () => {
      const reply = await call("GET", "/admin/floors/office/layout/versions");
      const versions = reply?.body.versions as Array<{ version: number }>;
      expect(versions.map((v) => v.version)).toEqual([2, 1]);
    });

    it("gives one old version in full", async () => {
      const reply = await call("GET", "/admin/floors/office/layout/versions/1");
      expect(reply?.body).toMatchObject({ version: 1, furniture: [desk] });
    });

    it("says when a version does not exist, or is not a number", async () => {
      expect(
        (await call("GET", "/admin/floors/office/layout/versions/9"))?.status,
      ).toBe(404);
      expect(
        (await call("GET", "/admin/floors/office/layout/versions/abc"))?.status,
      ).toBe(404);
    });
  });

  describe("going back to an earlier version", () => {
    it("publishes it again as a new version, so the history stays whole", async () => {
      await asAuthor("POST", "/admin/floors/office/layout", {
        author: "ana",
        furniture: [desk],
        models: [],
      });
      await asAuthor("POST", "/admin/floors/office/layout", {
        author: "beto",
        furniture: [],
        models: [],
      });
      const reply = await asAuthor(
        "POST",
        "/admin/floors/office/layout/revert",
        {
          author: "ana",
          version: 1,
        },
      );
      expect(reply?.body).toMatchObject({ version: 3, revertedTo: 1 });
      expect((await layouts.current("office"))?.furniture).toEqual([desk]);
      expect((await layouts.history("office")).length).toBe(3);
    });

    it("refuses a version that does not exist", async () => {
      const reply = await asAuthor(
        "POST",
        "/admin/floors/office/layout/revert",
        {
          author: "ana",
          version: 4,
        },
      );
      expect(reply?.status).toBe(404);
    });

    it("needs a whole number version and an author", async () => {
      for (const body of [
        { author: "ana" },
        { author: "ana", version: 1.5 },
        { author: "ana", version: "1" },
        { version: 1 },
      ]) {
        expect(
          (await asAuthor("POST", "/admin/floors/office/layout/revert", body))
            ?.status,
          JSON.stringify(body),
        ).toBe(400);
      }
    });
  });

  describe("known-good versions", () => {
    const publish = (author: string, furniture: unknown[]) =>
      asAuthor("POST", "/admin/floors/office/layout", {
        author,
        furniture,
        models: [],
      });

    it("marks a version as good, which the history then shows", async () => {
      await publish("ana", [desk]);
      await publish("ana", []);
      const reply = await call(
        "POST",
        "/admin/floors/office/layout/versions/1/good",
        {
          author: "ana",
        },
      );
      expect(reply?.status).toBe(200);
      const versions = (
        await call("GET", "/admin/floors/office/layout/versions")
      )?.body.versions as Array<{ version: number; good: boolean }>;
      expect(versions.map((v) => [v.version, v.good])).toEqual([
        [2, false],
        [1, true],
      ]);
    });

    it("does not need the floor closed, since it changes nothing people see", async () => {
      await publish("ana", [desk]);
      await locks.release("office", "ana");
      expect(
        (
          await call("POST", "/admin/floors/office/layout/versions/1/good", {
            author: "beto",
          })
        )?.status,
      ).toBe(200);
    });

    it("needs an author, an existing version, and a version that is a number", async () => {
      await publish("ana", [desk]);
      expect(
        (await call("POST", "/admin/floors/office/layout/versions/1/good", {}))
          ?.status,
      ).toBe(400);
      expect(
        (
          await call("POST", "/admin/floors/office/layout/versions/9/good", {
            author: "ana",
          })
        )?.status,
      ).toBe(404);
      expect(
        (
          await call("POST", "/admin/floors/office/layout/versions/abc/good", {
            author: "ana",
          })
        )?.status,
      ).toBe(404);
    });

    it("goes back to the last good version, whatever was published after it", async () => {
      await publish("ana", [desk]);
      await call("POST", "/admin/floors/office/layout/versions/1/good", {
        author: "ana",
      });
      await publish("ana", []);
      await publish("ana", [desk, { kind: "chair", x: 3, z: 3, rotation: 0 }]);
      const reply = await asAuthor(
        "POST",
        "/admin/floors/office/layout/revert",
        {
          author: "ana",
          version: "good",
        },
      );
      expect(reply?.body).toMatchObject({ version: 4, revertedTo: 1 });
      expect((await layouts.current("office"))?.furniture).toEqual([desk]);
    });

    it("says so when no version was ever marked", async () => {
      await publish("ana", [desk]);
      const reply = await asAuthor(
        "POST",
        "/admin/floors/office/layout/revert",
        {
          author: "ana",
          version: "good",
        },
      );
      expect(reply?.status).toBe(404);
      expect(reply?.body.error).toMatch(/good/i);
    });

    it("also asks for confirmation to go back to a version that has problems", async () => {
      await layouts.publish(
        "office",
        {
          furniture: [{ kind: "desk", x: -50, z: -50, rotation: 0 }],
          models: [],
        },
        "ana",
      );
      const body = { author: "ana", version: 1 };
      expect(
        (await asAuthor("POST", "/admin/floors/office/layout/revert", body))
          ?.status,
      ).toBe(422);
      expect(
        (
          await asAuthor("POST", "/admin/floors/office/layout/revert", {
            ...body,
            acceptProblems: true,
          })
        )?.status,
      ).toBe(200);
    });

    it("tells the rooms when going back publishes a version", async () => {
      const told: Array<[string, number]> = [];
      await publish("ana", [desk]);
      await publish("ana", []);
      onPublished = (floor, version) => told.push([floor, version]);
      await asAuthor("POST", "/admin/floors/office/layout/revert", {
        author: "ana",
        version: 1,
      });
      expect(told).toEqual([["office", 3]]);
    });
  });

  it("only answers the methods it knows", async () => {
    expect((await call("DELETE", "/admin/floors/office/layout"))?.status).toBe(
      405,
    );
    expect(
      (await call("GET", "/admin/floors/office/layout/revert"))?.status,
    ).toBe(405);
  });

  it("says so when the database cannot be reached", async () => {
    layouts.current = async () => {
      throw new Error("connection refused");
    };
    expect((await call("GET", "/admin/floors/office/layout"))?.status).toBe(
      503,
    );
  });

  it("allows a layout body that is large, but not unlimited", () => {
    expect(MAX_LAYOUT_BODY_BYTES).toBeGreaterThan(100_000);
    expect(MAX_LAYOUT_BODY_BYTES).toBeLessThanOrEqual(2_000_000);
  });
});

describe("handleLayoutAdmin, for a person who signed in", () => {
  const person = (
    roles: { admin?: boolean; headOf?: string[] },
    id = "user_ana",
  ): Actor => ({
    kind: "user",
    user: { id, email: null, name: "Ana", isAdmin: !!roles.admin },
    roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
  });
  const head: Actor = person({ headOf: ["office"] });
  let layouts: MemoryLayoutStore;
  let locks: FloorLocks;
  const call = (actor: Actor, method: string, path: string, body?: unknown) =>
    handleLayoutAdmin(
      { method, path, body, actor },
      { layouts, locks, knownFloors: ["office"] },
    );
  const layout = { furniture: [desk], models: [] };

  beforeEach(() => {
    layouts = new MemoryLayoutStore();
    locks = new FloorLocks();
  });

  it("lets the head publish while they have the floor closed, signed as themselves", async () => {
    await locks.acquire("office", "user_ana");
    const reply = await call(
      head,
      "POST",
      "/admin/floors/office/layout",
      layout,
    );
    expect(reply?.status).toBe(200);
    expect((await layouts.current("office"))?.author).toBe("user_ana");
  });

  it("ignores the author the request claims: it is who the token says", async () => {
    await locks.acquire("office", "user_ana");
    await call(head, "POST", "/admin/floors/office/layout", {
      ...layout,
      author: "somebody-else",
    });
    expect((await layouts.current("office"))?.author).toBe("user_ana");
  });

  it("still needs the floor closed by them, like anybody", async () => {
    const reply = await call(
      head,
      "POST",
      "/admin/floors/office/layout",
      layout,
    );
    expect(reply?.status).toBe(409);
  });

  it("refuses somebody who is not its head, and stores nothing", async () => {
    for (const roles of [{}, { headOf: ["another-floor"] }]) {
      const reply = await call(
        person(roles),
        "POST",
        "/admin/floors/office/layout",
        layout,
      );
      expect(reply?.status).toBe(403);
    }
    expect(await layouts.current("office")).toBeNull();
  });

  it("lets an admin publish on any floor", async () => {
    await locks.acquire("office", "user_boss");
    const reply = await call(
      person({ admin: true }, "user_boss"),
      "POST",
      "/admin/floors/office/layout",
      layout,
    );
    expect(reply?.status).toBe(200);
  });

  it("lets the head vouch for a version, and refuses a member", async () => {
    await layouts.publish("office", layout, "user_ana");
    const path = "/admin/floors/office/layout/versions/1/good";
    expect((await call(person({}), "POST", path))?.status).toBe(403);
    expect((await call(head, "POST", path))?.status).toBe(200);
    expect((await layouts.history("office"))[0].good).toBe(true);
  });

  it("lets the head go back to an earlier version, and refuses a member", async () => {
    await layouts.publish("office", layout, "user_ana");
    await layouts.publish("office", { furniture: [], models: [] }, "user_ana");
    await locks.acquire("office", "user_ana");
    const path = "/admin/floors/office/layout/revert";
    expect((await call(person({}), "POST", path, { version: 1 }))?.status).toBe(
      403,
    );
    const reply = await call(head, "POST", path, { version: 1 });
    expect(reply?.body).toMatchObject({ version: 3, revertedTo: 1 });
  });

  it("lets any signed-in person read the layout and its history", async () => {
    await layouts.publish("office", layout, "user_ana");
    const member = person({}, "user_eve");
    for (const path of [
      "/admin/floors/office/layout",
      "/admin/floors/office/layout/versions",
      "/admin/floors/office/layout/versions/1",
    ])
      expect((await call(member, "GET", path))?.status, path).toBe(200);
  });
});
