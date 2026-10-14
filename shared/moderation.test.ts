import { describe, expect, it } from "vitest";
import {
  BANNED_CODE,
  DEFAULT_BAN_MINUTES,
  KICKED_CODE,
  MAX_BAN_MINUTES,
  messageForModerationCode,
  MIN_BAN_MINUTES,
  moderationReplyText,
  REFUSAL_TEXT,
  sanitizeModerationRequest,
} from "./moderation.ts";

describe("sanitizeModerationRequest", () => {
  it("takes a known action on a target", () => {
    for (const action of ["mute", "unmute", "kick", "ban", "unban"]) {
      expect(
        sanitizeModerationRequest({ action, target: "abc" }),
      ).toMatchObject({ action, target: "abc" });
    }
  });

  it("refuses anything that is not an object with a known action and a target", () => {
    for (const payload of [
      null,
      undefined,
      "kick",
      42,
      [],
      {},
      { action: "kick" },
      { target: "abc" },
      { action: "delete", target: "abc" },
      { action: "kick", target: "" },
      { action: "kick", target: 7 },
      { action: "kick", target: "x".repeat(65) },
    ]) {
      expect(sanitizeModerationRequest(payload), JSON.stringify(payload)).toBe(
        null,
      );
    }
  });

  it("gives a ban the default length when none is asked for", () => {
    expect(
      sanitizeModerationRequest({ action: "ban", target: "abc" })?.minutes,
    ).toBe(DEFAULT_BAN_MINUTES);
    expect(
      sanitizeModerationRequest({
        action: "ban",
        target: "abc",
        minutes: "soon",
      })?.minutes,
    ).toBe(DEFAULT_BAN_MINUTES);
    expect(
      sanitizeModerationRequest({
        action: "ban",
        target: "abc",
        minutes: Number.NaN,
      })?.minutes,
    ).toBe(DEFAULT_BAN_MINUTES);
  });

  it("keeps a ban inside the bounds and in whole minutes", () => {
    const minutes = (value: number) =>
      sanitizeModerationRequest({
        action: "ban",
        target: "abc",
        minutes: value,
      })?.minutes;
    expect(minutes(30)).toBe(30);
    expect(minutes(0)).toBe(MIN_BAN_MINUTES);
    expect(minutes(-5)).toBe(MIN_BAN_MINUTES);
    expect(minutes(10_000)).toBe(MAX_BAN_MINUTES);
    expect(minutes(Number.POSITIVE_INFINITY)).toBe(MAX_BAN_MINUTES);
    expect(minutes(9.6)).toBe(10);
  });

  it("gives no length to an action that is not a ban", () => {
    expect(
      sanitizeModerationRequest({ action: "kick", target: "abc", minutes: 30 }),
    ).toEqual({ action: "kick", target: "abc" });
  });
});

describe("close codes", () => {
  it("has a code of its own for being removed and for being banned", () => {
    expect(new Set([KICKED_CODE, BANNED_CODE]).size).toBe(2);
    expect(messageForModerationCode(KICKED_CODE)).toBe(
      "You were removed from the office by a moderator.",
    );
    expect(messageForModerationCode(BANNED_CODE)).toMatch(/moderator/);
    expect(messageForModerationCode(1000)).toBeNull();
  });
});

describe("moderationReplyText", () => {
  it("says what was done, with the length of a ban", () => {
    expect(
      moderationReplyText({ ok: true, action: "kick", name: "Beto" }),
    ).toBe("Beto was removed from the office.");
    expect(
      moderationReplyText({
        ok: true,
        action: "ban",
        name: "Beto",
        minutes: 10,
      }),
    ).toBe("Beto was banned for 10 minutes.");
    expect(
      moderationReplyText({
        ok: true,
        action: "ban",
        name: "Beto",
        minutes: 1,
      }),
    ).toBe("Beto was banned for 1 minute.");
  });

  it("says why it was refused", () => {
    expect(moderationReplyText({ ok: false, reason: "admin" })).toBe(
      REFUSAL_TEXT.admin,
    );
  });
});
