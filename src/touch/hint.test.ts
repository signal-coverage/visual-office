import { describe, expect, it } from "vitest";
import {
  hintSeen,
  HINT_STORAGE_KEY,
  markHintSeen,
  type HintStorage,
} from "./hint";

function memory(): HintStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const broken: HintStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("the first-run hint of the touch controls", () => {
  it("is shown to somebody who has not seen it", () => {
    expect(hintSeen(memory())).toBe(false);
  });

  it("is not shown again once it was dismissed", () => {
    const storage = memory();
    markHintSeen(storage);
    expect(hintSeen(storage)).toBe(true);
    expect(storage.data.get(HINT_STORAGE_KEY)).toBe("1");
  });

  it("is shown when the browser keeps nothing (private window, blocked site data), without failing", () => {
    expect(hintSeen(broken)).toBe(false);
    expect(() => markHintSeen(broken)).not.toThrow();
    expect(hintSeen(null)).toBe(false);
    expect(() => markHintSeen(null)).not.toThrow();
  });
});
