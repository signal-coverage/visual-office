import {
  MODERATION_ACTIONS,
  REFUSAL_TEXT,
  type ModerationAction,
  type ModerationRefusal,
} from "../shared/moderation.ts";
import type { AuditRecorder } from "./audit.ts";
import type { BanStore } from "./banStore.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import {
  moderate,
  type ModerationActor,
  type ModerationRooms,
} from "./moderationService.ts";
import type { UserStore } from "./userStore.ts";

const MODERATION = "/admin/moderation";
const MAX_USER_ID_LENGTH = 128;

export interface ModerationAdminDeps {
  users: Pick<UserStore, "get" | "rolesOf">;
  bans: BanStore;
  rooms: ModerationRooms;
  audit: AuditRecorder;
  now: () => number;
  /** The floors that exist. */
  knownFloors: readonly string[];
  /** The floor moderated when the request does not say. */
  floor: string;
}

const STATUS: Record<ModerationRefusal, number> = {
  not_allowed: 403,
  self: 403,
  admin: 403,
  gone: 404,
  unknown_user: 404,
  not_here: 409,
  not_banned: 409,
  unavailable: 503,
};

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });

const isAction = (value: unknown): value is ModerationAction =>
  typeof value === "string" &&
  (MODERATION_ACTIONS as readonly string[]).includes(value);

async function route(
  request: AdminRequest,
  deps: ModerationAdminDeps,
): Promise<AdminReply | null> {
  if (request.path !== MODERATION) return null;
  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };

  const body =
    typeof request.body === "object" &&
    request.body !== null &&
    !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  const { action, userId, minutes } = body;
  if (
    !isAction(action) ||
    typeof userId !== "string" ||
    userId.length < 1 ||
    userId.length > MAX_USER_ID_LENGTH
  )
    return bad(
      "Say what to do (action: mute, unmute, kick, ban or unban) and to whom (userId).",
    );
  const floor = typeof body.floor === "string" ? body.floor : deps.floor;
  if (!deps.knownFloors.includes(floor))
    return { status: 404, body: { error: "No such floor." } };

  // Who is moderating is who the token says (or the server's own tools), never the request
  const moderator: ModerationActor =
    actor.kind === "user"
      ? { id: actor.user.id, name: actor.user.name, roles: actor.roles }
      : {
          id: null,
          name: "Server tools",
          roles: { admin: true, headOf: [] },
        };
  const reply = await moderate(
    moderator,
    { action, targetUserId: userId, minutes: minutes as number | undefined },
    floor,
    deps,
  );
  return reply.ok
    ? { status: 200, body: { ...reply } }
    : {
        status: STATUS[reply.reason],
        body: { error: REFUSAL_TEXT[reply.reason], reason: reply.reason },
      };
}

/**
 * The admin API for moderating people from outside the game: remove, ban or
 * mute somebody, whether they are in the office now or not (a ban applies when
 * they try to enter). Returns null for a path that is not its own. Who may is
 * decided by the same policy as inside the game: admins, and the head of the floor.
 */
export async function handleModerationAdmin(
  request: AdminRequest,
  deps: ModerationAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Moderation admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
