import { describe, expect, it } from "vitest";
import { STICK_RADIUS } from "./joystick";
import { TAP_MAX_MS, TAP_SLOP, TouchInput } from "./touchInput";

const STILL = { forward: 0, strafe: 0, run: false };

describe("TouchInput: the joystick", () => {
  it("asks for nothing until a thumb is on it", () => {
    expect(new TouchInput().intent()).toEqual(STILL);
  });

  it("measures the push from where the joystick is, not from where the thumb landed", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 105, 700, 0, { x: 100, y: 700 });
    expect(input.intent()).toEqual(STILL);
    input.move(1, 100 + STICK_RADIUS * 0.5, 700 - STICK_RADIUS * 0.5);
    const { forward, strafe, run } = input.intent();
    expect(forward).toBeGreaterThan(0);
    expect(strafe).toBeGreaterThan(0);
    expect(run).toBe(false);
  });

  it("measures from the first touch when no centre is given", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 50, 600, 0);
    input.move(1, 50, 600 - STICK_RADIUS);
    expect(input.intent().forward).toBeGreaterThan(0.9);
  });

  it("stops when the thumb lifts or the touch is cancelled", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.move(1, 0, -STICK_RADIUS);
    input.end(1, 0, -STICK_RADIUS, 50);
    expect(input.intent()).toEqual(STILL);

    input.begin("stick", 2, 0, 0, 100);
    input.move(2, 0, -STICK_RADIUS);
    input.cancel(2);
    expect(input.intent()).toEqual(STILL);
    expect(input.stickOffset()).toBeNull();
  });

  it("runs when the thumb is pushed to the edge", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.move(1, 0, -STICK_RADIUS * 2);
    expect(input.intent().run).toBe(true);
  });

  it("reports the thumb for drawing, held inside the base", () => {
    const input = new TouchInput();
    expect(input.stickOffset()).toBeNull();
    input.begin("stick", 1, 0, 0, 0);
    input.move(1, STICK_RADIUS * 3, 0);
    const offset = input.stickOffset()!;
    expect(offset.x).toBeCloseTo(STICK_RADIUS);
    expect(offset.y).toBeCloseTo(0);
  });

  it("keeps one thumb on the joystick: a second finger on it is ignored", () => {
    const input = new TouchInput();
    expect(input.begin("stick", 1, 0, 0, 0)).toBe(true);
    expect(input.begin("stick", 2, 0, 0, 0)).toBe(false);
    input.move(2, 0, -STICK_RADIUS);
    expect(input.intent()).toEqual(STILL);
  });
});

describe("TouchInput: looking around", () => {
  it("adds up the drag since the last read, then starts again", () => {
    const input = new TouchInput();
    input.begin("look", 7, 200, 300, 0);
    input.move(7, 210, 295);
    input.move(7, 230, 290);
    expect(input.takeLook()).toEqual({ dx: 30, dy: -10 });
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
    input.move(7, 231, 290);
    expect(input.takeLook()).toEqual({ dx: 1, dy: 0 });
  });

  it("does not turn the view with a finger that is not on the look area", () => {
    const input = new TouchInput();
    input.move(3, 500, 500);
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it("looks with one finger at a time", () => {
    const input = new TouchInput();
    expect(input.begin("look", 1, 0, 0, 0)).toBe(true);
    expect(input.begin("look", 2, 100, 100, 0)).toBe(false);
    input.move(2, 150, 150);
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
  });
});

describe("TouchInput: two thumbs at once", () => {
  it("walks and looks at the same time, each finger on its own", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 80, 700, 0);
    input.begin("look", 2, 300, 400, 0);
    input.move(1, 80, 700 - STICK_RADIUS * 0.6);
    input.move(2, 320, 380);
    expect(input.intent().forward).toBeGreaterThan(0);
    expect(input.takeLook()).toEqual({ dx: 20, dy: -20 });
    input.move(2, 330, 380);
    expect(input.intent().forward).toBeGreaterThan(0);
  });

  it("keeps walking when the look finger lifts, and keeps looking when the walking one does", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.begin("look", 2, 300, 400, 0);
    input.move(1, 0, -STICK_RADIUS);
    input.end(2, 300, 400, 1000);
    expect(input.intent().forward).toBeGreaterThan(0.9);

    input.begin("look", 3, 300, 400, 1100);
    input.end(1, 0, -STICK_RADIUS, 1200);
    input.move(3, 310, 400);
    expect(input.intent()).toEqual(STILL);
    expect(input.takeLook()).toEqual({ dx: 10, dy: 0 });
  });
});

describe("TouchInput: taps", () => {
  it("a quick touch that stays put is a tap, where it ended", () => {
    const input = new TouchInput();
    input.begin("look", 1, 200, 300, 1000);
    input.end(1, 202, 301, 1000 + TAP_MAX_MS - 10);
    expect(input.takeTap()).toEqual({ x: 202, y: 301 });
    expect(input.takeTap()).toBeNull();
  });

  it("a long press is not a tap", () => {
    const input = new TouchInput();
    input.begin("look", 1, 200, 300, 1000);
    input.end(1, 200, 300, 1000 + TAP_MAX_MS + 10);
    expect(input.takeTap()).toBeNull();
  });

  it("a drag is not a tap, however quick", () => {
    const input = new TouchInput();
    input.begin("look", 1, 200, 300, 1000);
    input.move(1, 200 + TAP_SLOP + 5, 300);
    input.end(1, 200 + TAP_SLOP + 5, 300, 1100);
    expect(input.takeTap()).toBeNull();
  });

  it("wobbling back to where it started after a drag is still not a tap", () => {
    const input = new TouchInput();
    input.begin("look", 1, 200, 300, 1000);
    input.move(1, 260, 300);
    input.move(1, 200, 300);
    input.end(1, 200, 300, 1100);
    expect(input.takeTap()).toBeNull();
  });

  it("a cancelled touch is not a tap", () => {
    const input = new TouchInput();
    input.begin("look", 1, 200, 300, 1000);
    input.cancel(1);
    expect(input.takeTap()).toBeNull();
  });

  it("the joystick never taps", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 80, 700, 1000);
    input.end(1, 80, 700, 1050);
    expect(input.takeTap()).toBeNull();
  });
});

describe("TouchInput: when something covers the scene", () => {
  it("ignores new touches while disabled", () => {
    const input = new TouchInput();
    input.setEnabled(false);
    expect(input.enabled).toBe(false);
    expect(input.begin("stick", 1, 0, 0, 0)).toBe(false);
    expect(input.begin("look", 2, 0, 0, 0)).toBe(false);
    input.move(1, 0, -STICK_RADIUS);
    input.move(2, 40, 0);
    expect(input.intent()).toEqual(STILL);
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it("lets go of everything when it is disabled mid-gesture, so nothing keeps walking on its own", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.begin("look", 2, 300, 400, 0);
    input.move(1, 0, -STICK_RADIUS);
    input.move(2, 340, 400);
    input.end(2, 340, 400, 10);
    input.setEnabled(false);
    expect(input.intent()).toEqual(STILL);
    expect(input.stickOffset()).toBeNull();
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
    expect(input.takeTap()).toBeNull();
  });

  it("works again once enabled, from a clean start", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.setEnabled(false);
    input.setEnabled(true);
    input.move(1, 0, -STICK_RADIUS);
    expect(input.intent()).toEqual(STILL);
    expect(input.begin("stick", 2, 0, 0, 0)).toBe(true);
    input.move(2, 0, -STICK_RADIUS);
    expect(input.intent().forward).toBeGreaterThan(0.9);
  });

  it("cancelAll (the page was hidden) clears every finger", () => {
    const input = new TouchInput();
    input.begin("stick", 1, 0, 0, 0);
    input.begin("look", 2, 0, 0, 0);
    input.move(1, 0, -STICK_RADIUS);
    input.cancelAll();
    expect(input.intent()).toEqual(STILL);
    input.move(2, 90, 0);
    expect(input.takeLook()).toEqual({ dx: 0, dy: 0 });
    expect(input.enabled).toBe(true);
  });
});
