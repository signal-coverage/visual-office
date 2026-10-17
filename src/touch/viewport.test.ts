import { describe, expect, it } from "vitest";
import { keyboardInset } from "./viewport";

describe("keyboardInset", () => {
  it("is nothing when the visible part of the page is the whole window", () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
  });

  it("is the height the virtual keyboard takes from the bottom", () => {
    expect(keyboardInset(844, { height: 510, offsetTop: 0 })).toBe(334);
  });

  it("does not count the part the browser scrolled off the top to keep the input in view", () => {
    expect(keyboardInset(844, { height: 510, offsetTop: 120 })).toBe(214);
  });

  it("is nothing without the visual viewport (an old browser), and never negative", () => {
    expect(keyboardInset(844, null)).toBe(0);
    expect(keyboardInset(500, { height: 505, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(500, { height: 400, offsetTop: 200 })).toBe(0);
  });

  it("ignores the few pixels by which the toolbars of a phone browser change the height", () => {
    expect(keyboardInset(844, { height: 800, offsetTop: 0 })).toBe(0);
  });
});
