import { describe, expect, it } from "vitest";
import { DRAG_SPEED } from "./consts";
import { dragYaw, previewSizeFor } from "./helpers";

describe("dragYaw", () => {
  it("does not turn when the pointer does not move", () => {
    expect(dragYaw(1.2, 0)).toBe(1.2);
  });

  it("turns one way when dragging right and the other way when dragging left", () => {
    expect(dragYaw(0, 100)).toBeCloseTo(100 * DRAG_SPEED);
    expect(dragYaw(0, -100)).toBeCloseTo(-100 * DRAG_SPEED);
  });

  it("adds to the turn the character already had", () => {
    expect(dragYaw(2, 10)).toBeCloseTo(2 + 10 * DRAG_SPEED);
  });
});

describe("previewSizeFor", () => {
  it("uses the large character where there is room", () => {
    expect(previewSizeFor({ width: 1280, height: 720 })).toBe("large");
  });

  it("shrinks it on a short window", () => {
    expect(previewSizeFor({ width: 1000, height: 577 })).toBe("medium");
  });

  it("uses the small one on a phone turned sideways", () => {
    expect(previewSizeFor({ width: 844, height: 390 })).toBe("small");
  });

  it("uses a medium one on a tall phone and a small one on a short phone", () => {
    expect(previewSizeFor({ width: 390, height: 844 })).toBe("medium");
    expect(previewSizeFor({ width: 375, height: 667 })).toBe("small");
  });
});
