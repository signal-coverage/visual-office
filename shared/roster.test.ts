import { describe, expect, it } from "vitest";
import { buildRoster, type RosterEntry } from "./roster.ts";

const player = (
  id: string,
  name: string,
  zone: string | null = null,
  color = 0,
): RosterEntry => ({ id, name, zone, color });

describe("buildRoster, in the open office", () => {
  const players = [
    player("c", "Cami"),
    player("a", "Ana"),
    player("b", "Beto", "meeting"),
  ];

  it("lists everybody in the session", () => {
    const roster = buildRoster(players, "a");
    expect(roster.entries.map((e) => e.name)).toEqual(["Ana", "Beto", "Cami"]);
  });

  it("puts you first and marks you, whatever the alphabet says", () => {
    const roster = buildRoster(players, "c");
    expect(roster.entries.map((e) => e.name)).toEqual(["Cami", "Ana", "Beto"]);
    expect(roster.entries[0].you).toBe(true);
    expect(roster.entries.filter((e) => e.you)).toHaveLength(1);
  });

  it("says where the people who are in a private zone are", () => {
    const roster = buildRoster(players, "a");
    const beto = roster.entries.find((e) => e.id === "b");
    expect(beto?.place).toBe("Meeting room");
    expect(roster.entries.find((e) => e.id === "c")?.place).toBeNull();
  });

  it("keeps each person's chat colour, so the list matches the chat", () => {
    const roster = buildRoster(
      [player("a", "Ana", null, 4), player("b", "Beto", "meeting", 7)],
      "a",
    );
    expect(roster.entries.map((e) => [e.name, e.color])).toEqual([
      ["Ana", 4],
      ["Beto", 7],
    ]);
  });

  it("counts everybody", () => {
    expect(buildRoster(players, "a").count).toBe(3);
  });
});

describe("buildRoster, inside a private zone", () => {
  const players = [
    player("a", "Ana", "meeting"),
    player("b", "Beto", "meeting"),
    player("c", "Cami"),
  ];

  it("lists only the people in the same zone, and names it", () => {
    const roster = buildRoster(players, "a");
    expect(roster.title).toBe("Meeting room");
    expect(roster.entries.map((e) => e.name)).toEqual(["Ana", "Beto"]);
    expect(roster.count).toBe(2);
  });

  it("does not leak who else is online", () => {
    const roster = buildRoster(players, "a");
    expect(roster.entries.some((e) => e.name === "Cami")).toBe(false);
  });
});

describe("buildRoster, edge cases", () => {
  it("copes with not knowing who you are yet", () => {
    const roster = buildRoster([player("b", "Beto"), player("a", "Ana")], "me");
    expect(roster.entries.map((e) => e.name)).toEqual(["Ana", "Beto"]);
    expect(roster.entries.some((e) => e.you)).toBe(false);
  });

  it("copes with an empty session", () => {
    const roster = buildRoster([], "me");
    expect(roster.entries).toEqual([]);
    expect(roster.count).toBe(0);
  });

  it("sorts names without caring about case", () => {
    const roster = buildRoster(
      [player("1", "zoe"), player("2", "Adam"), player("3", "bob")],
      "x",
    );
    expect(roster.entries.map((e) => e.name)).toEqual(["Adam", "bob", "zoe"]);
  });
});
