import { describe, expect, it } from "vitest";
import { MAX_CHAT_LENGTH, sanitizeChat, sanitizeChatRequest } from "./chat.ts";

describe("sanitizeChat", () => {
  it("returns trimmed text for a valid message", () => {
    expect(sanitizeChat({ text: "  hello team  " })).toBe("hello team");
  });

  it.each([null, undefined, "hi", 42, [], {}, { text: 5 }])(
    "rejects invalid payload %p",
    (payload) => {
      expect(sanitizeChat(payload)).toBeNull();
    },
  );

  it("rejects empty or whitespace-only text", () => {
    expect(sanitizeChat({ text: "" })).toBeNull();
    expect(sanitizeChat({ text: "   \n\t " })).toBeNull();
  });

  it("truncates messages longer than the limit", () => {
    const result = sanitizeChat({ text: "a".repeat(MAX_CHAT_LENGTH + 50) });
    expect(result).toHaveLength(MAX_CHAT_LENGTH);
  });

  it("strips control characters", () => {
    expect(sanitizeChat({ text: "he\u0000llo\u0007" })).toBe("hello");
  });
});

describe("sanitizeChatRequest", () => {
  it("defaults to everybody when no scope is given, as older clients send it", () => {
    expect(sanitizeChatRequest({ text: " hi " })).toEqual({
      text: "hi",
      scope: "everyone",
    });
  });

  it("accepts the three scopes", () => {
    expect(sanitizeChatRequest({ text: "a", scope: "everyone" })).toEqual({
      text: "a",
      scope: "everyone",
    });
    expect(sanitizeChatRequest({ text: "a", scope: "nearby" })).toEqual({
      text: "a",
      scope: "nearby",
    });
    expect(sanitizeChatRequest({ text: "a", scope: "dm", to: "abc" })).toEqual({
      text: "a",
      scope: "dm",
      to: "abc",
    });
  });

  it("ignores a recipient on scopes that have none", () => {
    expect(
      sanitizeChatRequest({ text: "a", scope: "nearby", to: "abc" }),
    ).toEqual({ text: "a", scope: "nearby" });
  });

  it("refuses a direct message without a usable recipient", () => {
    for (const to of [undefined, "", "   ", 5, null, {}, "x".repeat(65)])
      expect(sanitizeChatRequest({ text: "a", scope: "dm", to })).toBeNull();
  });

  it("refuses unknown scopes and bad text", () => {
    expect(sanitizeChatRequest({ text: "a", scope: "all" })).toBeNull();
    expect(sanitizeChatRequest({ text: "a", scope: 3 })).toBeNull();
    expect(sanitizeChatRequest({ text: "  ", scope: "nearby" })).toBeNull();
    expect(sanitizeChatRequest(null)).toBeNull();
  });
});
