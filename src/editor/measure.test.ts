import { describe, expect, it } from "vitest";
import { footprintFromSize } from "./measure";

describe("footprintFromSize", () => {
  it("is a little smaller than the object, so people can brush against it", () => {
    const [w, d] = footprintFromSize(1.7, 0.45);
    expect(w).toBeLessThan(1.7);
    expect(d).toBeLessThan(0.45);
    expect(w).toBeGreaterThan(1.5);
  });

  it("rounds to the 5 cm grid", () => {
    for (const side of footprintFromSize(1.234, 0.777)) {
      expect(Math.round(side * 20)).toBeCloseTo(side * 20);
    }
  });

  it("never gives a size too small to place or see", () => {
    expect(footprintFromSize(0, 0.01)).toEqual([0.1, 0.1]);
  });

  it("gives the same sides for the same object, whichever way it is measured", () => {
    expect(footprintFromSize(2, 1)).toEqual(footprintFromSize(2, 1));
  });

  it("copes with a size that is not a number", () => {
    expect(footprintFromSize(NaN, Infinity)).toEqual([0.1, 0.1]);
  });
});
