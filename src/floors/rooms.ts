import type { FloorInfo } from "../../shared/floors.ts";
import { MAP_UNAVAILABLE_TEXT } from "./consts";

/** The rooms for the map: the common room first, the rest in the order they came. */
export function sortRooms(floors: readonly FloorInfo[]): FloorInfo[] {
  return [
    ...floors.filter((f) => f.common),
    ...floors.filter((f) => !f.common),
  ];
}

/** What a card is called for somebody who cannot see it. */
export function cardLabel(floor: FloorInfo, here: boolean): string {
  if (here) return `${floor.name}, you are here`;
  if (!floor.canEnter)
    return `${floor.name}, not available. ${MAP_UNAVAILABLE_TEXT}`;
  return `Go to ${floor.name}`;
}

/** Where the focus goes from card `index` with `key`, or null for a key that does not move it. */
export function moveFocus(
  index: number,
  key: string,
  count: number,
  columns: number,
): number | null {
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
      return Math.min(last, index + 1);
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowDown":
      return index + columns <= last ? index + columns : last;
    case "ArrowUp":
      return index - columns >= 0 ? index - columns : index;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
