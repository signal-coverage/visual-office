import { describe, expect, it } from "vitest";
import { clockText, linkHost, postedText } from "./format";

describe("clockText", () => {
  it("is hours and minutes", () => {
    expect(clockText(new Date("2026-10-14T14:05:00Z"), "en-GB", "UTC")).toBe(
      "14:05",
    );
  });
});

describe("postedText", () => {
  it("is the day and the month", () => {
    expect(postedText(Date.UTC(2026, 9, 14, 12), "en-GB", "UTC")).toBe(
      "14 Oct",
    );
  });

  it("adds the year when it is not the current one", () => {
    expect(
      postedText(
        Date.UTC(2025, 11, 31, 12),
        "en-GB",
        "UTC",
        Date.UTC(2026, 9, 14),
      ),
    ).toBe("31 Dec 2025");
  });
});

describe("linkHost", () => {
  it("is the site the link goes to, without www", () => {
    expect(linkHost("https://www.example.com/a/b?c=1")).toBe("example.com");
    expect(linkHost("https://docs.example.com/")).toBe("docs.example.com");
  });

  it("falls back to the link itself when it is not an address", () => {
    expect(linkHost("nonsense")).toBe("nonsense");
  });
});
