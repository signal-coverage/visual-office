import { describe, expect, it } from "vitest";
import { DEFAULT_NAME, MAX_NAME_LENGTH } from "../shared/name.ts";
import { nameForPlayer } from "./playerName.ts";

describe("nameForPlayer", () => {
  describe("signed in, and people may not choose their name", () => {
    it("is the profile name, whatever the client sends", () => {
      expect(
        nameForPlayer({
          profileName: "Ana",
          allowEdit: false,
          requested: "Eve",
        }),
      ).toBe("Ana");
      expect(
        nameForPlayer({ profileName: "Ana", allowEdit: false, requested: 42 }),
      ).toBe("Ana");
    });
  });

  describe("signed in, and people may choose their name", () => {
    it("is the sanitized name the client sent", () => {
      expect(
        nameForPlayer({
          profileName: "Ana",
          allowEdit: true,
          requested: "  Eve\u0000  Smith ",
        }),
      ).toBe("Eve Smith");
    });

    it("is cut to the maximum length", () => {
      expect(
        nameForPlayer({
          profileName: "Ana",
          allowEdit: true,
          requested: "x".repeat(MAX_NAME_LENGTH + 5),
        }),
      ).toHaveLength(MAX_NAME_LENGTH);
    });

    it("falls back to the profile name when the sent one is empty or not text", () => {
      for (const requested of [
        "",
        "   ",
        "\u0007\u0000",
        undefined,
        null,
        7,
        {},
      ])
        expect(
          nameForPlayer({ profileName: "Ana", allowEdit: true, requested }),
        ).toBe("Ana");
    });
  });

  describe("not signed in", () => {
    it("is the sanitized name the client sent, whatever the setting says", () => {
      for (const allowEdit of [true, false])
        expect(
          nameForPlayer({ profileName: null, allowEdit, requested: " Eve " }),
        ).toBe("Eve");
    });

    it("is the default name when there is none", () => {
      expect(
        nameForPlayer({ profileName: null, allowEdit: false, requested: "" }),
      ).toBe(DEFAULT_NAME);
    });
  });
});
