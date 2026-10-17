import type { FloorInfo } from "../../../shared/floors.ts";
import type { FloorPreview } from "../../../shared/floorPreview.ts";

export interface RoomCardProps {
  floor: FloorInfo;
  /** Whether this is the room the player is in. */
  here: boolean;
  /** Outside the game, the marked room is the one last visited, not the one the player is in. */
  lastVisit?: boolean;
  /** Its plan, or null while it has not come (or could not be had): the card is then a blank floor. */
  preview: FloorPreview | null;
  /** The card was pressed (click or Enter). */
  onSelect: () => void;
}
