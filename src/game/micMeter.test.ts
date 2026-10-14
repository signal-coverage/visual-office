import { describe, expect, it } from "vitest";
import { levelFromRms, METER_STEPS, meterSteps, smoothLevel } from "./micMeter";

describe("levelFromRms", () => {
  it("is empty for silence and for readings that make no sense", () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(-1)).toBe(0);
    expect(levelFromRms(NaN)).toBe(0);
  });

  it("is empty for the hiss of a quiet room", () => {
    expect(levelFromRms(0.0005)).toBe(0); // about -66 dB
  });

  it("shows ordinary speech well inside the bar", () => {
    // Talking into a laptop microphone is roughly 0.02 to 0.1 in amplitude
    expect(levelFromRms(0.02)).toBeGreaterThan(0.4);
    expect(levelFromRms(0.1)).toBeLessThan(0.9);
  });

  it("is full for a loud or clipping signal and never beyond", () => {
    expect(levelFromRms(1)).toBe(1);
    expect(levelFromRms(5)).toBe(1);
  });

  it("never goes down as the sound gets louder", () => {
    let previous = 0;
    for (let rms = 0.0005; rms <= 1; rms *= 1.3) {
      const level = levelFromRms(rms);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe("smoothLevel", () => {
  it("jumps up at once, so a word is never missed", () => {
    expect(smoothLevel(0.1, 0.9, 0.016)).toBe(0.9);
  });

  it("falls gradually, so the bar does not flicker between syllables", () => {
    const next = smoothLevel(0.9, 0, 0.1);
    expect(next).toBeLessThan(0.9);
    expect(next).toBeGreaterThan(0.5);
  });

  it("reaches zero after a while and never goes below the target", () => {
    expect(smoothLevel(0.2, 0, 10)).toBe(0);
    expect(smoothLevel(0.5, 0.4, 10)).toBe(0.4);
  });
});

describe("meterSteps", () => {
  it("turns the level into whole bars, so the screen only updates when one changes", () => {
    expect(meterSteps(0)).toBe(0);
    expect(meterSteps(1)).toBe(METER_STEPS);
    expect(Number.isInteger(meterSteps(0.37))).toBe(true);
  });

  it("shows at least one bar for any sound at all", () => {
    expect(meterSteps(0.01)).toBe(1);
  });

  it("stays within range", () => {
    expect(meterSteps(-3)).toBe(0);
    expect(meterSteps(9)).toBe(METER_STEPS);
  });
});
