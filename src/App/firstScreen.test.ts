import { describe, expect, it } from "vitest";
import { COMMON_FLOOR_ID, type FloorInfo } from "../../shared/floors.ts";
import {
  firstScreenReducer,
  floorToEnter,
  initialFirstScreen,
  type FirstScreenState,
} from "./firstScreen";

const office: FloorInfo = {
  id: COMMON_FLOOR_ID,
  name: "Main office",
  common: true,
  canEnter: true,
};
const hr: FloorInfo = { id: "hr", name: "HR", common: false, canEnter: true };
const lab: FloorInfo = {
  id: "lab",
  name: "Lab",
  common: false,
  canEnter: false,
};

const menu: FirstScreenState = { screen: "menu", phase: "lobby" };

describe("initialFirstScreen", () => {
  it("starts at the menu, or joining when a connection is already under way", () => {
    expect(initialFirstScreen("lobby")).toEqual(menu);
    expect(initialFirstScreen("offline")).toEqual({
      screen: "menu",
      phase: "offline",
    });
    expect(initialFirstScreen("connecting")).toEqual({
      screen: "joining",
      phase: "connecting",
    });
  });
});

describe("firstScreenReducer", () => {
  it("opens the character, the rooms and the farewell from the menu", () => {
    expect(firstScreenReducer(menu, { type: "customize" }).screen).toBe(
      "customize",
    );
    expect(
      firstScreenReducer(menu, { type: "rooms", floors: [office, hr] }).screen,
    ).toBe("rooms");
    expect(firstScreenReducer(menu, { type: "exit" }).screen).toBe("farewell");
  });

  it("does not open the rooms when there is only one, or none are known yet", () => {
    expect(firstScreenReducer(menu, { type: "rooms", floors: [office] })).toBe(
      menu,
    );
    expect(firstScreenReducer(menu, { type: "rooms", floors: [] })).toBe(menu);
    expect(firstScreenReducer(menu, { type: "rooms", floors: null })).toBe(
      menu,
    );
  });

  it("opens a screen only from the menu", () => {
    const customize = firstScreenReducer(menu, { type: "customize" });
    expect(firstScreenReducer(customize, { type: "exit" })).toBe(customize);
    expect(
      firstScreenReducer(customize, { type: "rooms", floors: [office, hr] }),
    ).toBe(customize);
    const joining: FirstScreenState = {
      screen: "joining",
      phase: "connecting",
    };
    expect(firstScreenReducer(joining, { type: "customize" })).toBe(joining);
  });

  it("goes back to the menu from every sub-screen, and stays at the menu", () => {
    for (const screen of ["customize", "rooms", "farewell"] as const)
      expect(
        firstScreenReducer({ screen, phase: "lobby" }, { type: "back" }),
      ).toEqual(menu);
    expect(firstScreenReducer(menu, { type: "back" })).toBe(menu);
  });

  it("ignores back while joining: Esc must not abandon a connection", () => {
    const joining: FirstScreenState = {
      screen: "joining",
      phase: "connecting",
    };
    expect(firstScreenReducer(joining, { type: "back" })).toBe(joining);
  });

  it("shows joining whenever the app is connecting, from any screen", () => {
    for (const screen of ["menu", "customize", "rooms"] as const)
      expect(
        firstScreenReducer(
          { screen, phase: "lobby" },
          { type: "phase", phase: "connecting" },
        ),
      ).toEqual({ screen: "joining", phase: "connecting" });
  });

  it("returns to the menu when joining fails or the player left", () => {
    const joining: FirstScreenState = {
      screen: "joining",
      phase: "connecting",
    };
    expect(
      firstScreenReducer(joining, { type: "phase", phase: "offline" }),
    ).toEqual({ screen: "menu", phase: "offline" });
    expect(
      firstScreenReducer(joining, { type: "phase", phase: "lobby" }),
    ).toEqual({ screen: "menu", phase: "lobby" });
  });

  it("keeps the screen when the phase changes without joining", () => {
    const customize: FirstScreenState = { screen: "customize", phase: "lobby" };
    expect(
      firstScreenReducer(customize, { type: "phase", phase: "offline" }),
    ).toEqual({ screen: "customize", phase: "offline" });
  });

  it("returns the same state for the phase it already has", () => {
    expect(firstScreenReducer(menu, { type: "phase", phase: "lobby" })).toBe(
      menu,
    );
  });
});

describe("floorToEnter", () => {
  it("enters the last room when it still exists and is allowed", () => {
    expect(floorToEnter("hr", [office, hr, lab])).toBe("hr");
  });

  it("falls back to the common room when the last one is forbidden or gone", () => {
    expect(floorToEnter("lab", [office, hr, lab])).toBe(COMMON_FLOOR_ID);
    expect(floorToEnter("gone", [office, hr])).toBe(COMMON_FLOOR_ID);
  });

  it("trusts the last room when the rooms are not known: the server decides at the door", () => {
    expect(floorToEnter("hr", null)).toBe("hr");
  });
});
