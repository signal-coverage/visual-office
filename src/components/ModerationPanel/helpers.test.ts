import { describe, expect, it } from "vitest";
import { confirmQuestion, needsConfirmation } from "./helpers";

describe("needsConfirmation", () => {
  it("asks before removing or banning, which cannot be taken back in a click", () => {
    expect(needsConfirmation("kick")).toBe(true);
    expect(needsConfirmation("ban")).toBe(true);
  });

  it("does not ask before muting or letting somebody speak again", () => {
    expect(needsConfirmation("mute")).toBe(false);
    expect(needsConfirmation("unmute")).toBe(false);
    expect(needsConfirmation("unban")).toBe(false);
  });
});

describe("confirmQuestion", () => {
  it("says who and, for a ban, for how long", () => {
    expect(confirmQuestion("kick", "Beto", 10)).toBe(
      "Remove Beto from the office?",
    );
    expect(confirmQuestion("ban", "Beto", 10)).toBe(
      "Remove Beto and ban them for 10 minutes?",
    );
    expect(confirmQuestion("ban", "Beto", 1)).toBe(
      "Remove Beto and ban them for 1 minute?",
    );
  });
});
