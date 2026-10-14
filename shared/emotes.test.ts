import { describe, expect, it } from "vitest";
import {
  EMOTE_DURATION_MS,
  EMOTE_ICONS,
  EMOTE_LABELS,
  EMOTES,
  emoteByKey,
  emoteIconState,
  sanitizeEmote,
} from "./emotes.ts";

describe("the emotes", () => {
  it("are a short list, each with a label and an icon", () => {
    expect(EMOTES.length).toBeGreaterThanOrEqual(4);
    expect(EMOTES.length).toBeLessThanOrEqual(9);
    for (const emote of EMOTES) {
      expect(EMOTE_LABELS[emote].length).toBeGreaterThan(0);
      expect(EMOTE_ICONS[emote].length).toBeGreaterThan(0);
    }
  });

  it("last a few seconds", () => {
    expect(EMOTE_DURATION_MS).toBeGreaterThanOrEqual(2_000);
    expect(EMOTE_DURATION_MS).toBeLessThanOrEqual(5_000);
  });
});

describe("sanitizeEmote", () => {
  it("takes an emote from the fixed list", () => {
    for (const emote of EMOTES) expect(sanitizeEmote({ emote })).toBe(emote);
  });

  it("is nothing for what is not on the list or not a message", () => {
    for (const raw of [
      null,
      undefined,
      "wave",
      7,
      [],
      {},
      { emote: "flip" },
      { emote: "WAVE" },
      { emote: 0 },
      { emote: "constructor" },
      { emote: "__proto__" },
    ])
      expect(sanitizeEmote(raw), JSON.stringify(raw)).toBeNull();
  });
});

describe("emoteByKey", () => {
  it("maps 1 to the first emote and so on", () => {
    EMOTES.forEach((emote, i) =>
      expect(emoteByKey(`Digit${i + 1}`)).toBe(emote),
    );
  });

  it("is nothing past the list or for another key", () => {
    expect(emoteByKey(`Digit${EMOTES.length + 1}`)).toBeNull();
    expect(emoteByKey("Digit0")).toBeNull();
    expect(emoteByKey("KeyA")).toBeNull();
  });
});

describe("emoteIconState", () => {
  it("is fully visible at first", () => {
    expect(emoteIconState(0)).toMatchObject({
      visible: true,
      opacity: 1,
      lift: 0,
    });
  });

  it("goes higher as time passes", () => {
    expect(emoteIconState(1_500).lift).toBeGreaterThan(
      emoteIconState(500).lift,
    );
  });

  it("fades out at the end and is gone when the emote is over", () => {
    const fading = emoteIconState(EMOTE_DURATION_MS - 100);
    expect(fading.opacity).toBeGreaterThan(0);
    expect(fading.opacity).toBeLessThan(1);
    expect(emoteIconState(EMOTE_DURATION_MS).visible).toBe(false);
    expect(emoteIconState(EMOTE_DURATION_MS + 5_000).visible).toBe(false);
  });

  it("is not visible before it starts", () => {
    expect(emoteIconState(-1).visible).toBe(false);
  });
});
