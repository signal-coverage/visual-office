import { describe, expect, it } from "vitest";
import {
  MAX_PITCH,
  MOUSE_SENSITIVITY,
  SEAT_LOOK_LIMIT,
  TOUCH_LOOK_GAIN,
  turnView,
} from "./look";
import { clampSeatedYaw } from "./seatedPose";

const START = { yaw: 0.4, pitch: 0.1 };

describe("turnView", () => {
  it("turns right when the pointer moves right, as the mouse always did", () => {
    const view = turnView(START, 100, 0, MOUSE_SENSITIVITY, null);
    expect(view.yaw).toBeCloseTo(START.yaw - 100 * MOUSE_SENSITIVITY);
    expect(view.pitch).toBe(START.pitch);
  });

  it("looks up when the pointer moves up the screen", () => {
    const view = turnView(START, 0, -50, MOUSE_SENSITIVITY, null);
    expect(view.pitch).toBeCloseTo(START.pitch + 50 * MOUSE_SENSITIVITY);
  });

  it("stops looking at straight up and straight down", () => {
    expect(turnView(START, 0, -1e6, MOUSE_SENSITIVITY, null).pitch).toBe(
      MAX_PITCH,
    );
    expect(turnView(START, 0, 1e6, MOUSE_SENSITIVITY, null).pitch).toBe(
      -MAX_PITCH,
    );
  });

  it("gives, for the mouse, exactly what the game always computed", () => {
    const sensitivity = MOUSE_SENSITIVITY * 1.7;
    let yaw = 0.25;
    let pitch = -0.3;
    let view = { yaw, pitch };
    for (const [dx, dy] of [
      [12, -4],
      [-300, 20],
      [5, 900],
      [0, -2000],
    ]) {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
      view = turnView(view, dx, dy, sensitivity, null);
      expect(view).toEqual({ yaw, pitch });
    }
  });

  it("a seated person only turns their head so far from the way the chair faces", () => {
    const chair = 1;
    const view = turnView({ yaw: chair, pitch: 0 }, -1500, 0, 0.002, chair);
    expect(view.yaw).toBe(clampSeatedYaw(chair + 3, chair, SEAT_LOOK_LIMIT));
    expect(Math.abs(view.yaw - chair)).toBeCloseTo(SEAT_LOOK_LIMIT);
    expect(
      turnView({ yaw: chair, pitch: 0 }, -10, 0, 0.002, chair).yaw,
    ).toBeCloseTo(chair + 0.02);
  });

  it("a finger turns the view faster than a mouse for the same distance", () => {
    expect(TOUCH_LOOK_GAIN).toBeGreaterThan(1);
  });
});
