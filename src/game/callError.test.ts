import { describe, expect, it } from "vitest";
import { callErrorText } from "./callError";

const named = (name: string, message = "x") => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("callErrorText", () => {
  it("says the microphone is blocked, and where to allow it, when the browser or the person refused it", () => {
    for (const name of ["NotAllowedError", "PermissionDeniedError"]) {
      const text = callErrorText(named(name));
      expect(text).toMatch(/microphone/i);
      expect(text).toMatch(/blocked/i);
      expect(text).toMatch(/browser settings|site settings/i);
    }
  });

  it("says there is no microphone", () => {
    expect(callErrorText(named("NotFoundError"))).toMatch(/no microphone/i);
    expect(callErrorText(named("OverconstrainedError"))).toMatch(
      /no microphone/i,
    );
  });

  it("says another app has it", () => {
    expect(callErrorText(named("NotReadableError"))).toMatch(
      /another app|in use/i,
    );
  });

  it("says a page that is not secure cannot use it", () => {
    expect(callErrorText(named("DeviceUnsupportedError"))).toMatch(/https/i);
    expect(callErrorText(named("SecurityError"))).toMatch(/https/i);
  });

  it("says the call could not be reached for anything else, and never shows the raw error", () => {
    const text = callErrorText(
      new Error("WebSocket closed with code 1006 token=secret"),
    );
    expect(text).toMatch(/voice call/i);
    expect(text).not.toMatch(/secret|1006/);
    expect(callErrorText("boom")).toBe(text);
    expect(callErrorText(undefined)).toBe(text);
  });

  it("every message tells what to do next", () => {
    for (const name of [
      "NotAllowedError",
      "NotFoundError",
      "NotReadableError",
      "DeviceUnsupportedError",
      "Other",
    ])
      expect(callErrorText(named(name))).toMatch(/try again|tap|allow|plug/i);
  });
});
