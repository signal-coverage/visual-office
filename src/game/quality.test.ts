import { describe, expect, it } from "vitest";
import {
  AUTO_SLOW_FPS,
  AUTO_SLOW_SECONDS,
  AUTO_WARMUP_SECONDS,
  describeQuality,
  farUpdateDue,
  pixelRatioFor,
  QUALITY_PROFILES,
  resolveLevel,
  startAutoQuality,
  stepAutoQuality,
  type AutoQualityState,
} from "./quality";

/** Feeds the same frame (its fps and length) until `seconds` have passed, as the game loop would. */
function run(
  state: AutoQualityState,
  fps: number,
  seconds: number,
  frameSeconds = 0.1,
): AutoQualityState {
  let current = state;
  for (let t = 0; t < seconds; t += frameSeconds)
    current = stepAutoQuality(current, { fps, frameSeconds });
  return current;
}

describe("QUALITY_PROFILES", () => {
  it("makes low cheaper than high in every way", () => {
    const { high, low } = QUALITY_PROFILES;
    expect(low.pixelRatioCap).toBe(1);
    expect(high.pixelRatioCap).toBeGreaterThan(low.pixelRatioCap);
    expect(high.shadows).toBe(true);
    expect(low.shadows).toBe(false);
    expect(high.antialias).toBe(true);
    expect(low.antialias).toBe(false);
    expect(high.farUpdateEvery).toBe(1);
    expect(low.farUpdateEvery).toBeGreaterThan(1);
  });

  it("draws the small details of the furniture on high only", () => {
    expect(QUALITY_PROFILES.high.furnitureDetail).toBe("high");
    expect(QUALITY_PROFILES.low.furnitureDetail).toBe("low");
  });
});

describe("the detail of the people", () => {
  it("draws the small things people wear (a watch, a badge) on high only", () => {
    expect(QUALITY_PROFILES.high.avatarDetail).toBe("high");
    expect(QUALITY_PROFILES.low.avatarDetail).toBe("low");
  });
});

describe("resolveLevel", () => {
  it("follows an explicit choice whatever the computer is", () => {
    expect(
      resolveLevel("high", { softwareRendering: true, autoLevel: "low" }),
    ).toBe("high");
    expect(
      resolveLevel("low", { softwareRendering: false, autoLevel: "high" }),
    ).toBe("low");
  });

  it("picks low on auto when the browser draws with the CPU", () => {
    expect(
      resolveLevel("auto", { softwareRendering: true, autoLevel: "high" }),
    ).toBe("low");
  });

  it("uses what the frame times say on auto otherwise", () => {
    expect(
      resolveLevel("auto", { softwareRendering: false, autoLevel: "high" }),
    ).toBe("high");
    expect(
      resolveLevel("auto", { softwareRendering: false, autoLevel: "low" }),
    ).toBe("low");
  });
});

describe("pixelRatioFor", () => {
  it("caps the screen's pixel ratio by the level", () => {
    expect(pixelRatioFor("high", 3)).toBe(2);
    expect(pixelRatioFor("high", 1.5)).toBe(1.5);
    expect(pixelRatioFor("low", 3)).toBe(1);
    expect(pixelRatioFor("low", 0.75)).toBe(0.75);
  });
});

describe("farUpdateDue", () => {
  const low = QUALITY_PROFILES.low;
  const high = QUALITY_PROFILES.high;

  it("always updates everybody on high", () => {
    for (let frame = 0; frame < 5; frame++)
      expect(farUpdateDue(frame, 50, high)).toBe(true);
  });

  it("always updates the people close by on low", () => {
    for (let frame = 0; frame < 5; frame++)
      expect(farUpdateDue(frame, 1, low)).toBe(true);
  });

  it("updates the people far away only every few frames on low", () => {
    const due = [0, 1, 2, 3, 4, 5, 6].filter((frame) =>
      farUpdateDue(frame, low.farDistance + 1, low),
    );
    expect(due).toEqual([0, low.farUpdateEvery, 2 * low.farUpdateEvery]);
  });
});

describe("startAutoQuality", () => {
  it("starts on high, or on low when the browser draws with the CPU", () => {
    expect(startAutoQuality(false).level).toBe("high");
    expect(startAutoQuality(true).level).toBe("low");
  });
});

describe("stepAutoQuality", () => {
  const fresh = () => run(startAutoQuality(false), 60, AUTO_WARMUP_SECONDS + 1);

  it("stays on high while the game runs smoothly", () => {
    expect(run(fresh(), 60, 60).level).toBe("high");
  });

  it("ignores the first seconds, when everything is still loading", () => {
    const state = run(startAutoQuality(false), 5, AUTO_WARMUP_SECONDS - 0.5);
    expect(state.level).toBe("high");
  });

  it("ignores the frames before the first full measurement (fps 0)", () => {
    expect(run(fresh(), 0, 60).level).toBe("high");
  });

  it("goes to low when frames stay slow for a few seconds", () => {
    expect(run(fresh(), AUTO_SLOW_FPS - 5, AUTO_SLOW_SECONDS + 1).level).toBe(
      "low",
    );
  });

  it("does not go to low for a short slow spell", () => {
    expect(run(fresh(), 10, AUTO_SLOW_SECONDS - 1).level).toBe("high");
  });

  it("needs the slowness to be continuous: a good moment starts the count again", () => {
    let state = fresh();
    for (let i = 0; i < 5; i++) {
      state = run(state, 10, AUTO_SLOW_SECONDS - 1);
      state = run(state, 60, 0.5);
    }
    expect(state.level).toBe("high");
  });

  it("does not count a frame that was the tab being hidden", () => {
    const state = stepAutoQuality(fresh(), { fps: 5, frameSeconds: 30 });
    expect(state.slowSeconds).toBe(0);
    expect(state.level).toBe("high");
  });

  it("never goes back up by itself, so it cannot flap between the two", () => {
    const low = run(fresh(), 10, AUTO_SLOW_SECONDS + 1);
    expect(low.level).toBe("low");
    expect(run(low, 144, 600).level).toBe("low");
  });

  it("stays on low when it started there", () => {
    expect(run(startAutoQuality(true), 144, 60).level).toBe("low");
  });
});

describe("describeQuality", () => {
  it("names a chosen level", () => {
    expect(describeQuality("high", "high")).toBe("High");
    expect(describeQuality("low", "low")).toBe("Low");
  });

  it("says what auto picked", () => {
    expect(describeQuality("auto", "high")).toBe("Auto (High)");
    expect(describeQuality("auto", "low")).toBe("Auto (Low)");
  });
});
