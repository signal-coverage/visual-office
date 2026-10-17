import { COMMON_FLOOR_ID, type FloorInfo } from "../../shared/floors.ts";
import { canTravel } from "../floors/travel";

/** What the first screen is showing: the menu, one of its sub-screens, or the wait while joining. */
export type FirstScreenName =
  "menu" | "customize" | "rooms" | "farewell" | "joining";

/** The connection phases in which the first screen is on show. */
export type FirstScreenPhase = "lobby" | "connecting" | "offline";

export interface FirstScreenState {
  screen: FirstScreenName;
  /** The phase of the app last seen: a change of it is what moves into and out of joining. */
  phase: FirstScreenPhase;
}

export type FirstScreenAction =
  | { type: "customize" }
  | { type: "rooms"; floors: readonly FloorInfo[] | null }
  | { type: "exit" }
  | { type: "back" }
  | { type: "phase"; phase: FirstScreenPhase };

export function initialFirstScreen(phase: FirstScreenPhase): FirstScreenState {
  return { screen: phase === "connecting" ? "joining" : "menu", phase };
}

/**
 * Where the first screen goes. Sub-screens open only from the menu, back (Esc)
 * leads from each of them to the menu and does nothing while joining, and the
 * app's phase decides joining: connecting enters it, and a failed or ended
 * connection leaves it for the menu, where the message is shown.
 */
export function firstScreenReducer(
  state: FirstScreenState,
  action: FirstScreenAction,
): FirstScreenState {
  switch (action.type) {
    case "customize":
      return state.screen === "menu"
        ? { ...state, screen: "customize" }
        : state;
    case "rooms":
      return state.screen === "menu" && canTravel(action.floors)
        ? { ...state, screen: "rooms" }
        : state;
    case "exit":
      return state.screen === "menu" ? { ...state, screen: "farewell" } : state;
    case "back":
      return state.screen === "menu" || state.screen === "joining"
        ? state
        : { ...state, screen: "menu" };
    case "phase":
      if (action.phase === state.phase) return state;
      if (action.phase === "connecting")
        return { screen: "joining", phase: action.phase };
      return {
        screen: state.screen === "joining" ? "menu" : state.screen,
        phase: action.phase,
      };
  }
}

/**
 * The room "Enter the office" goes to: the one the player was last in when it
 * still exists and they may enter it, else the common one. While the rooms are
 * not known the last one is trusted: the server decides again at the door.
 */
export function floorToEnter(
  last: string,
  floors: readonly FloorInfo[] | null,
): string {
  if (floors === null) return last;
  const found = floors.find((floor) => floor.id === last);
  return found?.canEnter ? found.id : COMMON_FLOOR_ID;
}
