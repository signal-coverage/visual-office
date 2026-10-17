import { beforeEach, describe, expect, it } from "vitest";
import { CONTENT_LIMITS } from "../shared/content.ts";
import type { Actor } from "./actor.ts";
import type { AuditInput } from "./auditStore.ts";
import { handleContentAdmin } from "./contentAdmin.ts";
import { MemoryContentStore } from "./contentStore.ts";
import { MemoryFloorStore } from "./floorStore.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_x", email: null, name: "Xena", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const admin = person({ admin: true });
const headOfHr = person({ headOf: ["hr"] });
const member = person({});
const machine: Actor = { kind: "machine" };

interface Body {
  error?: string;
  errors?: Record<string, string>;
  [key: string]: unknown;
}

describe("handleContentAdmin", () => {
  let content: MemoryContentStore;
  let floors: MemoryFloorStore;
  let audit: AuditInput[];
  let ids = 0;

  const call = async (
    actor: Actor | undefined,
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ) => {
    const reply = await handleContentAdmin(
      { method, path, body, query, actor },
      { content, floors, audit: async (entry) => void audit.push(entry) },
    );
    return reply && { status: reply.status, body: reply.body as Body };
  };
  const create = (actor: Actor | undefined, body: unknown) =>
    call(actor, "POST", "/admin/content", body);
  const book = { floor: "hr", kind: "book", title: "Handbook", body: "Text" };

  beforeEach(async () => {
    ids = 0;
    content = new MemoryContentStore(
      () => 1000 + ids,
      () => `id${++ids}`,
    );
    floors = new MemoryFloorStore(() => 1);
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "lab", name: "Lab" });
    audit = [];
  });

  it("answers nothing for paths that are not about content", async () => {
    expect(await call(admin, "GET", "/admin/people")).toBeNull();
    expect(await call(admin, "GET", "/admin/contents")).toBeNull();
    expect(await call(admin, "GET", "/admin/content/a/b/c")).toBeNull();
    expect(await call(admin, "POST", "/admin/content/a/other")).toBeNull();
  });

  describe("who may", () => {
    it("asks everybody to sign in", async () => {
      expect((await create(undefined, book))?.status).toBe(401);
      expect((await call(undefined, "GET", "/admin/content"))?.status).toBe(
        401,
      );
      expect(
        (await call(undefined, "POST", "/admin/content/id1/delete"))?.status,
      ).toBe(401);
    });

    it("lets an admin, and the server's own tools, write anywhere", async () => {
      expect((await create(admin, book))?.status).toBe(201);
      expect((await create(machine, { ...book, floor: "lab" }))?.status).toBe(
        201,
      );
    });

    it("lets the head of a floor write on their floor, not on another", async () => {
      expect((await create(headOfHr, book))?.status).toBe(201);
      const other = await create(headOfHr, { ...book, floor: "lab" });
      expect(other?.status).toBe(403);
      expect(await content.list("lab")).toEqual([]);
    });

    it("does not let anybody else write, change or delete", async () => {
      expect((await create(member, book))?.status).toBe(403);
      await create(admin, book);
      expect(
        (await call(member, "POST", "/admin/content/id1", { title: "X" }))
          ?.status,
      ).toBe(403);
      expect(
        (await call(member, "POST", "/admin/content/id1/delete"))?.status,
      ).toBe(403);
      expect(
        (await call(headOfHr, "POST", "/admin/content/id1", { title: "Mine" }))
          ?.status,
      ).toBe(200);
      expect((await content.get("id1"))?.title).toBe("Mine");
      expect(
        await call(member, "GET", "/admin/content", undefined, {}),
      ).toMatchObject({ status: 403 });
      expect(
        (
          await call(member, "GET", "/admin/content", undefined, {
            floor: "hr",
          })
        )?.status,
      ).toBe(403);
    });

    it("keeps a head from touching another floor's item by its id", async () => {
      await create(admin, { ...book, floor: "lab" });
      expect(
        (await call(headOfHr, "POST", "/admin/content/id1", { title: "No" }))
          ?.status,
      ).toBe(403);
      expect(
        (await call(headOfHr, "POST", "/admin/content/id1/delete"))?.status,
      ).toBe(403);
      expect((await content.get("id1"))?.title).toBe("Handbook");
    });
  });

  describe("what a person may edit", () => {
    it("does not offer an archived room, for its content cannot be seen by anybody", async () => {
      await floors.archive("lab");
      const reply = await call(admin, "GET", "/admin/content");
      expect(
        (reply?.body.floors as Array<{ id: string }>).map((f) => f.id),
      ).toEqual(["office", "hr"]);
    });

    it("lists every floor for an admin and for the server's own tools", async () => {
      const expected = [
        { id: "office", name: "Main office" },
        { id: "hr", name: "People" },
        { id: "lab", name: "Lab" },
      ];
      expect((await call(admin, "GET", "/admin/content"))?.body).toEqual({
        floors: expected,
      });
      expect((await call(machine, "GET", "/admin/content"))?.body).toEqual({
        floors: expected,
      });
    });

    it("lists only their own floors for a head, and none that does not exist", async () => {
      const ghost = person({ headOf: ["hr", "ghost"] });
      expect((await call(ghost, "GET", "/admin/content"))?.body).toEqual({
        floors: [{ id: "hr", name: "People" }],
      });
    });
  });

  describe("creating", () => {
    it("makes a book and answers with it", async () => {
      const reply = await create(admin, {
        ...book,
        author: "Ana",
        link: "https://example.com/x",
      });
      expect(reply?.status).toBe(201);
      expect(reply?.body.item).toMatchObject({
        id: "id1",
        floor: "hr",
        kind: "book",
        title: "Handbook",
        author: "Ana",
        body: "Text",
        link: "https://example.com/x",
        pinned: false,
      });
      expect(await content.list("hr")).toHaveLength(1);
    });

    it("makes an announcement, pinned", async () => {
      const reply = await create(admin, {
        floor: "hr",
        kind: "announcement",
        title: "Party",
        body: "Friday",
        pinned: true,
      });
      expect(reply?.status).toBe(201);
      expect(reply?.body.item).toMatchObject({
        kind: "announcement",
        pinned: true,
      });
    });

    it("cleans what it is given", async () => {
      const reply = await create(admin, {
        ...book,
        title: "  A\u0000 B  ",
        body: "x\r\ny",
      });
      expect(reply?.body.item).toMatchObject({ title: "A B", body: "x\ny" });
    });

    it("refuses a body that is not an object, or without a floor or a kind", async () => {
      for (const body of [undefined, null, [], "x", 5])
        expect((await create(admin, body))?.status).toBe(400);
      expect((await create(admin, { kind: "book", title: "T" }))?.status).toBe(
        400,
      );
      expect((await create(admin, { floor: "hr", title: "T" }))?.status).toBe(
        400,
      );
      expect(
        (await create(admin, { floor: "hr", kind: "poster", title: "T" }))
          ?.status,
      ).toBe(400);
      expect(
        (await create(admin, { floor: 7, kind: "book", title: "T" }))?.status,
      ).toBe(400);
    });

    it("refuses what breaks the limits, saying which field", async () => {
      const bad = await create(admin, { ...book, title: "" });
      expect(bad?.status).toBe(400);
      expect(bad?.body.errors?.title).toBeDefined();
      expect(typeof bad?.body.error).toBe("string");
      expect(
        (await create(admin, { ...book, body: "a".repeat(4001) }))?.body.errors
          ?.body,
      ).toBeDefined();
      expect(
        (
          await create(admin, {
            ...book,
            kind: "announcement",
            body: "a".repeat(1001),
          })
        )?.status,
      ).toBe(400);
      expect(
        (await create(admin, { ...book, link: "javascript:alert(1)" }))?.body
          .errors?.link,
      ).toBeDefined();
      expect(
        (await create(admin, { ...book, link: "http://example.com" }))?.status,
      ).toBe(400);
      expect((await create(admin, { ...book, extra: 1 }))?.status).toBe(400);
      expect(await content.list("hr")).toEqual([]);
    });

    it("says there is no such floor", async () => {
      expect((await create(admin, { ...book, floor: "nope" }))?.status).toBe(
        404,
      );
    });

    it("refuses the 51st book with a 409, and still takes an announcement", async () => {
      for (let i = 0; i < CONTENT_LIMITS.perKind; i++)
        expect((await create(admin, { ...book, title: `B${i}` }))?.status).toBe(
          201,
        );
      const over = await create(admin, book);
      expect(over?.status).toBe(409);
      expect(typeof over?.body.error).toBe("string");
      expect(
        (await create(admin, { ...book, kind: "announcement" }))?.status,
      ).toBe(201);
      expect(await content.list("hr", "book")).toHaveLength(50);
    });

    it("notes who made what in the audit log, never the text", async () => {
      await create(admin, { ...book, body: "secret chapter", author: "Ana" });
      expect(audit).toEqual([
        {
          actorUserId: "user_x",
          actorName: "Xena",
          action: "content.create",
          floor: "hr",
          detail: { kind: "book", title: "Handbook" },
        },
      ]);
      expect(JSON.stringify(audit)).not.toContain("secret chapter");
    });

    it("notes nothing when it refused", async () => {
      await create(admin, { ...book, title: "" });
      await create(member, book);
      expect(audit).toEqual([]);
    });
  });

  describe("reading what an editor may edit", () => {
    it("gives every item of the floor, with the text", async () => {
      await create(admin, book);
      await create(admin, {
        floor: "hr",
        kind: "announcement",
        title: "Party",
        body: "Friday",
      });
      await create(admin, { ...book, floor: "lab", title: "Other" });
      const reply = await call(headOfHr, "GET", "/admin/content", undefined, {
        floor: "hr",
      });
      expect(reply?.status).toBe(200);
      expect(reply?.body.floor).toEqual({ id: "hr", name: "People" });
      expect(
        (reply?.body.books as Array<{ title: string; body: string }>).map(
          (b) => [b.title, b.body],
        ),
      ).toEqual([["Handbook", "Text"]]);
      expect(
        (reply?.body.announcements as Array<{ title: string }>).map(
          (a) => a.title,
        ),
      ).toEqual(["Party"]);
    });

    it("says there is no such floor", async () => {
      expect(
        (await call(admin, "GET", "/admin/content", undefined, { floor: "no" }))
          ?.status,
      ).toBe(404);
    });
  });

  describe("changing", () => {
    beforeEach(async () => {
      await create(admin, {
        ...book,
        author: "Ana",
        link: "https://example.com/",
      });
      audit = [];
    });

    it("changes the words that are sent and keeps the rest", async () => {
      const reply = await call(admin, "POST", "/admin/content/id1", {
        title: "Handbook 2",
      });
      expect(reply?.status).toBe(200);
      expect(reply?.body.item).toMatchObject({
        title: "Handbook 2",
        author: "Ana",
        body: "Text",
        link: "https://example.com/",
        floor: "hr",
        kind: "book",
      });
    });

    it("can take the link away", async () => {
      const reply = await call(admin, "POST", "/admin/content/id1", {
        link: null,
      });
      expect(reply?.body.item).toMatchObject({ link: null });
    });

    it("cannot move an item to another floor or turn it into another kind", async () => {
      for (const body of [{ floor: "lab" }, { kind: "announcement" }])
        expect(
          (await call(admin, "POST", "/admin/content/id1", body))?.status,
        ).toBe(400);
      expect(await content.get("id1")).toMatchObject({
        floor: "hr",
        kind: "book",
      });
    });

    it("refuses what breaks the limits, and changes nothing", async () => {
      const reply = await call(admin, "POST", "/admin/content/id1", {
        title: "x".repeat(81),
      });
      expect(reply?.status).toBe(400);
      expect(reply?.body.errors?.title).toBeDefined();
      expect((await content.get("id1"))?.title).toBe("Handbook");
      expect(
        (await call(admin, "POST", "/admin/content/id1", "x"))?.status,
      ).toBe(400);
    });

    it("says there is no such item", async () => {
      expect(
        (await call(admin, "POST", "/admin/content/nope", { title: "x" }))
          ?.status,
      ).toBe(404);
    });

    it("notes the change, with floor, kind and title", async () => {
      await call(admin, "POST", "/admin/content/id1", { title: "Handbook 2" });
      expect(audit).toEqual([
        {
          actorUserId: "user_x",
          actorName: "Xena",
          action: "content.update",
          floor: "hr",
          detail: { kind: "book", title: "Handbook 2" },
        },
      ]);
    });

    it("notes nothing, and leaves the update time alone, when nothing changed", async () => {
      const before = await content.get("id1");
      const reply = await call(admin, "POST", "/admin/content/id1", {
        title: "Handbook",
      });
      expect(reply?.status).toBe(200);
      expect(audit).toEqual([]);
      expect(await content.get("id1")).toEqual(before);
    });
  });

  describe("deleting", () => {
    beforeEach(async () => {
      await create(admin, book);
      audit = [];
    });

    it("removes the item, with a POST or a DELETE", async () => {
      expect(
        (await call(admin, "POST", "/admin/content/id1/delete"))?.body,
      ).toEqual({ deleted: "id1" });
      expect(await content.get("id1")).toBeNull();
      await create(admin, book);
      expect((await call(admin, "DELETE", "/admin/content/id2"))?.status).toBe(
        200,
      );
      expect(await content.get("id2")).toBeNull();
    });

    it("says there is no such item", async () => {
      expect(
        (await call(admin, "POST", "/admin/content/nope/delete"))?.status,
      ).toBe(404);
    });

    it("notes it, with floor, kind and title", async () => {
      await call(admin, "POST", "/admin/content/id1/delete");
      expect(audit).toEqual([
        {
          actorUserId: "user_x",
          actorName: "Xena",
          action: "content.delete",
          floor: "hr",
          detail: { kind: "book", title: "Handbook" },
        },
      ]);
    });

    it("answers for the server's own tools without a name in the log", async () => {
      await call(machine, "POST", "/admin/content/id1/delete");
      expect(audit[0]).toMatchObject({
        actorUserId: null,
        actorName: "Server tools",
      });
    });
  });

  describe("methods", () => {
    it("refuses the ones it does not know", async () => {
      expect((await call(admin, "PUT", "/admin/content"))?.status).toBe(405);
      expect((await call(admin, "GET", "/admin/content/id1"))?.status).toBe(
        405,
      );
      expect(
        (await call(admin, "GET", "/admin/content/id1/delete"))?.status,
      ).toBe(405);
    });
  });

  it("says the database cannot be reached when it cannot", async () => {
    const broken = new MemoryContentStore();
    broken.list = async () => {
      throw new Error("down");
    };
    const reply = await handleContentAdmin(
      {
        method: "GET",
        path: "/admin/content",
        query: { floor: "hr" },
        actor: admin,
      },
      { content: broken, floors },
    );
    expect(reply?.status).toBe(503);
  });
});
