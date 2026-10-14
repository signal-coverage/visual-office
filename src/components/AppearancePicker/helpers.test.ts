import { describe, expect, it } from "vitest";
import { hex, indexOfColor } from "./helpers";

describe("hex", () => {
  it("writes a 0xRRGGBB colour as #rrggbb", () => {
    expect(hex(0xe53e3e)).toBe("#e53e3e");
    expect(hex(0x000a0b)).toBe("#000a0b");
  });
});

describe("indexOfColor", () => {
  const colors = [0xe53e3e, 0x38a169, 0x3182ce];

  it("finds the colour whichever case the picker writes it in", () => {
    expect(indexOfColor(colors, "#E53E3E")).toBe(0);
    expect(indexOfColor(colors, "#3182ce")).toBe(2);
  });

  it("is -1 for a colour that is not in the palette", () => {
    expect(indexOfColor(colors, "#ffffff")).toBe(-1);
  });
});
