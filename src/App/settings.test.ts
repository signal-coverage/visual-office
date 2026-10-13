import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  MAX_SENSITIVITY,
  MIN_SENSITIVITY,
  sanitizeSettings,
  settingsFromJson,
} from "./settings";

describe("sanitizeSettings", () => {
  it("keeps valid settings as they are", () => {
    expect(
      sanitizeSettings({ mouseSensitivity: 1.5, showHints: false }),
    ).toEqual({ mouseSensitivity: 1.5, showHints: false });
  });

  it("falls back to the default for each setting that is missing or not valid", () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(
      sanitizeSettings({ mouseSensitivity: "fast", showHints: "no" }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      sanitizeSettings({ mouseSensitivity: NaN, showHints: null }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps one setting when the other is wrong", () => {
    expect(sanitizeSettings({ mouseSensitivity: 2, showHints: 7 })).toEqual({
      mouseSensitivity: 2,
      showHints: DEFAULT_SETTINGS.showHints,
    });
  });

  it("keeps the sensitivity within what is usable, so a wrong value cannot make the game unplayable", () => {
    expect(sanitizeSettings({ mouseSensitivity: 0 }).mouseSensitivity).toBe(
      MIN_SENSITIVITY,
    );
    expect(sanitizeSettings({ mouseSensitivity: -3 }).mouseSensitivity).toBe(
      MIN_SENSITIVITY,
    );
    expect(sanitizeSettings({ mouseSensitivity: 999 }).mouseSensitivity).toBe(
      MAX_SENSITIVITY,
    );
    expect(
      sanitizeSettings({ mouseSensitivity: Infinity }).mouseSensitivity,
    ).toBe(DEFAULT_SETTINGS.mouseSensitivity);
  });

  it("is the default for what is not even an object", () => {
    for (const raw of [null, undefined, "text", 42, []])
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("drops anything that is not a setting", () => {
    expect(
      Object.keys(
        sanitizeSettings({ ...DEFAULT_SETTINGS, admin: true }),
      ).sort(),
    ).toEqual(["mouseSensitivity", "showHints"]);
  });
});

describe("settingsFromJson", () => {
  it("reads saved settings", () => {
    expect(
      settingsFromJson(
        JSON.stringify({ mouseSensitivity: 0.8, showHints: false }),
      ),
    ).toEqual({ mouseSensitivity: 0.8, showHints: false });
  });

  it("is the default when nothing was saved, or what was saved is damaged", () => {
    expect(settingsFromJson(null)).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromJson("{ not json")).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromJson("")).toEqual(DEFAULT_SETTINGS);
  });
});
