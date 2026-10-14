import { describe, expect, it } from "vitest";
import {
  ACCESSORIES,
  APPEARANCE_FIELDS,
  FACIAL_HAIR,
  GLASSES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  PANTS_COLORS,
  SHIRT_COLORS,
  SHOES,
  SKIN_TONES,
  TOPS,
  type Appearance,
} from "../../../shared/appearance.ts";
import { TABS } from "./consts";

const rows = TABS.flatMap((tab) => tab.rows);

const COUNTS: Record<keyof Appearance, number> = {
  skin: SKIN_TONES.length,
  hairColor: HAIR_COLORS.length,
  hairStyle: HAIR_STYLES.length,
  shirt: SHIRT_COLORS.length,
  pants: PANTS_COLORS.length,
  facialHair: FACIAL_HAIR.length,
  glasses: GLASSES.length,
  headwear: HEADWEAR.length,
  top: TOPS.length,
  shoes: SHOES.length,
  accessory: ACCESSORIES.length,
};

describe("the picker's tabs", () => {
  it("are few enough to fit in the menu, each with its own name", () => {
    expect(TABS.length).toBeGreaterThanOrEqual(2);
    expect(TABS.length).toBeLessThanOrEqual(5);
    expect(new Set(TABS.map((tab) => tab.id)).size).toBe(TABS.length);
    expect(new Set(TABS.map((tab) => tab.label)).size).toBe(TABS.length);
  });

  it("offer every part of a look exactly once, so nothing can be chosen twice or not at all", () => {
    expect(rows.map((row) => row.field).sort()).toEqual(
      [...APPEARANCE_FIELDS].sort(),
    );
  });

  it("give every row a label of its own, as the accessible name of its choices", () => {
    const labels = rows.map((row) => row.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.trim()).not.toBe("");
  });

  it("show one choice for each option of each list, and no more", () => {
    for (const row of rows) {
      const shown =
        row.kind === "colors" ? row.colors.length : row.names.length;
      expect(shown, row.field).toBe(COUNTS[row.field]);
    }
  });

  it("name every choice, differently from the others in its row", () => {
    for (const row of rows) {
      if (row.kind !== "names") continue;
      expect(new Set(row.names).size, row.field).toBe(row.names.length);
      for (const name of row.names) expect(name.trim()).not.toBe("");
    }
  });

  it("name the plain choice of a part something a person understands", () => {
    for (const field of [
      "facialHair",
      "glasses",
      "headwear",
      "accessory",
    ] as const) {
      const row = rows.find((candidate) => candidate.field === field);
      expect(row?.kind === "names" && row.names[0]).toBe("None");
    }
  });
});
