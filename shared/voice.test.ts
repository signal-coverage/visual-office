import { describe, expect, it } from "vitest";
import {
  proximityVolume,
  VIDEO_SUBSCRIBE_DISTANCE,
  VIDEO_UNSUBSCRIBE_DISTANCE,
  VOICE_FULL_VOLUME_DISTANCE,
  VOICE_MAX_DISTANCE,
  wantsVideo,
} from "./voice.ts";

describe("wantsVideo", () => {
  it("starts receiving video once someone comes close enough", () => {
    expect(wantsVideo(VIDEO_SUBSCRIBE_DISTANCE - 0.1, false)).toBe(true);
    expect(wantsVideo(VIDEO_SUBSCRIBE_DISTANCE + 0.1, false)).toBe(false);
  });

  it("keeps receiving video a bit past the start distance (no flicker at the edge)", () => {
    const between = (VIDEO_SUBSCRIBE_DISTANCE + VIDEO_UNSUBSCRIBE_DISTANCE) / 2;
    expect(wantsVideo(between, true)).toBe(true);
    expect(wantsVideo(between, false)).toBe(false);
  });

  it("stops receiving video when they walk far away", () => {
    expect(wantsVideo(VIDEO_UNSUBSCRIBE_DISTANCE + 0.1, true)).toBe(false);
  });

  it("never wants video from an invalid distance", () => {
    expect(wantsVideo(NaN, true)).toBe(false);
  });

  it("subscribes closer than it unsubscribes", () => {
    expect(VIDEO_SUBSCRIBE_DISTANCE).toBeLessThan(VIDEO_UNSUBSCRIBE_DISTANCE);
  });
});

describe("proximityVolume", () => {
  it("is full volume up close", () => {
    expect(proximityVolume(0)).toBe(1);
    expect(proximityVolume(VOICE_FULL_VOLUME_DISTANCE)).toBe(1);
  });

  it("is silent at and beyond the maximum distance", () => {
    expect(proximityVolume(VOICE_MAX_DISTANCE)).toBe(0);
    expect(proximityVolume(VOICE_MAX_DISTANCE + 50)).toBe(0);
  });

  it("fades linearly in between", () => {
    const mid = (VOICE_FULL_VOLUME_DISTANCE + VOICE_MAX_DISTANCE) / 2;
    expect(proximityVolume(mid)).toBeCloseTo(0.5);
  });

  it("never increases as the distance grows", () => {
    let previous = proximityVolume(0);
    for (let d = 0.5; d <= VOICE_MAX_DISTANCE + 2; d += 0.5) {
      const volume = proximityVolume(d);
      expect(volume).toBeLessThanOrEqual(previous);
      previous = volume;
    }
  });

  it("treats invalid distances as silence", () => {
    expect(proximityVolume(NaN)).toBe(0);
  });
});
