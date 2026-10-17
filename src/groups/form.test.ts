import { describe, expect, it } from "vitest";
import {
  draftOf,
  filterPeople,
  planChanges,
  roomChoices,
  validateGroupForm,
  type GroupDraft,
} from "./form";

const hr = {
  id: "hr",
  name: "Human Resources",
  createdAt: 1,
  floors: ["lab", "payroll"],
  members: ["user_ana", "user_beto"],
};
const limits = { groups: 30, members: 200, floors: 40 };
const draft = (overrides: Partial<GroupDraft> = {}): GroupDraft => ({
  name: "Human Resources",
  floors: ["lab", "payroll"],
  members: ["user_ana", "user_beto"],
  ...overrides,
});

describe("draftOf", () => {
  it("starts from the group, or from nothing for a new one", () => {
    expect(draftOf(hr)).toEqual(draft());
    expect(draftOf(null)).toEqual({ name: "", floors: [], members: [] });
  });

  it("does not share its lists with the group", () => {
    const made = draftOf(hr);
    made.floors.push("x");
    expect(hr.floors).toEqual(["lab", "payroll"]);
  });
});

describe("validateGroupForm", () => {
  const others = [
    { id: "hr", name: "Human Resources" },
    { id: "ops", name: "Operations" },
  ];
  const check = (d: GroupDraft, current: string | null = "hr") =>
    validateGroupForm(d, { groups: others, limits, currentId: current });

  it("accepts a good form, with the name cleaned", () => {
    expect(check(draft({ name: "  Human   Resources " }))).toEqual({
      ok: true,
      name: "Human Resources",
    });
  });

  it("asks for a name", () => {
    for (const name of ["", "   ", "\u0000"]) {
      const result = check(draft({ name }));
      expect(result).toEqual({ ok: false, error: "Give the group a name." });
    }
  });

  it("refuses a name that is too long instead of cutting it silently", () => {
    const result = check(draft({ name: "x".repeat(41) }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/40/);
  });

  it("refuses the name of another group, in any case, but not its own", () => {
    expect(check(draft({ name: "operations" }))).toMatchObject({ ok: false });
    expect(check(draft({ name: "OPERATIONS" }), null)).toMatchObject({
      ok: false,
    });
    expect(check(draft({ name: "human resources" }))).toMatchObject({
      ok: true,
    });
  });

  it("refuses more people or rooms than a group may have", () => {
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    const people = check(draft({ members: many(201, "u") }));
    expect(people.ok === false && people.error).toMatch(/200/);
    const rooms = check(draft({ floors: many(41, "r") }));
    expect(rooms.ok === false && rooms.error).toMatch(/40/);
    expect(check(draft({ members: many(200, "u") })).ok).toBe(true);
    expect(check(draft({ floors: many(40, "r") })).ok).toBe(true);
  });

  it("refuses a new group when there are already as many as are allowed", () => {
    const full = Array.from({ length: 30 }, (_, i) => ({
      id: `g${i}`,
      name: `Group ${i}`,
    }));
    const result = validateGroupForm(draft({ name: "One more" }), {
      groups: full,
      limits,
      currentId: null,
    });
    expect(result.ok === false && result.error).toMatch(/30/);
    expect(
      validateGroupForm(draft({ name: "Group 3" }), {
        groups: full,
        limits,
        currentId: "g3",
      }).ok,
    ).toBe(true);
  });
});

describe("planChanges", () => {
  it("is nothing when nothing changed", () => {
    expect(planChanges(hr, draft())).toEqual([]);
  });

  it("renames, then gives and takes away rooms, then adds and removes people, each once", () => {
    expect(
      planChanges(
        hr,
        draft({
          name: "People",
          floors: ["payroll", "dev"],
          members: ["user_beto", "user_cris"],
        }),
      ),
    ).toEqual([
      { kind: "rename", name: "People" },
      { kind: "floor", floor: "dev", allowed: true },
      { kind: "floor", floor: "lab", allowed: false },
      { kind: "member", userId: "user_cris", member: true },
      { kind: "member", userId: "user_ana", member: false },
    ]);
  });

  it("does not rename for a name that is the same once cleaned", () => {
    expect(planChanges(hr, draft({ name: "  Human   Resources " }))).toEqual(
      [],
    );
  });

  it("gives everything of a new group, which has nothing", () => {
    expect(
      planChanges(
        null,
        draft({ name: "New", floors: ["lab"], members: ["user_ana"] }),
      ),
    ).toEqual([
      { kind: "floor", floor: "lab", allowed: true },
      { kind: "member", userId: "user_ana", member: true },
    ]);
  });

  it("does not repeat an entry the draft repeats", () => {
    expect(
      planChanges(
        null,
        draft({ floors: ["lab", "lab"], members: ["user_ana", "user_ana"] }),
      ),
    ).toHaveLength(2);
  });
});

describe("filterPeople", () => {
  const people = [
    { id: "user_ana", name: "Ana Pérez", email: "ana@acme.com" },
    { id: "user_beto", name: "Beto", email: null },
    { id: "user_cris", name: "Cristina", email: "cris@acme.com" },
  ];

  it("is everybody for an empty search", () => {
    expect(filterPeople(people, "")).toEqual(people);
    expect(filterPeople(people, "   ")).toEqual(people);
  });

  it("finds by name or email, ignoring case and accents", () => {
    expect(filterPeople(people, "perez").map((p) => p.id)).toEqual([
      "user_ana",
    ]);
    expect(filterPeople(people, "CRIS").map((p) => p.id)).toEqual([
      "user_cris",
    ]);
    expect(filterPeople(people, "acme").map((p) => p.id)).toEqual([
      "user_ana",
      "user_cris",
    ]);
  });

  it("is nobody when nobody matches", () => {
    expect(filterPeople(people, "zzz")).toEqual([]);
  });
});

describe("roomChoices", () => {
  const floors = [
    { id: "office", name: "Main office", common: true, createdAt: 0 },
    { id: "lab", name: "Lab", common: false, createdAt: 1 },
    { id: "dev", name: "Dev", common: false, createdAt: 2, archivedAt: 9 },
    { id: "hr", name: "People", common: false, createdAt: 3 },
  ];

  it("offers the rooms in use that are not common: everybody enters those anyway", () => {
    expect(roomChoices(floors, []).map((room) => room.id)).toEqual([
      "lab",
      "hr",
    ]);
  });

  it("keeps an archived room the group already has, marked, so it can be taken away", () => {
    expect(roomChoices(floors, ["dev"])).toEqual([
      { id: "lab", name: "Lab", archived: false },
      { id: "dev", name: "Dev", archived: true },
      { id: "hr", name: "People", archived: false },
    ]);
  });
});
