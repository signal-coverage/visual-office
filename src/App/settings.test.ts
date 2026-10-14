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
    const settings = {
      mouseSensitivity: 1.5,
      showHints: false,
      notificationSound: false,
      desktopNotifications: true,
      quality: "low" as const,
    };
    expect(sanitizeSettings(settings)).toEqual(settings);
  });

  it("falls back to the default for each setting that is missing or not valid", () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(
      sanitizeSettings({
        mouseSensitivity: "fast",
        showHints: "no",
        notificationSound: "yes",
        desktopNotifications: 1,
        quality: "ultra",
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      sanitizeSettings({ mouseSensitivity: NaN, showHints: null }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("has the sound on and the desktop notifications off until somebody chooses", () => {
    expect(DEFAULT_SETTINGS.notificationSound).toBe(true);
    expect(DEFAULT_SETTINGS.desktopNotifications).toBe(false);
  });

  it("keeps one setting when the other is wrong", () => {
    expect(sanitizeSettings({ mouseSensitivity: 2, showHints: 7 })).toEqual({
      ...DEFAULT_SETTINGS,
      mouseSensitivity: 2,
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

  it("is automatic about quality until somebody chooses", () => {
    expect(DEFAULT_SETTINGS.quality).toBe("auto");
  });

  it("keeps each quality choice and drops anything else", () => {
    for (const quality of ["auto", "high", "low"] as const)
      expect(sanitizeSettings({ quality }).quality).toBe(quality);
    for (const quality of ["ULTRA", "", 1, null, undefined, {}])
      expect(sanitizeSettings({ quality }).quality).toBe("auto");
  });

  it("drops anything that is not a setting", () => {
    expect(
      Object.keys(
        sanitizeSettings({ ...DEFAULT_SETTINGS, admin: true }),
      ).sort(),
    ).toEqual([
      "desktopNotifications",
      "mouseSensitivity",
      "notificationSound",
      "quality",
      "showHints",
    ]);
  });
});

describe("settingsFromJson", () => {
  it("reads saved settings", () => {
    const saved = {
      mouseSensitivity: 0.8,
      showHints: false,
      notificationSound: false,
      desktopNotifications: true,
      quality: "low" as const,
    };
    expect(settingsFromJson(JSON.stringify(saved))).toEqual(saved);
  });

  it("is the default when nothing was saved, or what was saved is damaged", () => {
    expect(settingsFromJson(null)).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromJson("{ not json")).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromJson("")).toEqual(DEFAULT_SETTINGS);
  });
});
