import {
  COMMON_FLOOR_ID,
  FLOOR_ACCESS_LOST_CODE,
  FLOOR_ACCESS_LOST_MESSAGE,
  FLOOR_ARCHIVED_CODE,
  FLOOR_ARCHIVED_NOTICE,
  FLOOR_NOT_AVAILABLE_TEXT,
  FLOOR_UPDATED_CODE,
  type FloorInfo,
} from "../../shared/floors.ts";
import {
  restartRetryDelayMs,
  SERVER_RESTARTING_CODE,
  SERVER_RESTARTING_MESSAGE,
} from "../../shared/restart.ts";
import { messageForDisconnect } from "../App/helpers";

export type TravelDecision =
  | { kind: "travel"; floor: FloorInfo }
  | { kind: "here" }
  | { kind: "forbidden"; text: string }
  | { kind: "unknown" };

/**
 * What to do when the player asks for a room: go, stay (it is where they are),
 * say it is not for them, or say nothing (it is not in the list). The server
 * decides again at the door: this only keeps the game from asking for nothing.
 */
export function travelDecision(
  current: string | null,
  target: string,
  floors: readonly FloorInfo[] | null,
): TravelDecision {
  const floor = floors?.find((candidate) => candidate.id === target);
  if (!floor) return { kind: "unknown" };
  if (floor.id === current) return { kind: "here" };
  if (!floor.canEnter)
    return { kind: "forbidden", text: FLOOR_NOT_AVAILABLE_TEXT };
  return { kind: "travel", floor };
}

/** Whether there is anywhere to travel to: only when there is more than one room. */
export function canTravel(floors: readonly FloorInfo[] | null): boolean {
  return floors !== null && floors.length > 1;
}

/** The short notice shown while the game leaves one room and joins the next. */
export function travellingNotice(name: string): string {
  return `Travelling to ${name}…`;
}

export type AfterDisconnect =
  /** Leaving on purpose: back to the first screen, nothing to apologise for. */
  | { kind: "lobby" }
  /** The game joins `floor` by itself, with no first screen in between. */
  | { kind: "rejoin"; floor: string; notice?: string; delayMs?: number }
  /** Back to the first screen, with the reason. */
  | { kind: "offline"; message: string };

/**
 * What the game does when its connection to a room is over: the same ladder
 * for leaving, travelling, a layout that was published, access that was
 * taken away and a room that was archived.
 */
export function afterDisconnect(input: {
  code: number;
  leaving: boolean;
  /** The room the player asked to travel to, if they did. */
  travelTo: string | null;
  /** The room they were in. */
  floor: string;
  /** Spreads out the wait after a restart; the clock's own by default. */
  random?: () => number;
}): AfterDisconnect {
  if (input.leaving) return { kind: "lobby" };
  if (input.travelTo) return { kind: "rejoin", floor: input.travelTo };
  if (input.code === FLOOR_UPDATED_CODE)
    return { kind: "rejoin", floor: input.floor };
  if (input.code === SERVER_RESTARTING_CODE)
    return {
      kind: "rejoin",
      floor: input.floor,
      notice: SERVER_RESTARTING_MESSAGE,
      delayMs: restartRetryDelayMs(0, input.random) ?? 0,
    };
  if (input.code === FLOOR_ACCESS_LOST_CODE)
    return {
      kind: "rejoin",
      floor: COMMON_FLOOR_ID,
      notice: FLOOR_ACCESS_LOST_MESSAGE,
    };
  if (input.code === FLOOR_ARCHIVED_CODE)
    return {
      kind: "rejoin",
      floor: COMMON_FLOOR_ID,
      notice: FLOOR_ARCHIVED_NOTICE,
    };
  return { kind: "offline", message: messageForDisconnect(input.code) };
}
