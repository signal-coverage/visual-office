import {
  MAX_GROUP_FLOORS,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS,
  sanitizeGroupName,
  slugFromGroupName,
} from "../shared/groups.ts";
import type { Actor } from "./actor.ts";
import { auditActor, type AuditRecorder } from "./audit.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import type { FloorStore } from "./floorStore.ts";
import type { GroupRecord, GroupStore } from "./groupStore.ts";
import type { UserStore } from "./userStore.ts";

const MAX_USER_ID_LENGTH = 128;
const MAX_FLOOR_ID_LENGTH = 32;
const GROUPS = "/admin/groups";
const ONE_GROUP = /^\/admin\/groups\/([^/]+)$/;
const SUB = /^\/admin\/groups\/([^/]+)\/(delete|members|floors)$/;

export interface GroupsAdminDeps {
  groups: GroupStore;
  floors: Pick<FloorStore, "get">;
  users: Pick<UserStore, "get">;
  /** Where making, changing and deleting groups are noted: who did it. */
  audit?: AuditRecorder;
  /** Somebody may have lost a way into a room: the people inside may have to leave. */
  onAccessChanged?: (floor: string, userId: string) => void;
}

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });
const conflict = (error: string): AdminReply => ({
  status: 409,
  body: { error },
});
const NO_GROUP: AdminReply = {
  status: 404,
  body: { error: "No such group." },
};
const FORBIDDEN: AdminReply = {
  status: 403,
  body: { error: "Only admins may manage groups." },
};

/** The body as an object with exactly these fields, or null. */
function fieldsOf(
  body: unknown,
  allowed: readonly string[],
): Record<string, unknown> | null {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return null;
  const record = body as Record<string, unknown>;
  return Object.keys(record).every((key) => allowed.includes(key))
    ? record
    : null;
}

/** Tells the rooms that these people may no longer have a way into these floors. A room that fails must not undo the change. */
function lost(
  deps: GroupsAdminDeps,
  floors: readonly string[],
  userIds: readonly string[],
): void {
  for (const floor of floors)
    for (const userId of userIds) {
      try {
        deps.onAccessChanged?.(floor, userId);
      } catch (error) {
        console.error("Could not tell the rooms about the change:", error);
      }
    }
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function create(
  body: unknown,
  actor: Actor,
  deps: GroupsAdminDeps,
): Promise<AdminReply> {
  const fields = fieldsOf(body, ["name"]);
  const name = fields && sanitizeGroupName(fields.name);
  if (!name) return bad("Say the group's name (1 to 40 characters).");
  const id = slugFromGroupName(name);
  if (!id)
    return bad(
      "Could not make an id from that name: use letters or digits in it.",
    );
  const existing = await deps.groups.list();
  if (existing.length >= MAX_GROUPS)
    return conflict(
      `There are already ${MAX_GROUPS} groups: delete one first.`,
    );
  if (existing.some((group) => sameName(group.name, name)))
    return conflict("There is a group with that name.");
  const group = await deps.groups.create({ id, name });
  if (!group) return conflict("There is a group with that name.");
  await deps.audit?.({
    ...auditActor(actor),
    action: "group.create",
    detail: { group: group.id, name: group.name },
  });
  return { status: 201, body: { group } };
}

async function rename(
  id: string,
  body: unknown,
  actor: Actor,
  deps: GroupsAdminDeps,
): Promise<AdminReply> {
  const before = await deps.groups.get(id);
  if (!before) return NO_GROUP;
  const fields = fieldsOf(body, ["name"]);
  const name = fields && sanitizeGroupName(fields.name);
  if (!name) return bad("Say the group's new name (1 to 40 characters).");
  const others = await deps.groups.list();
  if (others.some((other) => other.id !== id && sameName(other.name, name)))
    return conflict("There is a group with that name.");
  const group = await deps.groups.rename(id, name);
  if (!group) return NO_GROUP;
  if (before.name !== group.name)
    await deps.audit?.({
      ...auditActor(actor),
      action: "group.rename",
      detail: { group: id, from: before.name, to: group.name },
    });
  return { status: 200, body: { group } };
}

async function remove(
  group: GroupRecord,
  actor: Actor,
  deps: GroupsAdminDeps,
): Promise<AdminReply> {
  if (!(await deps.groups.remove(group.id))) return NO_GROUP;
  await deps.audit?.({
    ...auditActor(actor),
    action: "group.delete",
    detail: { group: group.id, name: group.name },
  });
  lost(deps, group.floors, group.members);
  return { status: 200, body: { group: group.id, deleted: true } };
}

async function setMember(
  group: GroupRecord,
  body: unknown,
  actor: Actor,
  deps: GroupsAdminDeps,
): Promise<AdminReply> {
  const fields = fieldsOf(body, ["userId", "member"]);
  const userId = fields?.userId;
  const member = fields?.member;
  if (
    typeof userId !== "string" ||
    userId.length < 1 ||
    userId.length > MAX_USER_ID_LENGTH ||
    typeof member !== "boolean"
  )
    return bad(
      "Say who (userId) and whether they are in the group (member: true or false).",
    );
  const person = await deps.users.get(userId);
  if (member && !person)
    return {
      status: 404,
      body: { error: "Nobody with that id has signed in." },
    };

  const had = group.members.includes(userId);
  if (member && !had && group.members.length >= MAX_GROUP_MEMBERS)
    return conflict(
      `A group has at most ${MAX_GROUP_MEMBERS} people: take somebody out first.`,
    );
  if (!(await deps.groups.setMember(group.id, userId, member))) return NO_GROUP;
  if (had !== member) {
    await deps.audit?.({
      ...auditActor(actor),
      action: "group.member",
      targetUserId: userId,
      targetName: person?.name ?? null,
      detail: { group: group.id, name: group.name, member },
    });
    if (!member) lost(deps, group.floors, [userId]);
  }
  return { status: 200, body: { group: group.id, userId, member } };
}

async function setFloor(
  group: GroupRecord,
  body: unknown,
  actor: Actor,
  deps: GroupsAdminDeps,
): Promise<AdminReply> {
  const fields = fieldsOf(body, ["floor", "allowed"]);
  const floorId = fields?.floor;
  const allowed = fields?.allowed;
  if (
    typeof floorId !== "string" ||
    floorId.length < 1 ||
    floorId.length > MAX_FLOOR_ID_LENGTH ||
    typeof allowed !== "boolean"
  )
    return bad(
      "Say which room (floor) and whether the group may enter it (allowed: true or false).",
    );
  const floor = await deps.floors.get(floorId);
  if (!floor) return { status: 404, body: { error: "No such floor." } };
  if (allowed && floor.common)
    return bad("Everybody may enter a common room: there is nothing to give.");

  const had = group.floors.includes(floorId);
  if (allowed && !had && group.floors.length >= MAX_GROUP_FLOORS)
    return conflict(
      `A group has at most ${MAX_GROUP_FLOORS} rooms: take one away first.`,
    );
  if (!(await deps.groups.setFloor(group.id, floorId, allowed)))
    return NO_GROUP;
  if (had !== allowed) {
    await deps.audit?.({
      ...auditActor(actor),
      action: "group.floor",
      floor: floorId,
      detail: { group: group.id, name: group.name, allowed },
    });
    if (!allowed) lost(deps, [floorId], group.members);
  }
  return { status: 200, body: { group: group.id, floor: floorId, allowed } };
}

async function route(
  request: AdminRequest,
  deps: GroupsAdminDeps,
): Promise<AdminReply | null> {
  const list = request.path === GROUPS;
  const one = ONE_GROUP.exec(request.path);
  const sub = SUB.exec(request.path);
  if (!list && !one && !sub) return null;

  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  // Groups give rooms to people: for admins (and the server's own tools), not for heads
  if (actor.kind === "user" && !actor.roles.admin) return FORBIDDEN;

  if (list) {
    if (request.method === "GET")
      return {
        status: 200,
        body: {
          groups: await deps.groups.list(),
          limits: {
            groups: MAX_GROUPS,
            members: MAX_GROUP_MEMBERS,
            floors: MAX_GROUP_FLOORS,
          },
        },
      };
    if (request.method !== "POST")
      return { status: 405, body: { error: "Use GET or POST." } };
    return create(request.body, actor, deps);
  }

  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };
  if (one) return rename(one[1], request.body, actor, deps);

  const group = await deps.groups.get(sub![1]);
  if (!group) return NO_GROUP;
  switch (sub![2]) {
    case "delete":
      return remove(group, actor, deps);
    case "members":
      return setMember(group, request.body, actor, deps);
    default:
      return setFloor(group, request.body, actor, deps);
  }
}

/**
 * The admin API for role groups: the list, making, renaming and deleting a
 * group, who is in it and which rooms it opens. Returns null for a path that is
 * not its own. Who may call it is decided here too: admins and the server's own
 * tools, nobody else (a head of a floor cannot give rooms to people).
 */
export async function handleGroupsAdmin(
  request: AdminRequest,
  deps: GroupsAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Groups admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
