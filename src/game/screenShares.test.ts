import { describe, expect, it } from "vitest";
import { fitInside } from "./fit";
import { ScreenShares } from "./screenShares";

const element = (label: string) => ({ label }) as unknown as HTMLVideoElement;

describe("ScreenShares", () => {
  it("has nothing to show at first", () => {
    expect(new ScreenShares().current()).toBeNull();
  });

  it("shows the screen somebody is sharing, and the name of who it is", () => {
    const shares = new ScreenShares();
    const video = element("ana");
    shares.add("ana-id", "Ana", video);
    expect(shares.current()).toEqual({
      identity: "ana-id",
      name: "Ana",
      element: video,
    });
  });

  it("shows the newest when two people share, and goes back when it stops", () => {
    const shares = new ScreenShares();
    shares.add("a", "Ana", element("a"));
    shares.add("b", "Beto", element("b"));
    expect(shares.current()?.name).toBe("Beto");

    shares.remove("b");
    expect(shares.current()?.name).toBe("Ana");
    shares.remove("a");
    expect(shares.current()).toBeNull();
  });

  it("moves a person who starts sharing again to the front", () => {
    const shares = new ScreenShares();
    shares.add("a", "Ana", element("a1"));
    shares.add("b", "Beto", element("b"));
    shares.add("a", "Ana", element("a2"));
    expect(shares.current()?.name).toBe("Ana");
    expect(
      (shares.current()?.element as unknown as { label: string }).label,
    ).toBe("a2");
  });

  it("ignores removing somebody who was not sharing", () => {
    const shares = new ScreenShares();
    shares.add("a", "Ana", element("a"));
    shares.remove("ghost");
    expect(shares.current()?.name).toBe("Ana");
  });

  it("forgets everything on clear", () => {
    const shares = new ScreenShares();
    shares.add("a", "Ana", element("a"));
    shares.clear();
    expect(shares.current()).toBeNull();
  });
});

describe("fitInside", () => {
  it("fills the width when the picture is wider than the screen", () => {
    expect(fitInside(2, 16, 9)).toEqual({ width: 16, height: 8 });
  });

  it("fills the height when the picture is taller than the screen", () => {
    const fit = fitInside(1, 16, 9);
    expect(fit.height).toBe(9);
    expect(fit.width).toBe(9);
  });

  it("fills a matching screen exactly", () => {
    const fit = fitInside(16 / 9, 16, 9);
    expect(fit.width).toBeCloseTo(16);
    expect(fit.height).toBeCloseTo(9);
  });

  it("never goes outside the screen, whatever the picture", () => {
    for (const aspect of [0.3, 0.75, 1, 1.33, 1.78, 2.4, 4]) {
      const fit = fitInside(aspect, 16, 9);
      expect(fit.width).toBeLessThanOrEqual(16 + 1e-9);
      expect(fit.height).toBeLessThanOrEqual(9 + 1e-9);
      expect(fit.width / fit.height).toBeCloseTo(aspect);
    }
  });

  it("fills the screen while the picture's shape is not known yet", () => {
    for (const aspect of [0, NaN, Infinity, -1]) {
      expect(fitInside(aspect, 16, 9)).toEqual({ width: 16, height: 9 });
    }
  });
});
