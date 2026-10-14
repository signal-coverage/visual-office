import { segmentBlocked, type Box } from "../shared/collision.ts";
import { PLAYER_RADIUS } from "../shared/constants.ts";
import type { Anchor, Interactable } from "../shared/interactions.ts";
import type { SeatRefusal } from "../shared/seats.ts";
import type { UserRecord } from "./userStore.ts";

/** The least time between two requests to sit or stand of the same person. */
export const SEAT_COOLDOWN_MS = 300;
/**
 * How far from a seat somebody may be and still sit in it. A little more than
 * the 2.5 m the eyes reach, since the client's position is a moment ahead of the server's.
 */
export const SEAT_REACH = 3;

export type SitVerdict = { ok: true } | { ok: false; reason: SeatRefusal };

export interface SitContext {
  /** The seat asked for, as the layout of this room has it (undefined when there is none by that id). */
  seat: Interactable | undefined;
  /** Where the server has the player, not where they say they are. */
  player: { x: number; z: number };
  /** Who sits there now, if anybody. */
  occupiedBy: string | undefined;
  sessionId: string;
  alreadySeated: boolean;
  colliders: Box[];
  user: UserRecord | null;
}

/**
 * Whether somebody may sit where they asked to. The server is the authority:
 * the seat must exist in the layout of this room, be free, and be within reach
 * with nothing solid in between (no sitting through a wall into a private room).
 * Everybody may, for now; this is the one place to decide otherwise later.
 */
export function maySit(context: SitContext): SitVerdict {
  void context.user; // who it is does not matter yet
  const { seat } = context;
  if (!seat?.seat) return { ok: false, reason: "unknown" };
  if (context.alreadySeated || context.occupiedBy === context.sessionId)
    return { ok: false, reason: "seated" };
  if (context.occupiedBy !== undefined) return { ok: false, reason: "taken" };
  const { x, z } = seat.seat;
  if (Math.hypot(context.player.x - x, context.player.z - z) > SEAT_REACH)
    return { ok: false, reason: "far" };
  if (segmentBlocked(context.player, { x, z }, context.colliders))
    return { ok: false, reason: "blocked" };
  return { ok: true };
}

/** Who sits in which seat of a room: one person to a seat and one seat to a person. */
export class SeatBook {
  private readonly bySeat = new Map<string, string>();
  private readonly bySession = new Map<string, string>();

  occupant(seatId: string): string | undefined {
    return this.bySeat.get(seatId);
  }

  seatOf(sessionId: string): string | undefined {
    return this.bySession.get(sessionId);
  }

  /** Gives the seat to the person. False, and nothing changes, when either already has one. */
  take(seatId: string, sessionId: string): boolean {
    if (this.bySeat.has(seatId) || this.bySession.has(sessionId)) return false;
    this.bySeat.set(seatId, sessionId);
    this.bySession.set(sessionId, seatId);
    return true;
  }

  /** Frees whatever seat the person holds and says which it was. */
  release(sessionId: string): string | undefined {
    const seatId = this.bySession.get(sessionId);
    if (seatId === undefined) return undefined;
    this.bySession.delete(sessionId);
    this.bySeat.delete(seatId);
    return seatId;
  }

  sitters(): string[] {
    return [...this.bySession.keys()];
  }
}

/** Where to look for room to stand, as (sideways, behind) from the seat, nearest first. */
const STAND_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0.9],
  [-0.9, 0],
  [0.9, 0],
  [-0.9, 0.9],
  [0.9, 0.9],
  [0, -0.9],
  [0, 1.4],
  [-1.4, 0],
  [1.4, 0],
  [0, -1.4],
];

const overlaps = (x: number, z: number, b: Box) =>
  x + PLAYER_RADIUS > b.minX &&
  x - PLAYER_RADIUS < b.maxX &&
  z + PLAYER_RADIUS > b.minZ &&
  z - PLAYER_RADIUS < b.maxZ;

/**
 * Where somebody ends up when they get up: the nearest place around the seat,
 * behind the chair first, that nothing occupies, is inside the floor, and can be
 * reached without crossing a wall. When there is none, the first one: the
 * movement referee lets somebody walk out of a tight spot.
 */
export function standSpot(
  seat: Anchor,
  colliders: Box[],
  bounds: Box,
): { x: number; z: number } {
  const cos = Math.cos(seat.yaw);
  const sin = Math.sin(seat.yaw);
  const around = STAND_OFFSETS.map(([side, back]) => ({
    x: seat.x + side * cos + back * sin,
    z: seat.z - side * sin + back * cos,
  }));
  const fits = ({ x, z }: { x: number; z: number }) =>
    x - PLAYER_RADIUS >= bounds.minX &&
    x + PLAYER_RADIUS <= bounds.maxX &&
    z - PLAYER_RADIUS >= bounds.minZ &&
    z + PLAYER_RADIUS <= bounds.maxZ &&
    !colliders.some((box) => overlaps(x, z, box)) &&
    !segmentBlocked(seat, { x, z }, colliders);
  return around.find(fits) ?? around[0];
}
