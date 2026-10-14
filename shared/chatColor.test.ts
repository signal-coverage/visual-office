import { describe, expect, it } from "vitest";
import { MAX_PLAYERS_PER_ROOM } from "./constants.ts";
import {
  chatColor,
  chatHue,
  chatLightness,
  lowestFreeColor,
} from "./chatColor.ts";

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe("chatColor", () => {
  it("gives everybody who can be in a room a colour of their own", () => {
    const colors = Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) =>
      chatColor(i),
    );
    expect(new Set(colors).size).toBe(MAX_PLAYERS_PER_ROOM);
  });

  it("keeps the colours of an ordinary office clearly apart", () => {
    // The first dozen players: no two may be near neighbours on the colour wheel
    for (let a = 0; a < 12; a++) {
      for (let b = a + 1; b < 12; b++) {
        expect(hueGap(chatHue(a), chatHue(b))).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("tells apart even a full room: close hues differ in brightness", () => {
    for (let a = 0; a < MAX_PLAYERS_PER_ROOM; a++) {
      for (let b = a + 1; b < MAX_PLAYERS_PER_ROOM; b++) {
        const hueApart = hueGap(chatHue(a), chatHue(b)) >= 8;
        const brightnessApart =
          Math.abs(chatLightness(a) - chatLightness(b)) >= 8;
        expect(hueApart || brightnessApart).toBe(true);
      }
    }
  });

  it("stays readable on the dark chat background", () => {
    for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
      expect(chatLightness(i)).toBeGreaterThanOrEqual(55);
      expect(chatLightness(i)).toBeLessThanOrEqual(85);
    }
  });

  it("always gives a valid colour, even for an index it was not designed for", () => {
    for (const i of [0, 29, 30, 100, 255]) {
      expect(chatColor(i)).toMatch(/^hsl\(\d+(\.\d+)? \d+% \d+%\)$/);
    }
    expect(chatColor(-1)).toBe(chatColor(0));
    expect(chatColor(NaN)).toBe(chatColor(0));
  });

  it("is the same colour for the same index every time", () => {
    expect(chatColor(7)).toBe(chatColor(7));
  });
});

describe("lowestFreeColor", () => {
  it("starts at the first colour in an empty room", () => {
    expect(lowestFreeColor([])).toBe(0);
  });

  it("takes the next one when others are using the first", () => {
    expect(lowestFreeColor([0, 1, 2])).toBe(3);
  });

  it("reuses a colour as soon as its owner has left", () => {
    expect(lowestFreeColor([0, 2, 3])).toBe(1);
  });

  it("never hands out one that is in use", () => {
    const used: number[] = [];
    for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
      const next = lowestFreeColor(used);
      expect(used).not.toContain(next);
      used.push(next);
    }
    expect(new Set(used).size).toBe(MAX_PLAYERS_PER_ROOM);
  });

  it("does not care about the order or repeats in what it is given", () => {
    expect(lowestFreeColor([3, 0, 0, 1, 3])).toBe(2);
  });
});
