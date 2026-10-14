import { ROOM_NAME } from "./constants.ts";
import type { Furniture } from "./furniture.ts";
import type { PropPlacement } from "./props.ts";

/**
 * The floor this server runs. For now there is one, and it is the game room's
 * name; a building will have one per area (see docs/BUILDING.md).
 */
export const FLOOR_ID = ROOM_NAME;

/** The code a player is disconnected with when their floor closes for editing. */
export const FLOOR_CLOSED_CODE = 4003;

export const FLOOR_CLOSED_MESSAGE =
  "This floor is closed while it is being edited. Try again in a moment.";

/**
 * The code a player is disconnected with when the floor's layout was published
 * while they were inside: the game joins again by itself, to a room made from it.
 */
export const FLOOR_UPDATED_CODE = 4004;

export const FLOOR_UPDATED_MESSAGE = "The floor was updated.";

/**
 * What stands in the floor, sent to each player who joins: the stored layout,
 * or (`version` null) the one every build carries by default.
 */
export interface LayoutMessage {
  version: number | null;
  furniture: Furniture[];
  models: PropPlacement[];
}

/** Sent to everybody on a floor that is about to close for editing. */
export interface ClosingMessage {
  seconds: number;
}
