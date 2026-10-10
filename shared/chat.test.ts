import { describe, expect, it } from "vitest";
import { MAX_CHAT_LENGTH, sanitizeChat } from "./chat.ts";

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
