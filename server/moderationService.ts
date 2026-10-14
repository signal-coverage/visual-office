import {
  BANNED_CODE,
  BANNED_MESSAGE,
  banMinutes,
  KICKED_CODE,
  KICKED_MESSAGE,
  type ModerationAction,
  type ModerationReply,
} from "../shared/moderation.ts";
import type { AuditRecorder } from "./audit.ts";
import type { BanStore } from "./banStore.ts";
import { canModerate, mayModerate } from "./moderation.ts";
import type { Roles, UserStore } from "./userStore.ts";

/** What moderating needs from the game rooms that are running. */
export interface ModerationRooms {
  /** Disconnects every session of the person on that floor. Returns how many there were. */
  removeUser: (
    floor: string,
    userId: string,
    code: number,
    message: string,
  ) => number;
  /** Takes the person's microphone away (or gives it back) on that floor. Returns how many sessions of theirs there were. */
  setVoiceMuted: (
    floor: string,
    userId: string,
    muted: boolean,
  ) => Promise<number>;
}

export interface ModerationDeps {
  users: Pick<UserStore, "get" | "rolesOf">;
  bans: BanStore;
  rooms: ModerationRooms;
  audit: AuditRecorder;
  now: () => number;
}

/** Who is moderating, with the roles the server looked up for them. No id for the server's own tools. */
export interface ModerationActor {
  id: string | null;
  name: string;
  roles: Roles;
}

export interface ModerationCommand {
  action: ModerationAction;
  targetUserId: string;
  /** For a ban; the default and the bounds apply. */
  minutes?: number;
}

const refused = (reason: Extract<ModerationReply, { ok: false }>["reason"]) =>
  ({ ok: false, reason }) as const;

/**
 * Does what a moderator asked, once the server has checked they may: who they
 * are and what they may do come from the server (never from the request), and
 * so do the target's roles. Whatever was done is noted in the audit log.
 */
export async function moderate(
  actor: ModerationActor,
  command: ModerationCommand,
  floor: string,
  deps: ModerationDeps,
): Promise<ModerationReply> {
  // Before anything about the target, so a member learns nothing about who exists
  if (!canModerate(actor.roles, floor)) return refused("not_allowed");

  const target = await deps.users.get(command.targetUserId);
  if (!target) return refused("unknown_user");
  const verdict = mayModerate(
    actor,
    { id: target.id, roles: await deps.users.rolesOf(target.id) },
    floor,
  );
  if (!verdict.ok) return refused(verdict.reason);

  const { action } = command;
  let minutes: number | undefined;
  try {
    if (action === "kick") {
      if (
        deps.rooms.removeUser(floor, target.id, KICKED_CODE, KICKED_MESSAGE) ===
        0
      )
        return refused("not_here");
    } else if (action === "ban") {
      minutes = banMinutes(command.minutes);
      await deps.bans.ban(target.id, minutes, deps.now());
      // Whether they are here or not, they cannot come back until it ends
      deps.rooms.removeUser(floor, target.id, BANNED_CODE, BANNED_MESSAGE);
    } else if (action === "unban") {
      if (!(await deps.bans.lift(target.id, deps.now())))
        return refused("not_banned");
    } else if (
      (await deps.rooms.setVoiceMuted(floor, target.id, action === "mute")) ===
      0
    ) {
      return refused("not_here");
    }
  } catch (error) {
    console.error(`Could not ${action} somebody:`, error);
    return refused("unavailable");
  }

  await deps.audit({
    actorUserId: actor.id,
    actorName: actor.name,
    action: `moderation.${action}`,
    targetUserId: target.id,
    targetName: target.name,
    floor,
    ...(minutes === undefined ? {} : { detail: { minutes } }),
  });
  return minutes === undefined
    ? { ok: true, action, name: target.name }
    : { ok: true, action, name: target.name, minutes };
}

/** Why somebody may not enter now: they are banned, until it ends. Null when they may. */
export async function joinBan(
  bans: BanStore,
  userId: string,
  now: number,
): Promise<{ code: number; message: string } | null> {
  return (await bans.activeUntil(userId, now)) === null
    ? null
    : { code: BANNED_CODE, message: BANNED_MESSAGE };
}
