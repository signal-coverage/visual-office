import { describe, expect, it } from "vitest";
import { LEG } from "./avatarLayout";
import {
  clampSeatedYaw,
  SEATED_EYE_HEIGHT,
  seatedPose,
  SEAT_HEIGHT,
} from "./seatedPose";

describe("seatedPose", () => {
  it("lowers the body until the hips rest on the seat", () => {
    const pose = seatedPose(false);
    expect(LEG.height + pose.drop).toBeCloseTo(SEAT_HEIGHT);
  });

  it("puts the thighs forward and the lower legs down", () => {
    const pose = seatedPose(false);
    expect(pose.thigh).toBeCloseTo(Math.PI / 2);
    expect(pose.thighShare + pose.shinShare).toBeCloseTo(1);
    expect(pose.thighShare).toBeGreaterThan(0.3);
    expect(pose.thighShare).toBeLessThan(0.7);
  });

  it("brings the feet to the floor, with the shin straight down", () => {
    const pose = seatedPose(false);
    const feet = SEAT_HEIGHT - LEG.height * pose.shinShare;
    expect(feet).toBeGreaterThanOrEqual(0);
    expect(feet).toBeLessThan(0.1);
  });

  it("keeps the arms low when away from a desk and puts them forward at one", () => {
    const rest = seatedPose(false);
    const typing = seatedPose(true);
    expect(rest.arm).toBeGreaterThanOrEqual(0);
    expect(rest.arm).toBeLessThan(0.6);
    expect(typing.arm).toBeGreaterThan(1);
    expect(typing.arm).toBeLessThan(Math.PI / 2 + 0.2);
  });

  it("is made of numbers", () => {
    for (const atDesk of [true, false])
      for (const value of Object.values(seatedPose(atDesk)))
        expect(Number.isFinite(value)).toBe(true);
  });
});

describe("the seated eye", () => {
  it("is lower than standing by as much as the body is lowered", () => {
    expect(SEATED_EYE_HEIGHT).toBeCloseTo(1.65 + seatedPose(false).drop);
    expect(SEATED_EYE_HEIGHT).toBeLessThan(1.65);
    expect(SEATED_EYE_HEIGHT).toBeGreaterThan(1);
  });
});

describe("clampSeatedYaw", () => {
  const limit = Math.PI / 2;

  it("leaves a turn within the limit as it is", () => {
    expect(clampSeatedYaw(0.5, 0, limit)).toBeCloseTo(0.5);
  });

  it("stops the turn at the limit on either side", () => {
    expect(clampSeatedYaw(3, 0, limit)).toBeCloseTo(limit);
    expect(clampSeatedYaw(-3, 0, limit)).toBeCloseTo(-limit);
  });

  it("measures from the seat's own direction", () => {
    expect(clampSeatedYaw(Math.PI + 2, Math.PI, limit)).toBeCloseTo(
      Math.PI + limit,
    );
  });

  it("handles a yaw that has gone round more than once", () => {
    expect(clampSeatedYaw(0.3 + 4 * Math.PI, 0, limit)).toBeCloseTo(
      0.3 + 4 * Math.PI,
    );
    expect(clampSeatedYaw(0.3 - 6 * Math.PI, 0.3, limit)).toBeCloseTo(
      0.3 - 6 * Math.PI,
    );
  });
});
