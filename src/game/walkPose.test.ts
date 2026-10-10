import { describe, expect, it } from "vitest";
import { RUN_SPEED, WALK_SPEED } from "../../shared/constants.ts";
import { walkPose } from "./walkPose";

const peak = (speed: number) => {
  let max = 0;
  for (let phase = 0; phase < Math.PI * 2; phase += 0.05) {
    max = Math.max(max, Math.abs(walkPose(phase, speed).legL));
  }
  return max;
};

describe("walkPose", () => {
  it("stands still when not moving", () => {
    for (const phase of [0, 1, 2.5, 4]) {
      expect(walkPose(phase, 0)).toEqual({
        legL: 0,
        legR: 0,
        armL: 0,
        armR: 0,
        bob: 0,
      });
    }
  });

  it("swings the legs in opposition and each arm against its same-side leg", () => {
    const pose = walkPose(Math.PI / 3, WALK_SPEED);
    expect(pose.legL).toBeCloseTo(-pose.legR);
    expect(pose.armL).toBeCloseTo(-pose.legL * 0.8);
    expect(pose.armR).toBeCloseTo(-pose.legR * 0.8);
    expect(Math.sign(pose.legL)).not.toBe(Math.sign(pose.armL));
  });

  it("swings wider the faster it goes, up to a cap", () => {
    expect(peak(WALK_SPEED / 2)).toBeLessThan(peak(WALK_SPEED));
    expect(peak(WALK_SPEED)).toBeLessThanOrEqual(peak(RUN_SPEED));
    expect(peak(RUN_SPEED)).toBeCloseTo(peak(RUN_SPEED * 3)); // capped
  });

  it("bobs the body up, never down", () => {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
      expect(walkPose(phase, WALK_SPEED).bob).toBeGreaterThanOrEqual(0);
    }
  });
});
