import type { FloorInfo } from "../shared/floors.ts";
import { isArchived } from "./floorArchive.ts";
import type { Roles } from "./userStore.ts";

/**
 * Whether somebody may enter a floor. The one place that decides it, from what
 * the server looked up: nothing here comes from the client.
 *
 * An archived floor is closed to everybody. Otherwise: `roles` is null when
 * sign-in is off, so there is nobody to identify and everybody may enter
 * everywhere, as before. `granted` is whether an admin gave this person an
 * entry for exactly this floor, and `viaGroup` whether they are in a group that
 * has it.
 */
export function mayEnterFloor(
  roles: Roles | null,
  floor: { id: string; common: boolean; archivedAt?: number | null },
  granted: boolean,
  viaGroup = false,
): boolean {
  if (isArchived(floor)) return false;
  if (roles === null) return true;
  return (
    roles.admin ||
    floor.common ||
    roles.headOf.includes(floor.id) ||
    granted ||
    viaGroup
  );
}

/** Whether one of these groups has the floor: what a member of a group enters through. */
export function groupsOpen(
  groups: ReadonlyArray<{ floors: readonly string[] }>,
  floorId: string,
): boolean {
  return groups.some((group) => group.floors.includes(floorId));
}

/**
 * The floors as one person is told about them: which they may enter, and nothing
 * about anybody else. Archived floors are not in the list at all.
 */
export function floorInfoFor(
  roles: Roles | null,
  floors: ReadonlyArray<{
    id: string;
    name: string;
    common: boolean;
    archivedAt?: number | null;
  }>,
  grantedFloors: readonly string[],
  groupFloors: readonly string[] = [],
): FloorInfo[] {
  return floors
    .filter((floor) => !isArchived(floor))
    .map(({ id, name, common }) => ({
      id,
      name,
      common,
      canEnter: mayEnterFloor(
        roles,
        { id, common },
        grantedFloors.includes(id),
        groupFloors.includes(id),
      ),
    }));
}
