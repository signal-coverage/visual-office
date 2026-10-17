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

  it("lets in somebody who belongs to a group that has that floor", () => {
    expect(mayEnterFloor(member, hr, false, true)).toBe(true);
  });

  it("keeps out an ordinary member of a floor that is not common and where they have no entry", () => {
    expect(mayEnterFloor(member, hr, false)).toBe(false);
    expect(mayEnterFloor(member, hr, false, false)).toBe(false);
  });

  it("does not take an entry for one floor as an entry for another (the caller asks per floor)", () => {
    expect(mayEnterFloor(member, lab, false)).toBe(false);
  });

  it("keeps everybody out of an archived floor, whatever their roles, entries or groups", () => {
    const archived = { id: "hr", common: false, archivedAt: 10 };
    for (const roles of [null, member, admin, headOfHr])
      for (const granted of [true, false])
        for (const viaGroup of [true, false])
          expect(mayEnterFloor(roles, archived, granted, viaGroup)).toBe(false);
    expect(mayEnterFloor(member, { ...lobby, archivedAt: 10 }, false)).toBe(
      false,
    );
  });

  it("is a table: every combination of role, kind of floor, entry, group and archive", () => {
    const people: Array<[string, Roles | null, string]> = [
      ["nobody identified", null, "hr"],
      ["member", member, "hr"],
      ["admin", admin, "hr"],
      ["head of hr", headOfHr, "hr"],
      ["head of hr on lab", headOfHr, "lab"],
    ];
    for (const [, roles, floorId] of people)
      for (const common of [true, false])
        for (const granted of [true, false])
          for (const viaGroup of [true, false])
            for (const archived of [true, false]) {
              const expected =
                !archived &&
                (roles === null ||
                  roles.admin ||
                  common ||
                  roles.headOf.includes(floorId) ||
                  granted ||
                  viaGroup);
              const floor = {
                id: floorId,
                common,
                ...(archived ? { archivedAt: 1 } : {}),
              };
              expect(mayEnterFloor(roles, floor, granted, viaGroup)).toBe(
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

  it("counts the rooms of the person's groups", () => {
    const info = floorInfoFor(member, floors, [], ["hr"]);
    expect(info.map((f) => [f.id, f.canEnter])).toEqual([
      ["office", true],
      ["hr", true],
      ["lab", false],
    ]);
  });

  it("leaves out the archived rooms: they are not offered at all", () => {
    const info = floorInfoFor(
      admin,
      [...floors, { id: "old", name: "Old", common: false, archivedAt: 5 }],
      ["old"],
      ["old"],
    );
    expect(info.map((f) => f.id)).toEqual(["office", "hr", "lab"]);
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
