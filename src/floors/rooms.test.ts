import { describe, expect, it } from "vitest";
import type { FloorInfo } from "../../shared/floors.ts";
import { MAP_UNAVAILABLE_TEXT } from "./consts";
import { cardLabel, moveFocus, sortRooms } from "./rooms";

const room = (id: string, over: Partial<FloorInfo> = {}): FloorInfo => ({
  id,
  name: id.toUpperCase(),
  common: false,
  canEnter: true,
  ...over,
});

describe("sortRooms", () => {
  it("puts the common room first and keeps the order of the rest", () => {
    const sorted = sortRooms([
      room("b"),
      room("a"),
      room("office", { common: true }),
    ]);
    expect(sorted.map((floor) => floor.id)).toEqual(["office", "b", "a"]);
  });

  it("does not change what it was given", () => {
    const given = [room("b"), room("office", { common: true })];
    sortRooms(given);
    expect(given.map((floor) => floor.id)).toEqual(["b", "office"]);
  });
});

describe("cardLabel", () => {
  it("says where each card goes", () => {
    expect(cardLabel(room("lab", { name: "Lab" }), false)).toBe("Go to Lab");
  });

  it("says which room is the one you are in", () => {
    expect(cardLabel(room("lab", { name: "Lab" }), true)).toBe(
      "Lab, you are here",
    );
  });

  it("says a room is not available, and what to do", () => {
    const label = cardLabel(
      room("hr", { name: "People", canEnter: false }),
      false,
    );
    expect(label).toContain("People");
    expect(label).toContain("not available");
    expect(label).toContain(MAP_UNAVAILABLE_TEXT);
  });
});

describe("the message of a room that is not available", () => {
  it("is the one that was asked for", () => {
    expect(MAP_UNAVAILABLE_TEXT).toBe(
      "This room is not available. If you want to visit it, contact your administrator.",
    );
  });
});

describe("moveFocus", () => {
  it("moves along the row with left and right, and stops at the ends", () => {
    expect(moveFocus(0, "ArrowRight", 5, 3)).toBe(1);
    expect(moveFocus(1, "ArrowLeft", 5, 3)).toBe(0);
    expect(moveFocus(0, "ArrowLeft", 5, 3)).toBe(0);
    expect(moveFocus(4, "ArrowRight", 5, 3)).toBe(4);
  });

  it("moves between rows with up and down", () => {
    expect(moveFocus(1, "ArrowDown", 5, 3)).toBe(4);
    expect(moveFocus(4, "ArrowUp", 5, 3)).toBe(1);
    expect(moveFocus(0, "ArrowUp", 5, 3)).toBe(0);
  });

  it("stays on the last card when down would leave the grid", () => {
    expect(moveFocus(2, "ArrowDown", 5, 3)).toBe(4);
    expect(moveFocus(4, "ArrowDown", 5, 3)).toBe(4);
  });

  it("goes to the ends with Home and End, and ignores other keys", () => {
    expect(moveFocus(2, "Home", 5, 3)).toBe(0);
    expect(moveFocus(2, "End", 5, 3)).toBe(4);
    expect(moveFocus(2, "a", 5, 3)).toBeNull();
  });
});
