import { describe, expect, it } from "vitest";
import { DEFAULT_NAME, MAX_NAME_LENGTH, sanitizeName } from "./name.ts";

describe("sanitizeName", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeName("  Ana  ")).toBe("Ana");
  });

  it("falls back to the default for empty or non-string input", () => {
    expect(sanitizeName("")).toBe(DEFAULT_NAME);
    expect(sanitizeName("   ")).toBe(DEFAULT_NAME);
    expect(sanitizeName(undefined)).toBe(DEFAULT_NAME);
    expect(sanitizeName(42)).toBe(DEFAULT_NAME);
    expect(sanitizeName({})).toBe(DEFAULT_NAME);
  });

  it("truncates long names", () => {
    expect(sanitizeName("x".repeat(MAX_NAME_LENGTH + 10))).toHaveLength(
      MAX_NAME_LENGTH,
    );
  });

  it("strips control characters and collapses inner whitespace", () => {
    expect(sanitizeName("A\u0000n\u0007a")).toBe("Ana");
    expect(sanitizeName("Ana   María")).toBe("Ana María");
  });

  it("falls back when only control characters remain", () => {
    expect(sanitizeName("\u0000\u0001")).toBe(DEFAULT_NAME);
  });
});
