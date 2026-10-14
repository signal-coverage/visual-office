import { describe, expect, it } from "vitest";
import { CONTENT_LIMITS, type ContentItem } from "../../shared/content.ts";
import { emptyForm, formOf, limitOf, validateForm } from "./form";

describe("emptyForm", () => {
  it("is blank, and not pinned", () => {
    expect(emptyForm()).toEqual({
      title: "",
      author: "",
      body: "",
      link: "",
      pinned: false,
    });
  });
});

describe("formOf", () => {
  it("fills the form from an item, with an empty link for none", () => {
    const item: ContentItem = {
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
    expect(formOf(item)).toEqual({
      title: "T",
      author: "A",
      body: "text",
      link: "",
      pinned: false,
    });
    expect(formOf({ ...item, link: "https://x.test/" }).link).toBe(
      "https://x.test/",
    );
  });
});

describe("validateForm", () => {
  it("needs a title", () => {
    const result = validateForm("book", emptyForm());
    expect(!result.ok && result.errors.title).toBeDefined();
  });

  it("turns a typed form into what the server takes", () => {
    const result = validateForm("book", {
      title: "  Handbook ",
      author: "Ana",
      body: "one\r\ntwo",
      link: "",
      pinned: false,
    });
    expect(result).toEqual({
      ok: true,
      fields: {
        title: "Handbook",
        author: "Ana",
        body: "one\ntwo",
        link: null,
        pinned: false,
      },
    });
  });

  it("says what is wrong by field, with the words of the shared limits", () => {
    const result = validateForm("book", {
      title: "x".repeat(CONTENT_LIMITS.titleMax + 1),
      author: "y".repeat(CONTENT_LIMITS.authorMax + 1),
      body: "z".repeat(CONTENT_LIMITS.bookBodyMax + 1),
      link: "http://example.com",
      pinned: false,
    });
    expect(result.ok).toBe(false);
    const errors = !result.ok ? result.errors : {};
    expect(Object.keys(errors).sort()).toEqual([
      "author",
      "body",
      "link",
      "title",
    ]);
  });

  it("has a shorter body for an announcement, and no author", () => {
    const result = validateForm("announcement", {
      ...emptyForm(),
      title: "Party",
      author: "ignored",
      body: "a".repeat(CONTENT_LIMITS.announcementBodyMax + 1),
      pinned: true,
    });
    expect(!result.ok && result.errors.body).toBeDefined();
    expect(!result.ok && result.errors.author).toBeUndefined();
    const fine = validateForm("announcement", {
      ...emptyForm(),
      title: "Party",
      author: "ignored",
      pinned: true,
    });
    expect(fine).toEqual({
      ok: true,
      fields: {
        title: "Party",
        author: "",
        body: "",
        link: null,
        pinned: true,
      },
    });
  });

  it("does not pin a book", () => {
    const result = validateForm("book", {
      ...emptyForm(),
      title: "T",
      pinned: true,
    });
    expect(result.ok && result.fields.pinned).toBe(false);
  });
});

describe("limitOf", () => {
  it("tells how long each field may be, for the counters", () => {
    expect(limitOf("book", "title")).toBe(80);
    expect(limitOf("book", "author")).toBe(60);
    expect(limitOf("book", "body")).toBe(4000);
    expect(limitOf("announcement", "body")).toBe(1000);
    expect(limitOf("book", "link")).toBe(300);
  });
});
