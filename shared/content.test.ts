import { describe, expect, it } from "vitest";
import {
  announcementOf,
  bookSummaryOf,
  CONTENT_LIMITS,
  linkProblem,
  orderAnnouncements,
  sanitizeLine,
  sanitizeText,
  validateContentFields,
  type ContentItem,
} from "./content.ts";

const item = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: "c1",
  floor: "office",
  kind: "book",
  title: "Handbook",
  author: "Ana",
  body: "Chapter one",
  link: null,
  pinned: false,
  position: 1,
  createdAt: 10,
  updatedAt: 20,
  ...overrides,
});

describe("the limits", () => {
  it("are the ones the docs promise", () => {
    expect(CONTENT_LIMITS).toEqual({
      titleMax: 80,
      authorMax: 60,
      bookBodyMax: 4000,
      announcementBodyMax: 1000,
      linkMax: 300,
      perKind: 50,
    });
  });
});

describe("sanitizeLine", () => {
  it("drops control characters, folds white space and trims", () => {
    expect(sanitizeLine("  Hello\u0000 \t world\u0007\n again  ")).toBe(
      "Hello world again",
    );
  });

  it("drops characters that hide or reverse text", () => {
    expect(sanitizeLine("a‮b​c⁦d﻿e")).toBe("abcde");
  });
});

describe("sanitizeText", () => {
  it("keeps line breaks, as \\n, and drops other control characters", () => {
    expect(sanitizeText("one\r\ntwo\rthree\u0000\u001b[31m\nfour")).toBe(
      "one\ntwo\nthree[31m\nfour",
    );
  });

  it("turns tabs into spaces and trims the ends", () => {
    expect(sanitizeText("\n  a\tb  \n")).toBe("a b");
  });

  it("leaves HTML and markdown exactly as typed", () => {
    expect(sanitizeText("<b>hi</b> **x** [a](b)")).toBe(
      "<b>hi</b> **x** [a](b)",
    );
  });
});

describe("linkProblem", () => {
  it("accepts an https address", () => {
    expect(linkProblem("https://example.com/a?b=1#c")).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<b>x</b>",
    "http://example.com",
    "ftp://example.com",
    "//example.com",
    "example.com",
    "https://user:pass@example.com",
    "https://user@example.com",
    "https://",
    "https://exa mple.com",
    "not a url",
  ])("refuses %s", (link) => {
    expect(linkProblem(link)).not.toBeNull();
  });

  it("refuses an address longer than the limit", () => {
    const long = `https://example.com/${"a".repeat(300)}`;
    expect(linkProblem(long)).not.toBeNull();
    const fits = `https://example.com/${"a".repeat(300 - 20)}`;
    expect(fits.length).toBe(300);
    expect(linkProblem(fits)).toBeNull();
  });
});

describe("validateContentFields", () => {
  const ok = (kind: "book" | "announcement", input: unknown) => {
    const result = validateContentFields(kind, input);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.fields;
  };
  const errors = (
    kind: "book" | "announcement",
    input: unknown,
    existing?: Parameters<typeof validateContentFields>[2],
  ) => {
    const result = validateContentFields(kind, input, existing);
    return result.ok ? null : result.errors;
  };

  it("makes a book from a title, with the rest empty", () => {
    expect(ok("book", { title: "  Handbook " })).toEqual({
      title: "Handbook",
      author: "",
      body: "",
      link: null,
      pinned: false,
    });
  });

  it("keeps what is given, cleaned", () => {
    expect(
      ok("book", {
        title: "A\u0000 B",
        author: "Ana  Perez",
        body: "one\r\ntwo",
        link: " https://example.com/x ",
      }),
    ).toEqual({
      title: "A B",
      author: "Ana Perez",
      body: "one\ntwo",
      link: "https://example.com/x",
      pinned: false,
    });
  });

  it("asks for a title between 1 and 80 characters", () => {
    expect(errors("book", {})?.title).toBeDefined();
    expect(errors("book", { title: "   " })?.title).toBeDefined();
    expect(errors("book", { title: 7 })?.title).toBeDefined();
    expect(errors("book", { title: "a".repeat(81) })?.title).toBeDefined();
    expect(errors("book", { title: "a".repeat(80) })).toBeNull();
  });

  it("limits the author to 60 characters", () => {
    expect(
      errors("book", { title: "T", author: "a".repeat(61) })?.author,
    ).toBeDefined();
    expect(errors("book", { title: "T", author: "a".repeat(60) })).toBeNull();
    expect(errors("book", { title: "T", author: 3 })?.author).toBeDefined();
  });

  it("limits a book to 4000 characters and an announcement to 1000", () => {
    expect(
      errors("book", { title: "T", body: "a".repeat(4001) })?.body,
    ).toBeDefined();
    expect(errors("book", { title: "T", body: "a".repeat(4000) })).toBeNull();
    expect(
      errors("announcement", { title: "T", body: "a".repeat(1001) })?.body,
    ).toBeDefined();
    expect(
      errors("announcement", { title: "T", body: "a".repeat(1000) }),
    ).toBeNull();
  });

  it("counts the text after it was cleaned", () => {
    expect(
      errors("announcement", {
        title: "T",
        body: `${"a".repeat(1000)}\u0000\u0000\u0000`,
      }),
    ).toBeNull();
  });

  it("takes an https link, or none", () => {
    expect(ok("book", { title: "T", link: "" }).link).toBeNull();
    expect(ok("book", { title: "T", link: null }).link).toBeNull();
    expect(
      errors("book", { title: "T", link: "javascript:alert(1)" })?.link,
    ).toBeDefined();
    expect(errors("book", { title: "T", link: 5 })?.link).toBeDefined();
  });

  it("lets only announcements be pinned, and only with true or false", () => {
    expect(ok("announcement", { title: "T", pinned: true }).pinned).toBe(true);
    expect(
      errors("announcement", { title: "T", pinned: "yes" })?.pinned,
    ).toBeDefined();
    expect(errors("book", { title: "T", pinned: true })?.pinned).toBeDefined();
  });

  it("does not take an author for an announcement", () => {
    expect(
      errors("announcement", { title: "T", author: "Ana" })?.author,
    ).toBeDefined();
  });

  it("refuses what it does not know", () => {
    expect(errors("book", { title: "T", html: "<b>" })?.form).toBeDefined();
  });

  it("refuses a body that is not an object", () => {
    expect(errors("book", null)?.form).toBeDefined();
    expect(errors("book", [])?.form).toBeDefined();
    expect(errors("book", "text")?.form).toBeDefined();
  });

  it("when updating, keeps what is not sent", () => {
    const before = {
      title: "Old",
      author: "Ana",
      body: "text",
      link: "https://example.com",
      pinned: false,
    };
    const result = validateContentFields("book", { title: "New" }, before);
    expect(result).toEqual({ ok: true, fields: { ...before, title: "New" } });
    const cleared = validateContentFields("book", { link: null }, before);
    expect(cleared).toEqual({ ok: true, fields: { ...before, link: null } });
  });
});

describe("what each reader is given", () => {
  it("lists a book without its text", () => {
    const summary = bookSummaryOf(
      item({ link: "https://example.com", body: "secret chapter" }),
    );
    expect(summary).toEqual({
      id: "c1",
      title: "Handbook",
      author: "Ana",
      link: "https://example.com",
    });
    expect(JSON.stringify(summary)).not.toContain("secret");
    expect(bookSummaryOf(item())).not.toHaveProperty("link");
  });

  it("lists an announcement with its text and when it changed", () => {
    expect(
      announcementOf(
        item({ kind: "announcement", pinned: true, body: "Party", id: "a1" }),
      ),
    ).toEqual({
      id: "a1",
      title: "Handbook",
      body: "Party",
      pinned: true,
      updatedAt: 20,
    });
  });
});

describe("orderAnnouncements", () => {
  it("puts the pinned first, then the newest", () => {
    const list = [
      announcementOf(item({ id: "old", pinned: false, updatedAt: 1 })),
      announcementOf(item({ id: "new", pinned: false, updatedAt: 9 })),
      announcementOf(item({ id: "pin-old", pinned: true, updatedAt: 2 })),
      announcementOf(item({ id: "pin-new", pinned: true, updatedAt: 8 })),
    ];
    expect(orderAnnouncements(list).map((a) => a.id)).toEqual([
      "pin-new",
      "pin-old",
      "new",
      "old",
    ]);
  });

  it("does not change the list it is given", () => {
    const list = [
      announcementOf(item({ id: "a", updatedAt: 1 })),
      announcementOf(item({ id: "b", updatedAt: 2 })),
    ];
    orderAnnouncements(list);
    expect(list.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
