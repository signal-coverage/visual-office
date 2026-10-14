import { describe, expect, it } from "vitest";
import {
  FLOOR_ACCESS_LOST_CODE,
  FLOOR_UPDATED_CODE,
  type FloorInfo,
} from "../../shared/floors.ts";
import {
  afterDisconnect,
  canTravel,
  travelDecision,
  travellingNotice,
} from "./travel";

const floors: FloorInfo[] = [
  { id: "office", name: "Main office", common: true, canEnter: true },
  { id: "hr", name: "People", common: false, canEnter: false },
  { id: "lab", name: "Lab", common: false, canEnter: true },
];

describe("travelDecision", () => {
  it("goes when the room exists and the person may enter it", () => {
    expect(travelDecision("office", "lab", floors)).toEqual({
      kind: "travel",
      floor: floors[2],
    });
  });

  it("stays when it is the room they are in", () => {
    expect(travelDecision("lab", "lab", floors)).toEqual({ kind: "here" });
  });

  it("says no, with the words of the menu, to a room they may not enter", () => {
    expect(travelDecision("office", "hr", floors)).toEqual({
      kind: "forbidden",
      text: "Not available. Ask your administrator to visit it.",
    });
  });

  it("does not know a room that is not in the list, nor a list that could not be loaded", () => {
    expect(travelDecision("office", "nope", floors)).toEqual({
      kind: "unknown",
    });
    expect(travelDecision("office", "lab", null)).toEqual({ kind: "unknown" });
  });

  it("can go from anywhere, including from no room at all", () => {
    expect(travelDecision(null, "office", floors).kind).toBe("travel");
  });
});

describe("canTravel", () => {
  it("is for when there is somewhere else to go: more than one room", () => {
    expect(canTravel(floors)).toBe(true);
    expect(canTravel([floors[0]])).toBe(false);
    expect(canTravel([])).toBe(false);
    expect(canTravel(null)).toBe(false);
  });
});

describe("travellingNotice", () => {
  it("names the room", () => {
    expect(travellingNotice("Lab")).toBe("Travelling to Lab…");
  });
});

describe("afterDisconnect", () => {
  const base = { code: 1000, leaving: false, travelTo: null, floor: "lab" };

  it("goes to the first screen when the player left on purpose", () => {
    expect(afterDisconnect({ ...base, leaving: true, travelTo: "hr" })).toEqual(
      { kind: "lobby" },
    );
  });

  it("joins the room they are travelling to, without a word about leaving", () => {
    expect(afterDisconnect({ ...base, travelTo: "hr" })).toEqual({
      kind: "rejoin",
      floor: "hr",
    });
  });

  it("joins the same room again when its layout was published", () => {
    expect(afterDisconnect({ ...base, code: FLOOR_UPDATED_CODE })).toEqual({
      kind: "rejoin",
      floor: "lab",
    });
  });

  it("takes somebody who lost their access to the common floor, and says why", () => {
    const next = afterDisconnect({ ...base, code: FLOOR_ACCESS_LOST_CODE });
    expect(next).toMatchObject({ kind: "rejoin", floor: "office" });
    expect(next.kind === "rejoin" && next.notice).toMatch(
      /no longer have access/i,
    );
  });

  it("goes back to the first screen with the reason for anything else", () => {
    const next = afterDisconnect({ ...base, code: 1006 });
    expect(next.kind).toBe("offline");
  });
});
