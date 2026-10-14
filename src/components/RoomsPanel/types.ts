import type { FloorInfo } from "../../../shared/floors.ts";

export interface RoomsPanelProps {
  /** The rooms and which of them the player may enter; null while they are being asked for. */
  floors: FloorInfo[] | null;
  /** The room the player is in. */
  current: string | null;
  /** Asks to travel to a room (its id): the server decides at the door. */
  onTravel: (floor: string) => void;
  /** Goes back to the menu. */
  onBack: () => void;
}
