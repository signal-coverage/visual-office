import { describe, expect, it } from "vitest";
import {
  createContentCache,
  deleteContent,
  fetchAdminContent,
  fetchBook,
  fetchEditableFloors,
  fetchFloorContent,
  saveContent,
} from "./content";

const server = "https://office.example.com";
const admin = `${server}/admin`;

function api(...answers: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const request = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const answer = answers[Math.min(calls.length, answers.length) - 1];
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

const list = {
  books: [{ id: "b1", title: "Handbook", author: "Ana" }],
  announcements: [
    { id: "a1", title: "Party", body: "Friday", pinned: true, updatedAt: 5 },
  ],
};

describe("fetchFloorContent", () => {
  it("brings the books and the announcements of the floor", async () => {
    const { request, calls } = api({ body: list });
    expect(await fetchFloorContent(request, server, "hr")).toEqual({
      ok: true,
      content: list,
    });
    expect(calls[0].url).toBe(`${server}/account/floors/hr/content`);
  });

  it("keeps only what is meant for the reader", async () => {
    const { request } = api({
      body: {
        books: [
          {
            id: "b1",
            title: "T",
            author: "A",
            body: "leak",
            link: "https://x.test/",
            extra: 1,
          },
        ],
        announcements: [],
      },
    });
    const result = await fetchFloorContent(request, server, "hr");
    expect(result).toEqual({
      ok: true,
      content: {
        books: [{ id: "b1", title: "T", author: "A", link: "https://x.test/" }],
        announcements: [],
      },
    });
  });

  it("drops a link that is not https", async () => {
    const { request } = api({
      body: {
        books: [
          { id: "b1", title: "T", author: "", link: "javascript:alert(1)" },
        ],
        announcements: [
          {
            id: "a",
            title: "T",
            body: "",
            pinned: false,
            updatedAt: 1,
            link: "http://x.test",
          },
        ],
      },
    });
    const result = await fetchFloorContent(request, server, "hr");
    expect(result.ok && result.content.books[0]).not.toHaveProperty("link");
    expect(result.ok && result.content.announcements[0]).not.toHaveProperty(
      "link",
    );
  });

  it("says why when it cannot", async () => {
    const refused = await fetchFloorContent(
      api({ status: 403, body: { error: "You may not enter this room." } })
        .request,
      server,
      "hr",
    );
    expect(refused).toEqual({
      ok: false,
      text: "You may not enter this room.",
    });
    for (const answer of [
      new Error("offline"),
      { status: 500, body: { error: "database password is x" } },
      { body: { books: "x" } },
      { body: {} },
      { body: { books: [{ id: 1 }], announcements: [] } },
    ]) {
      const result = await fetchFloorContent(api(answer).request, server, "hr");
      expect(result.ok).toBe(false);
      expect(!result.ok && result.text).not.toContain("password");
    }
  });
});

describe("fetchBook", () => {
  it("brings the text of one book", async () => {
    const { request, calls } = api({
      body: { book: { id: "b1", title: "T", author: "A", body: "one\ntwo" } },
    });
    expect(await fetchBook(request, server, "hr", "b1")).toEqual({
      ok: true,
      book: { id: "b1", title: "T", author: "A", body: "one\ntwo" },
    });
    expect(calls[0].url).toBe(`${server}/account/floors/hr/content/b1`);
  });

  it("is an error when the server sends something else", async () => {
    expect(
      (
        await fetchBook(
          api({ body: { book: { id: "b1" } } }).request,
          server,
          "hr",
          "b1",
        )
      ).ok,
    ).toBe(false);
    expect(
      (await fetchBook(api(new Error("x")).request, server, "hr", "b1")).ok,
    ).toBe(false);
  });
});

describe("the cache", () => {
  it("answers again from memory for a few seconds, per floor", async () => {
    let now = 1000;
    const cache = createContentCache(() => now, 30_000);
    const { request, calls } = api({ body: list });
    await cache.floorContent(request, server, "hr");
    await cache.floorContent(request, server, "hr");
    expect(calls).toHaveLength(1);
    await cache.floorContent(request, server, "lab");
    expect(calls).toHaveLength(2);
    now += 30_001;
    await cache.floorContent(request, server, "hr");
    expect(calls).toHaveLength(3);
  });

  it("does not keep a failure", async () => {
    const cache = createContentCache(() => 1, 30_000);
    const { request, calls } = api(new Error("offline"), { body: list });
    expect((await cache.floorContent(request, server, "hr")).ok).toBe(false);
    expect((await cache.floorContent(request, server, "hr")).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("keeps books by floor and id, and can be cleared", async () => {
    const cache = createContentCache(() => 1, 30_000);
    const book = { book: { id: "b1", title: "T", author: "", body: "x" } };
    const { request, calls } = api({ body: book });
    await cache.book(request, server, "hr", "b1");
    await cache.book(request, server, "hr", "b1");
    expect(calls).toHaveLength(1);
    await cache.book(request, server, "lab", "b1");
    expect(calls).toHaveLength(2);
    cache.clear("hr");
    await cache.book(request, server, "hr", "b1");
    expect(calls).toHaveLength(3);
    cache.clear();
    await cache.book(request, server, "lab", "b1");
    expect(calls).toHaveLength(4);
  });

  it("does not mix what two people read when the floor is the same one asked twice at once", async () => {
    const cache = createContentCache(() => 1, 30_000);
    const { request, calls } = api({ body: list });
    await Promise.all([
      cache.floorContent(request, server, "hr"),
      cache.floorContent(request, server, "hr"),
    ]);
    expect(calls).toHaveLength(1);
  });
});

const item = {
  id: "b1",
  floor: "hr",
  kind: "book",
  title: "T",
  author: "A",
  body: "text",
  link: null,
  pinned: false,
  position: 1,
  createdAt: 1,
  updatedAt: 2,
};

describe("the admin calls", () => {
  it("lists the floors that may be edited", async () => {
    const { request, calls } = api({
      body: { floors: [{ id: "hr", name: "People", extra: 1 }] },
    });
    expect(await fetchEditableFloors(request, admin)).toEqual({
      ok: true,
      floors: [{ id: "hr", name: "People" }],
    });
    expect(calls[0].url).toBe(`${admin}/content`);
    expect(
      (await fetchEditableFloors(api({ status: 403 }).request, admin)).ok,
    ).toBe(false);
  });

  it("lists what is on a floor, with the text", async () => {
    const { request, calls } = api({
      body: {
        floor: { id: "hr", name: "People" },
        books: [item],
        announcements: [],
      },
    });
    expect(await fetchAdminContent(request, admin, "hr")).toEqual({
      ok: true,
      books: [item],
      announcements: [],
    });
    expect(calls[0].url).toBe(`${admin}/content?floor=hr`);
  });

  it("is an error when the list is not what it should be", async () => {
    expect(
      (
        await fetchAdminContent(
          api({ body: { books: [{ id: 1 }], announcements: [] } }).request,
          admin,
          "hr",
        )
      ).ok,
    ).toBe(false);
  });

  it("makes an item with a POST to /admin/content", async () => {
    const { request, calls } = api({ status: 201, body: { item } });
    const result = await saveContent(request, admin, {
      floor: "hr",
      kind: "book",
      fields: {
        title: "T",
        author: "A",
        body: "text",
        link: null,
        pinned: false,
      },
    });
    expect(result).toEqual({ ok: true, item });
    expect(calls[0].url).toBe(`${admin}/content`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      floor: "hr",
      kind: "book",
      title: "T",
      author: "A",
      body: "text",
      link: null,
      pinned: false,
    });
  });

  it("changes an item with a POST to its id, without floor or kind", async () => {
    const { request, calls } = api({ body: { item } });
    await saveContent(request, admin, {
      id: "b1",
      floor: "hr",
      kind: "book",
      fields: {
        title: "T",
        author: "A",
        body: "text",
        link: null,
        pinned: false,
      },
    });
    expect(calls[0].url).toBe(`${admin}/content/b1`);
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent).not.toHaveProperty("floor");
    expect(sent).not.toHaveProperty("kind");
  });

  it("says why the server said no, in its words, and a plain one when it fails", async () => {
    const fields = {
      title: "T",
      author: "",
      body: "",
      link: null,
      pinned: false,
    };
    expect(
      await saveContent(
        api({
          status: 409,
          body: { error: "This floor already has the most books it can have." },
        }).request,
        admin,
        { floor: "hr", kind: "book", fields },
      ),
    ).toEqual({
      ok: false,
      text: "This floor already has the most books it can have.",
    });
    const offline = await saveContent(api(new Error("x")).request, admin, {
      floor: "hr",
      kind: "book",
      fields,
    });
    expect(offline.ok).toBe(false);
    const broken = await saveContent(
      api({ status: 500, body: { error: "secret" } }).request,
      admin,
      { floor: "hr", kind: "book", fields },
    );
    expect(!broken.ok && broken.text).not.toContain("secret");
  });

  it("removes an item with a POST to its delete address", async () => {
    const { request, calls } = api({ body: { deleted: "b1" } });
    expect(await deleteContent(request, admin, "b1")).toEqual({ ok: true });
    expect(calls[0].url).toBe(`${admin}/content/b1/delete`);
    expect(calls[0].init?.method).toBe("POST");
    expect(
      (
        await deleteContent(
          api({ status: 404, body: { error: "No such book or announcement." } })
            .request,
          admin,
          "b1",
        )
      ).ok,
    ).toBe(false);
  });
});
