import { describe, expect, it } from "vitest";
import {
  DEAD_ZONE,
  joystickVector,
  RUN_AT,
  STICK_RADIUS,
  type StickVector,
} from "./joystick";

const R = STICK_RADIUS;
const still: StickVector = { forward: 0, strafe: 0, run: false };

describe("joystickVector", () => {
  it("is still at the centre and inside the dead zone", () => {
    expect(joystickVector(0, 0)).toEqual(still);
    expect(joystickVector(R * DEAD_ZONE * 0.9, 0)).toEqual(still);
    expect(joystickVector(0, -R * DEAD_ZONE * 0.9)).toEqual(still);
  });

  it("pushing up is forward and pushing down is backward (the screen's y grows downward)", () => {
    expect(joystickVector(0, -R * 0.6).forward).toBeGreaterThan(0);
    expect(joystickVector(0, R * 0.6).forward).toBeLessThan(0);
    expect(joystickVector(0, -R * 0.6).strafe).toBeCloseTo(0);
  });

  it("pushing right is a strafe to the right and left to the left", () => {
    expect(joystickVector(R * 0.6, 0).strafe).toBeGreaterThan(0);
    expect(joystickVector(-R * 0.6, 0).strafe).toBeLessThan(0);
    expect(joystickVector(R * 0.6, 0).forward).toBeCloseTo(0);
  });

  it("grows smoothly from nothing at the edge of the dead zone", () => {
    const edge = joystickVector(R * DEAD_ZONE + 0.001, 0).strafe;
    const middle = joystickVector(R * 0.5, 0).strafe;
    const far = joystickVector(R * 0.8, 0).strafe;
    expect(edge).toBeLessThan(0.01);
    expect(middle).toBeGreaterThan(edge);
    expect(far).toBeGreaterThan(middle);
    expect(far).toBeLessThanOrEqual(1);
  });

  it("never asks for more than full speed, however far the thumb goes", () => {
    const { forward, strafe } = joystickVector(R * 4, -R * 4);
    expect(Math.hypot(forward, strafe)).toBeCloseTo(1);
  });

  it("walks until the thumb is pushed near the edge, then runs at full speed", () => {
    expect(joystickVector(0, -R * (RUN_AT - 0.05)).run).toBe(false);
    const running = joystickVector(0, -R * RUN_AT);
    expect(running.run).toBe(true);
    expect(running.forward).toBeCloseTo(1);
    expect(joystickVector(0, -R * 3).run).toBe(true);
  });

  it("keeps the direction of the push on a diagonal", () => {
    const { forward, strafe } = joystickVector(R * 0.5, -R * 0.5);
    expect(forward).toBeCloseTo(strafe);
    expect(forward).toBeGreaterThan(0);
  });

  it("takes a radius of its own", () => {
    expect(joystickVector(10, 0, 100)).toEqual(still);
    expect(joystickVector(60, 0, 100).strafe).toBeGreaterThan(0);
  });
});
