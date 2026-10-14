import { sanitizeFloorId } from "../../shared/floors.ts";

/** The floor a link asks for (`?floor=hr`), when it is one: the link of the lite screen and of the dev tools. */
export function floorFromSearch(search: string): string | null {
  return sanitizeFloorId(new URLSearchParams(search).get("floor"));
}
