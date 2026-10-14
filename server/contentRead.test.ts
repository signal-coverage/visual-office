import { beforeEach, describe, expect, it } from "vitest";
import type { ContentFields } from "../shared/content.ts";
import type { AuthResult } from "./authenticate.ts";
import { handleContentRead } from "./contentRead.ts";
import { MemoryContentStore } from "./contentStore.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryUserStore } from "./userStore.ts";

const fields = (overrides: Partial<ContentFields> = {}): ContentFields => ({
  title: "T",
  author: "",
  body: "",
  link: null,
  pinned: false,
  ...overrides,
});

interface Body {
  error?: string;
  books?: Array<Record<string, unknown>>;
  announcements?: Array<Record<string, unknown>>;
  book?: Record<string, unknown>;
}

describe("handleContentRead", () => {
  let floors: MemoryFloorStore;
  let users: MemoryUserStore;
  let content: MemoryContentStore;
  let who: AuthResult | null;
  let now: number;

  const person = (id: string): AuthResult => ({
    ok: true,
    user: { id, email: null, name: id, isAdmin: false },
  });
  const call = async (
    path: string,
    method = "GET",
    token: string | undefined = "t",
  ) => {
    const reply = await handleContentRead(
      { method, path, token },
      {
        authenticate: async () => who,
        floors,
        rolesOf: (id) => users.rolesOf(id),
        content,
      },
    );
    return reply && { status: reply.status, body: reply.body as Body };
  };

  beforeEach(async () => {
    now = 100;
    floors = new MemoryFloorStore(() => 1);
    users = new MemoryUserStore();
    content = new MemoryContentStore(
      () => now++,
      (() => {
        let n = 0;
        return () => `id${++n}`;
      })(),
    );
    await users.upsert({ id: "user_ana", email: null, name: "Ana" });
    await floors.create({ id: "hr", name: "People" });
    await floors.create({ id: "lab", name: "Lab" });
    await floors.grant("lab", "user_ana");
    who = person("user_ana");
  });

  it("answers nothing for other paths", async () => {
    expect(await call("/account/floors")).toBeNull();
    expect(await call("/account/floors/previews")).toBeNull();
    expect(await call("/account/floors/office")).toBeNull();
    expect(await call("/account/floors/office/contents")).toBeNull();
    expect(await call("/account/floors/office/content/a/b")).toBeNull();
    expect(await call("/admin/content")).toBeNull();
  });

  it("only answers to GET", async () => {
    expect((await call("/account/floors/office/content", "POST"))?.status).toBe(
      405,
    );
  });

  describe("the list", () => {
    it("gives books without their text, and announcements pinned first then newest", async () => {
      await content.create(
        "office",
        "book",
        fields({
          title: "Handbook",
          author: "Ana",
          body: "secret chapter",
          link: "https://example.com/",
        }),
      );
      await content.create("office", "book", fields({ title: "Plain" }));
      await content.create(
        "office",
        "announcement",
        fields({ title: "old", body: "a" }),
      );
      await content.create(
        "office",
        "announcement",
        fields({ title: "new", body: "b" }),
      );
      await content.create(
        "office",
        "announcement",
        fields({ title: "pinned", body: "c", pinned: true }),
      );
      const reply = await call("/account/floors/office/content");
      expect(reply?.status).toBe(200);
      expect(reply?.body.books).toEqual([
        {
          id: "id1",
          title: "Handbook",
          author: "Ana",
          link: "https://example.com/",
        },
        { id: "id2", title: "Plain", author: "" },
      ]);
      expect(reply?.body.announcements?.map((a) => a.title)).toEqual([
        "pinned",
        "new",
        "old",
      ]);
      expect(reply?.body.announcements?.[0]).toMatchObject({
        body: "c",
        pinned: true,
      });
      expect(JSON.stringify(reply?.body)).not.toContain("secret chapter");
    });

    it("is empty for a floor with nothing yet", async () => {
      expect((await call("/account/floors/office/content"))?.body).toEqual({
        books: [],
        announcements: [],
      });
    });

    it("shows each floor its own content", async () => {
      await content.create("office", "book", fields({ title: "Office book" }));
      await content.create("lab", "book", fields({ title: "Lab book" }));
      expect(
        (await call("/account/floors/lab/content"))?.body.books?.map(
          (b) => b.title,
        ),
      ).toEqual(["Lab book"]);
    });

    it("never carries who wrote it or when it was made, only what readers need", async () => {
      await content.create("office", "announcement", fields());
      const text = JSON.stringify(
        (await call("/account/floors/office/content"))?.body,
      );
      expect(text).not.toContain("createdAt");
      expect(text).not.toContain("position");
      expect(text).not.toContain('"floor"');
    });
  });

  describe("one book", () => {
    beforeEach(async () => {
      await content.create(
        "office",
        "book",
        fields({ title: "Handbook", body: "Chapter\nTwo", author: "Ana" }),
      );
    });

    it("gives the text", async () => {
      const reply = await call("/account/floors/office/content/id1");
      expect(reply?.status).toBe(200);
      expect(reply?.body.book).toEqual({
        id: "id1",
        title: "Handbook",
        author: "Ana",
        body: "Chapter\nTwo",
      });
    });

    it("says there is no such book", async () => {
      expect((await call("/account/floors/office/content/nope"))?.status).toBe(
        404,
      );
    });

    it("does not give a book through another floor", async () => {
      expect((await call("/account/floors/lab/content/id1"))?.status).toBe(404);
    });

    it("does not give an announcement as a book", async () => {
      await content.create("office", "announcement", fields({ title: "A" }));
      expect((await call("/account/floors/office/content/id2"))?.status).toBe(
        404,
      );
    });
  });

  describe("who may read", () => {
    beforeEach(async () => {
      await content.create("hr", "book", fields({ title: "HR only" }));
    });

    it("asks to sign in, and says why when it cannot", async () => {
      who = { ok: false, reason: "missing" };
      expect((await call("/account/floors/office/content"))?.status).toBe(401);
      who = { ok: false, reason: "invalid" };
      expect((await call("/account/floors/office/content"))?.status).toBe(401);
      who = { ok: false, reason: "not_member" };
      expect((await call("/account/floors/office/content"))?.status).toBe(403);
      who = { ok: false, reason: "unavailable" };
      expect((await call("/account/floors/office/content"))?.status).toBe(503);
    });

    it("lets a member read the common floor and the floors they have an entry for", async () => {
      expect((await call("/account/floors/office/content"))?.status).toBe(200);
      expect((await call("/account/floors/lab/content"))?.status).toBe(200);
    });

    it("keeps a floor's content from those who may not enter it, the list and the books", async () => {
      const list = await call("/account/floors/hr/content");
      expect(list?.status).toBe(403);
      expect(JSON.stringify(list?.body)).not.toContain("HR only");
      expect((await call("/account/floors/hr/content/id1"))?.status).toBe(403);
    });

    it("lets the head of a floor and an admin read it", async () => {
      await users.addHead("hr", "user_ana");
      expect((await call("/account/floors/hr/content"))?.status).toBe(200);
      await users.upsert({ id: "user_root", email: null, name: "Root" });
      await users.setAdmin("user_root", true);
      who = person("user_root");
      expect((await call("/account/floors/hr/content/id1"))?.status).toBe(200);
    });

    it("lets everybody read when sign-in is off", async () => {
      who = null;
      expect(
        (await call("/account/floors/hr/content", "GET", undefined))?.status,
      ).toBe(200);
    });

    it("says there is no such floor", async () => {
      expect((await call("/account/floors/nope/content"))?.status).toBe(404);
      expect((await call("/account/floors/nope/content/id1"))?.status).toBe(
        404,
      );
    });
  });

  it("says the database cannot be reached when it cannot", async () => {
    content.list = async () => {
      throw new Error("down");
    };
    expect((await call("/account/floors/office/content"))?.status).toBe(503);
  });
});
