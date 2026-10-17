import { describe, expect, it } from "vitest";
import { floorRepeat } from "./floorTexture";

describe("floorRepeat", () => {
  it("is what the main office always had: 8 by 6 tiles over 30 by 20 meters", () => {
    expect(floorRepeat(30, 20)).toEqual([8, 6]);
  });

  it("keeps the boards the same size on a bigger or smaller floor", () => {
    const [bigX, bigZ] = floorRepeat(36, 20);
    expect(bigX).toBeCloseTo(9.6, 9);
    expect(bigZ).toBeCloseTo(6, 9);
    const [smallX, smallZ] = floorRepeat(24, 16);
    expect(smallX).toBeCloseTo(6.4, 9);
    expect(smallZ).toBeCloseTo(4.8, 9);
  });
});
