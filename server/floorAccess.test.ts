import { describe, expect, it } from "vitest";
import { floorInfoFor, mayEnterFloor } from "./floorAccess.ts";
import type { Roles } from "./userStore.ts";

const member: Roles = { admin: false, headOf: [] };
const admin: Roles = { admin: true, headOf: [] };
const headOfHr: Roles = { admin: false, headOf: ["hr"] };
const hr = { id: "hr", common: false };
const lobby = { id: "office", common: true };
const lab = { id: "lab", common: false };

describe("mayEnterFloor", () => {
  it("lets everybody in everywhere when sign-in is off (nobody to identify)", () => {
    expect(mayEnterFloor(null, hr, false)).toBe(true);
    expect(mayEnterFloor(null, lobby, false)).toBe(true);
  });

  it("lets an admin enter any floor, with or without an entry", () => {
    for (const floor of [hr, lobby, lab])
      for (const granted of [true, false])
        expect(mayEnterFloor(admin, floor, granted)).toBe(true);
  });

  it("lets any member enter a common floor", () => {
    expect(mayEnterFloor(member, lobby, false)).toBe(true);
    expect(mayEnterFloor(headOfHr, lobby, false)).toBe(true);
  });

  it("lets the head of a floor enter it without an entry", () => {
    expect(mayEnterFloor(headOfHr, hr, false)).toBe(true);
  });

  it("does not let the head of one floor into another", () => {
    expect(mayEnterFloor(headOfHr, lab, false)).toBe(false);
  });

  it("lets in somebody with an explicit entry for that floor", () => {
    expect(mayEnterFloor(member, hr, true)).toBe(true);
  });

  it("keeps out an ordinary member of a floor that is not common and where they have no entry", () => {
    expect(mayEnterFloor(member, hr, false)).toBe(false);
  });

  it("does not take an entry for one floor as an entry for another (the caller asks per floor)", () => {
    expect(mayEnterFloor(member, lab, false)).toBe(false);
  });

  it("is a table: every combination of role, kind of floor and entry", () => {
    const people: Array<[string, Roles, string]> = [
      ["member", member, "hr"],
      ["admin", admin, "hr"],
      ["head of hr", headOfHr, "hr"],
      ["head of hr on lab", headOfHr, "lab"],
    ];
    for (const [, roles, floorId] of people)
      for (const common of [true, false])
        for (const granted of [true, false]) {
          const expected =
            roles.admin || common || roles.headOf.includes(floorId) || granted;
          expect(mayEnterFloor(roles, { id: floorId, common }, granted)).toBe(
            expected,
          );
        }
  });
});

describe("floorInfoFor", () => {
  const floors = [
    { id: "office", name: "Main office", common: true },
    { id: "hr", name: "Human Resources", common: false },
    { id: "lab", name: "Lab", common: false },
  ];

  it("says which floors this person may enter, in the order given, and nothing else", () => {
    const info = floorInfoFor(member, floors, ["lab"]);
    expect(info).toEqual([
      { id: "office", name: "Main office", common: true, canEnter: true },
      { id: "hr", name: "Human Resources", common: false, canEnter: false },
      { id: "lab", name: "Lab", common: false, canEnter: true },
    ]);
  });

  it("never carries who else has access", () => {
    for (const entry of floorInfoFor(member, floors, ["lab"]))
      expect(Object.keys(entry).sort()).toEqual([
        "canEnter",
        "common",
        "id",
        "name",
      ]);
  });

  it("lets an admin enter every floor and a head their own", () => {
    expect(floorInfoFor(admin, floors, []).every((f) => f.canEnter)).toBe(true);
    expect(
      floorInfoFor(headOfHr, floors, []).map((f) => [f.id, f.canEnter]),
    ).toEqual([
      ["office", true],
      ["hr", true],
      ["lab", false],
    ]);
  });

  it("lets everybody enter every floor when there is nobody to identify", () => {
    expect(floorInfoFor(null, floors, []).every((f) => f.canEnter)).toBe(true);
  });
});
