import { auditActor, type AuditRecorder } from "./audit.ts";
import type { BanStore } from "./banStore.ts";
import {
  floorIdsOf,
  type AdminReply,
  type AdminRequest,
  type KnownFloors,
} from "./floorAdmin.ts";
import { effectiveAccess } from "../shared/groups.ts";
import { mayEnterFloor } from "./floorAccess.ts";
import { isArchived } from "./floorArchive.ts";
import type { FloorStore } from "./floorStore.ts";
import type { GroupStore } from "./groupStore.ts";
import type { UserStore } from "./userStore.ts";

const MAX_USER_ID_LENGTH = 128;
const PEOPLE = "/admin/people";
const HEADS = /^\/admin\/floors\/([^/]+)\/heads$/;

export interface PeopleAdminDeps {
  users: UserStore;
  /** The floors that exist. */
  knownFloors: KnownFloors;
  /** Where naming and removing heads are noted: who did it. */
  audit?: AuditRecorder;
  /** The floors with their names and who was given an entry: without it the list says nothing of that. */
  floors?: Pick<FloorStore, "list" | "allGrants">;
  /** The role groups: without them the list says nothing of groups and counts none. */
  groups?: Pick<GroupStore, "list">;
  /** Somebody stopped being head of a floor: the people inside may have to leave. */
  onAccessChanged?: (floor: string, userId: string) => void;
  /** Who is banned now, to show next to each person. Without it the list says nothing of bans. */
  bans?: BanStore;
  now?: () => number;
}

const FORBIDDEN: AdminReply = {
  status: 403,
  body: { error: "Only admins may manage who is head of a floor." },
};

async function route(
  request: AdminRequest,
  deps: PeopleAdminDeps,
): Promise<AdminReply | null> {
  const isPeople = request.path === PEOPLE;
  const heads = HEADS.exec(request.path);
  if (!isPeople && !heads) return null;

  // Who is head of what is for admins (and the server's own tools): heads cannot name heads
  const actor = request.actor ?? { kind: "machine" as const };
  if (actor.kind === "user" && !actor.roles.admin) return FORBIDDEN;

  if (isPeople) {
    if (request.method !== "GET")
      return { status: 405, body: { error: "Use GET." } };
    const banned = deps.bans
      ? new Map(
          (await deps.bans.list((deps.now ?? Date.now)())).map((ban) => [
            ban.userId,
            ban.until,
          ]),
        )
      : null;
    // Archived rooms are not offered: nobody can enter them, whoever they are
    const floorInfo = deps.floors
      ? (await deps.floors.list())
          .filter((floor) => !isArchived(floor))
          .map(({ id, name, common }) => ({ id, name, common }))
      : null;
    const grants = deps.floors ? await deps.floors.allGrants() : [];
    const allGroups = deps.groups ? await deps.groups.list() : null;
    return {
      status: 200,
      body: {
        floors: [...(await floorIdsOf(deps.knownFloors))],
        ...(floorInfo ? { floorInfo } : {}),
        people: (await deps.users.list()).map((person) => {
          const access = grants
            .filter((grant) => grant.userId === person.id)
            .map((grant) => grant.floor);
          const groups = (allGroups ?? []).filter((group) =>
            group.members.includes(person.id),
          );
          const groupFloors = groups.flatMap((group) => group.floors);
          return {
            id: person.id,
            name: person.name,
            email: person.email,
            isAdmin: person.isAdmin,
            headOf: person.headOf,
            ...(floorInfo
              ? {
                  access,
                  canEnter: floorInfo
                    .filter((floor) =>
                      mayEnterFloor(
                        { admin: person.isAdmin, headOf: person.headOf },
                        floor,
                        access.includes(floor.id),
                        groupFloors.includes(floor.id),
                      ),
                    )
                    .map((floor) => floor.id),
                }
              : {}),
            ...(allGroups
              ? {
                  groups: groups.map(({ id, name }) => ({ id, name })),
                  ...(floorInfo
                    ? {
                        effectiveAccess: effectiveAccess(access, groups).filter(
                          (entry) =>
                            floorInfo.some((floor) => floor.id === entry.floor),
                        ),
                      }
                    : {}),
                }
              : {}),
            ...(banned ? { bannedUntil: banned.get(person.id) ?? null } : {}),
          };
        }),
      },
    };
  }

  const floor = heads![1];
  if (!(await floorIdsOf(deps.knownFloors)).includes(floor))
    return { status: 404, body: { error: "No such floor." } };
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };

  const body =
    typeof request.body === "object" &&
    request.body !== null &&
    !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  const { userId, head } = body;
  if (
    typeof userId !== "string" ||
    userId.length < 1 ||
    userId.length > MAX_USER_ID_LENGTH ||
    typeof head !== "boolean"
  )
    return {
      status: 400,
      body: {
        error: "Say who (userId) and whether they are head (true or false).",
      },
    };

  const wasHead = (await deps.users.headsOf(floor)).includes(userId);
  let changed: boolean;
  if (head) {
    if (!(await deps.users.addHead(floor, userId)))
      return {
        status: 404,
        body: { error: "Nobody with that id has signed in." },
      };
    changed = !wasHead;
  } else {
    // Whether they were head or not, afterwards they are not
    await deps.users.removeHead(floor, userId);
    changed = wasHead;
  }
  if (changed) {
    await deps.audit?.({
      ...auditActor(actor),
      action: head ? "head.assign" : "head.remove",
      targetUserId: userId,
      targetName: (await deps.users.get(userId))?.name ?? null,
      floor,
    });
    if (!head) {
      try {
        deps.onAccessChanged?.(floor, userId);
      } catch (error) {
        // The head is gone whatever the rooms make of the news
        console.error("Could not tell the rooms about the change:", error);
      }
    }
  }
  return { status: 200, body: { floor, userId, head } };
}

/**
 * The admin API for people: who has signed in, and who is head of which floor.
 * Returns null for a path that is not its own. Who may call it is decided
 * here too: admins and the server's own tools, nobody else.
 */
export async function handlePeopleAdmin(
  request: AdminRequest,
  deps: PeopleAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("People admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
