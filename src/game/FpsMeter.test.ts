import { describe, expect, it } from "vitest";
import { FpsMeter } from "./FpsMeter";

const feed = (meter: FpsMeter, seconds: number, frameSeconds: number) => {
  for (let t = 0; t < seconds; t += frameSeconds) meter.tick(frameSeconds);
};

describe("FpsMeter", () => {
  it("reports nothing until it has measured a full window", () => {
    const meter = new FpsMeter();
    feed(meter, 0.2, 1 / 60);
    expect(meter.fps).toBe(0);
  });

  it("measures a steady frame rate", () => {
    const meter = new FpsMeter();
    feed(meter, 2, 1 / 60);
    expect(meter.fps).toBeCloseTo(60, 0);
    expect(meter.worstFrameMs).toBeCloseTo(1000 / 60, 0);
  });

  it("notices a slow machine", () => {
    const meter = new FpsMeter();
    feed(meter, 2, 1 / 10);
    expect(meter.fps).toBeCloseTo(10, 0);
  });

  it("reports the single worst frame of the last window, so one hitch is not averaged away", () => {
    const meter = new FpsMeter();
    feed(meter, 0.4, 1 / 100);
    meter.tick(0.25); // one long stall
    feed(meter, 0.4, 1 / 100);
    expect(meter.worstFrameMs).toBeCloseTo(250, 0);
  });

  it("forgets old stalls once a new window has no more", () => {
    const meter = new FpsMeter();
    meter.tick(0.25);
    feed(meter, 3, 1 / 100);
    expect(meter.worstFrameMs).toBeLessThan(50);
  });
});
