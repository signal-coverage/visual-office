import { describe, expect, it } from "vitest";
import {
  effectiveAccess,
  groupSource,
  MAX_GROUP_FLOORS,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS,
  sanitizeGroupId,
  sanitizeGroupName,
  slugFromGroupName,
} from "./groups.ts";

describe("group limits", () => {
  it("are the ones the admin screens and the server promise", () => {
    expect(MAX_GROUPS).toBe(30);
    expect(MAX_GROUP_MEMBERS).toBe(200);
    expect(MAX_GROUP_FLOORS).toBe(40);
    expect(MAX_GROUP_NAME_LENGTH).toBe(40);
  });
});

describe("sanitizeGroupName", () => {
  it("cleans spaces and control characters and cuts at the limit", () => {
    expect(sanitizeGroupName("  Human \u0000  Resources ")).toBe(
      "Human Resources",
    );
    expect(sanitizeGroupName("a".repeat(100))).toBe(
      "a".repeat(MAX_GROUP_NAME_LENGTH),
    );
  });

  it("refuses an empty name or something that is not text", () => {
    for (const raw of ["", "   ", "\u0000", undefined, null, 4, {}])
      expect(sanitizeGroupName(raw)).toBeNull();
  });
});

describe("slugFromGroupName", () => {
  it("makes an id from a name, without accents", () => {
    expect(slugFromGroupName("Human Resources")).toBe("human-resources");
    expect(slugFromGroupName("Recursos Humanos Año")).toBe(
      "recursos-humanos-ano",
    );
  });

  it("is null when nothing usable is left", () => {
    expect(slugFromGroupName("¡¡¡")).toBeNull();
  });

  it("is short and never ends in a hyphen", () => {
    const slug = slugFromGroupName(`${"a".repeat(31)} bbbb`);
    expect(slug!.length).toBeLessThanOrEqual(32);
    expect(slug!.endsWith("-")).toBe(false);
  });
});

describe("sanitizeGroupId", () => {
  it("accepts a slug and nothing else", () => {
    expect(sanitizeGroupId("human-resources")).toBe("human-resources");
    for (const raw of ["HR", "a b", "../x", "", 3, "-a", "a".repeat(33)])
      expect(sanitizeGroupId(raw)).toBeNull();
  });
});

describe("effectiveAccess", () => {
  const hr = { name: "Human Resources", floors: ["lab", "payroll"] };
  const ops = { name: "Operations", floors: ["lab"] };

  it("is the union of the direct entries and the rooms of every group, with the source of each", () => {
    expect(effectiveAccess(["dev", "lab"], [hr, ops])).toEqual([
      { floor: "dev", sources: ["direct"] },
      {
        floor: "lab",
        sources: ["direct", "group:Human Resources", "group:Operations"],
      },
      { floor: "payroll", sources: ["group:Human Resources"] },
    ]);
  });

  it("is empty when there is nothing", () => {
    expect(effectiveAccess([], [])).toEqual([]);
    expect(effectiveAccess([], [{ name: "Empty", floors: [] }])).toEqual([]);
  });

  it("names the source of a group with its name", () => {
    expect(groupSource("Human Resources")).toBe("group:Human Resources");
  });
});
