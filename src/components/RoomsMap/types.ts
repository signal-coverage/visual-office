import type { FloorInfo } from "../../../shared/floors.ts";

export interface RoomsMapProps {
  /** The rooms and which of them the player may enter. */
  floors: readonly FloorInfo[];
  /** The room the player is in. */
  current: string | null;
  /** Shown outside the game, before joining: `current` is then the room last visited, and choosing it enters it. */
  beforeJoining?: boolean;
  /** A fresh sign-in token, or null when there is none (or sign-in is off). */
  getToken: () => Promise<string | null>;
  /** Asks to travel to a room (its id): the server decides at the door. */
  onTravel: (floor: string) => void;
  /** Closes the map and goes back to where the player was. */
  onClose: () => void;
}
