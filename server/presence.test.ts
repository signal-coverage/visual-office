import { describe, expect, it } from "vitest";
import {
  cooledDown,
  EMOTE_COOLDOWN_MS,
  mayChangeStatus,
  mayEmote,
  STATUS_COOLDOWN_MS,
} from "./presence.ts";

describe("mayChangeStatus", () => {
  it("lets everybody for now: the company may decide who can, later", () => {
    expect(mayChangeStatus(null)).toBe(true);
    expect(
      mayChangeStatus({ id: "u", email: null, name: "Ana", isAdmin: false }),
    ).toBe(true);
  });
});

describe("mayEmote", () => {
  it("lets everybody for now", () => {
    expect(mayEmote(null)).toBe(true);
    expect(
      mayEmote({ id: "u", email: null, name: "Ana", isAdmin: false }),
    ).toBe(true);
  });
});

describe("cooledDown", () => {
  it("lets the first one through", () => {
    expect(cooledDown(undefined, 1_000, STATUS_COOLDOWN_MS)).toBe(true);
  });

  it("holds back what comes too close to the last one, so nobody can flood the room", () => {
    expect(
      cooledDown(1_000, 1_000 + STATUS_COOLDOWN_MS - 1, STATUS_COOLDOWN_MS),
    ).toBe(false);
  });

  it("lets one through once the time has passed", () => {
    expect(
      cooledDown(1_000, 1_000 + STATUS_COOLDOWN_MS, STATUS_COOLDOWN_MS),
    ).toBe(true);
  });

  it("waits between emotes, and the wait is not zero", () => {
    expect(EMOTE_COOLDOWN_MS).toBeGreaterThan(0);
    expect(cooledDown(0, EMOTE_COOLDOWN_MS - 1, EMOTE_COOLDOWN_MS)).toBe(false);
  });
});
