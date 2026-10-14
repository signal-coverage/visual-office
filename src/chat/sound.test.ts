import { describe, expect, it } from "vitest";
import { BEEPS, beepLength, type BeepKind } from "./sound";

describe("BEEPS", () => {
  it("are short, so they never get in the way of a conversation", () => {
    for (const kind of Object.keys(BEEPS) as BeepKind[]) {
      expect(BEEPS[kind].length).toBeGreaterThan(0);
      expect(beepLength(kind)).toBeLessThanOrEqual(0.5);
    }
  });

  it("sound different, so a knock is not taken for a message", () => {
    expect(BEEPS.knock).not.toEqual(BEEPS.message);
  });

  it("only use audible notes", () => {
    for (const notes of Object.values(BEEPS))
      for (const note of notes) {
        expect(note.frequency).toBeGreaterThan(200);
        expect(note.frequency).toBeLessThan(4000);
        expect(note.duration).toBeGreaterThan(0);
      }
  });
});
