import { describe, expect, it } from "vitest";
import {
  COMMON_FLOOR_ID,
  MAX_FLOOR_ID_LENGTH,
  MAX_FLOOR_NAME_LENGTH,
  RESERVED_FLOOR_IDS,
  sanitizeFloorId,
  sanitizeFloorName,
  slugFromName,
} from "./floors.ts";

describe("sanitizeFloorId", () => {
  it("accepts lowercase letters, digits and single hyphens", () => {
    for (const id of ["office", "hr", "floor-2", "a1-b2-c3", "7"])
      expect(sanitizeFloorId(id)).toBe(id);
  });

  it("is the id of the main office for the common floor", () => {
    expect(sanitizeFloorId(COMMON_FLOOR_ID)).toBe("office");
  });

  it("refuses anything else, without fixing it up", () => {
    for (const id of [
      "",
      "HR",
      " hr",
      "hr ",
      "-hr",
      "hr-",
      "h--r",
      "h_r",
      "h.r",
      "h/r",
      "../x",
      "añadido",
      "a b",
    ])
      expect(sanitizeFloorId(id), JSON.stringify(id)).toBeNull();
  });

  it("refuses what is not text", () => {
    for (const id of [undefined, null, 4, {}, [], ["hr"], true])
      expect(sanitizeFloorId(id)).toBeNull();
  });

  it("refuses ids that are too long, and takes the longest allowed", () => {
    expect(sanitizeFloorId("a".repeat(MAX_FLOOR_ID_LENGTH))).not.toBeNull();
    expect(sanitizeFloorId("a".repeat(MAX_FLOOR_ID_LENGTH + 1))).toBeNull();
  });

  it("refuses reserved names", () => {
    expect(RESERVED_FLOOR_IDS.length).toBeGreaterThan(5);
    for (const id of RESERVED_FLOOR_IDS)
      expect(sanitizeFloorId(id), id).toBeNull();
  });
});

describe("sanitizeFloorName", () => {
  it("keeps a plain name", () => {
    expect(sanitizeFloorName("Human Resources")).toBe("Human Resources");
  });

  it("trims, collapses spaces and drops control characters", () => {
    expect(sanitizeFloorName("  Human \n\t Resources\u0000 ")).toBe(
      "Human Resources",
    );
  });

  it("cuts a name that is too long", () => {
    const name = sanitizeFloorName("x".repeat(MAX_FLOOR_NAME_LENGTH + 20));
    expect(name).toHaveLength(MAX_FLOOR_NAME_LENGTH);
  });

  it("refuses an empty name or something that is not text", () => {
    for (const raw of ["", "   ", "\u0000\u0001", undefined, null, 3, {}])
      expect(sanitizeFloorName(raw)).toBeNull();
  });
});

describe("slugFromName", () => {
  it("makes an id from a name", () => {
    expect(slugFromName("Human Resources")).toBe("human-resources");
    expect(slugFromName("  R&D — Lab 2 ")).toBe("r-d-lab-2");
  });

  it("drops accents", () => {
    expect(slugFromName("Contabilidad Año")).toBe("contabilidad-ano");
  });

  it("is null when nothing usable is left, or the result is reserved", () => {
    expect(slugFromName("¡¡¡")).toBeNull();
    expect(slugFromName("Admin")).toBeNull();
  });

  it("cuts to the longest id allowed without ending in a hyphen", () => {
    const slug = slugFromName(`${"a".repeat(MAX_FLOOR_ID_LENGTH - 1)} bbbb`);
    expect(slug).not.toBeNull();
    expect(slug!.length).toBeLessThanOrEqual(MAX_FLOOR_ID_LENGTH);
    expect(slug!.endsWith("-")).toBe(false);
  });
});
