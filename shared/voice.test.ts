import { describe, expect, it } from "vitest";
import { ROOM_NAME } from "./constants.ts";
import {
  peerVolume,
  peerWantsVideo,
  proximityVolume,
  VIDEO_SUBSCRIBE_DISTANCE,
  VIDEO_UNSUBSCRIBE_DISTANCE,
  VOICE_FULL_VOLUME_DISTANCE,
  VOICE_MAX_DISTANCE,
  voiceRoomName,
  wantsVideo,
} from "./voice.ts";

describe("voiceRoomName", () => {
  it("uses the shared office room outside every zone", () => {
    expect(voiceRoomName(null)).toBe(ROOM_NAME);
  });

  it("gives each zone a call of its own", () => {
    expect(voiceRoomName("meeting")).not.toBe(ROOM_NAME);
    expect(voiceRoomName("meeting")).not.toBe(voiceRoomName("lounge"));
  });

  it("is stable, so everyone in a zone lands in the same call", () => {
    expect(voiceRoomName("meeting")).toBe(voiceRoomName("meeting"));
  });
});

describe("voiceRoomName with a company prefix", () => {
  it("puts the prefix in front of every room, so two companies on one LiveKit project never meet", () => {
    expect(voiceRoomName(null, "acme-")).toBe(`acme-${ROOM_NAME}`);
    expect(voiceRoomName("meeting", "acme-")).toBe(
      `acme-${voiceRoomName("meeting")}`,
    );
    expect(voiceRoomName(null, "acme-")).not.toBe(voiceRoomName(null, "beta-"));
  });

  it("changes nothing without one", () => {
    expect(voiceRoomName(null, "")).toBe(voiceRoomName(null));
    expect(voiceRoomName("meeting", "")).toBe(voiceRoomName("meeting"));
  });
});

describe("peerVolume", () => {
  it("fades with distance in the open office", () => {
    expect(peerVolume(1, null)).toBe(1);
    expect(peerVolume(6, null)).toBeCloseTo(proximityVolume(6));
    expect(peerVolume(VOICE_MAX_DISTANCE + 1, null)).toBe(0);
  });

  it("is full volume for everybody in a private zone, however far", () => {
    // The meeting room is 13.7 m long: proximity alone would silence its far end
    expect(peerVolume(VOICE_MAX_DISTANCE + 3, "meeting")).toBe(1);
    expect(peerVolume(0, "meeting")).toBe(1);
  });

  it("still treats an unknown distance as silence in the open office", () => {
    expect(peerVolume(NaN, null)).toBe(0);
  });
});

describe("peerWantsVideo", () => {
  it("follows proximity in the open office", () => {
    expect(peerWantsVideo(VIDEO_SUBSCRIBE_DISTANCE - 0.1, false, null)).toBe(
      true,
    );
    expect(peerWantsVideo(VIDEO_SUBSCRIBE_DISTANCE + 0.1, false, null)).toBe(
      false,
    );
  });

  it("wants everybody's video in a private zone, however far", () => {
    expect(
      peerWantsVideo(VIDEO_UNSUBSCRIBE_DISTANCE + 5, false, "meeting"),
    ).toBe(true);
  });
});

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
