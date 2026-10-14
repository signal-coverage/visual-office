import type { FloorInfo } from "../shared/floors.ts";
import type { Roles } from "./userStore.ts";

/**
 * Whether somebody may enter a floor. The one place that decides it, from what
 * the server looked up: nothing here comes from the client.
 *
 * `roles` is null when sign-in is off, so there is nobody to identify and
 * everybody may enter everywhere, as before. `granted` is whether an admin gave
 * this person an entry for exactly this floor.
 */
export function mayEnterFloor(
  roles: Roles | null,
  floor: { id: string; common: boolean },
  granted: boolean,
): boolean {
  if (roles === null) return true;
  return (
    roles.admin || floor.common || roles.headOf.includes(floor.id) || granted
  );
}

/** The floors as one person is told about them: which they may enter, and nothing about anybody else. */
export function floorInfoFor(
  roles: Roles | null,
  floors: ReadonlyArray<{ id: string; name: string; common: boolean }>,
  grantedFloors: readonly string[],
): FloorInfo[] {
  return floors.map(({ id, name, common }) => ({
    id,
    name,
    common,
    canEnter: mayEnterFloor(roles, { id, common }, grantedFloors.includes(id)),
  }));
}
