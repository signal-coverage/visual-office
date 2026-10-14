import { describe, expect, it } from "vitest";
import { EMOTE_DURATION_MS, EMOTES } from "../../shared/emotes.ts";
import { emotePose } from "./emotePose";

const REST = {
  armL: { x: 0, z: 0 },
  armR: { x: 0, z: 0 },
  bob: 0,
  sway: 0,
};

describe("emotePose", () => {
  it("is a number for every limb, for every emote at every moment", () => {
    for (const emote of EMOTES)
      for (let t = 0; t <= EMOTE_DURATION_MS; t += 100) {
        const pose = emotePose(emote, t);
        const numbers = [
          pose.armL.x,
          pose.armL.z,
          pose.armR.x,
          pose.armR.z,
          pose.bob,
          pose.sway,
        ];
        for (const value of numbers)
          expect(Number.isFinite(value), `${emote} at ${t}`).toBe(true);
      }
  });

  it("raises an arm above the shoulder for waving and raising a hand", () => {
    for (const emote of ["wave", "raise"] as const) {
      const pose = emotePose(emote, 800);
      expect(Math.max(pose.armR.x, pose.armL.x)).toBeGreaterThan(Math.PI / 2);
    }
  });

  it("waves from side to side", () => {
    const values = new Set<number>();
    for (let t = 400; t < 1_400; t += 50)
      values.add(Math.round(emotePose("wave", t).armR.z * 100));
    expect(values.size).toBeGreaterThan(3);
  });

  it("brings the arms down before it starts and once it is over", () => {
    for (const emote of EMOTES)
      for (const t of [-100, EMOTE_DURATION_MS, EMOTE_DURATION_MS + 100])
        expect(emotePose(emote, t), `${emote} at ${t}`).toEqual(REST);
  });

  it("eases in, so an arm does not jump up", () => {
    expect(emotePose("raise", 20).armR.x).toBeLessThan(
      emotePose("raise", 800).armR.x,
    );
  });

  it("eases out, so it does not drop at the end", () => {
    expect(emotePose("raise", EMOTE_DURATION_MS - 20).armR.x).toBeLessThan(
      emotePose("raise", EMOTE_DURATION_MS - 800).armR.x,
    );
  });
});
