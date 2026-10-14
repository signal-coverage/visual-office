import type { Box } from "./collision.ts";
import { MAX_SPEED, PLAYER_RADIUS } from "./constants.ts";

export type MoveVerdict =
  { ok: true } | { ok: false; reason: "too-fast" | "blocked" };

/** Real clients are a bit faster than MAX_SPEED on paper (frame timing, bursts). */
const SPEED_TOLERANCE = 1.5;
/** Longest stretch of "saved up" travel: covers lag spikes, not teleports. */
const BUDGET_CAP_SECONDS = 1;
const INITIAL_BUDGET_SECONDS = 0.1;
/** Float noise and float32 sync mean a legit player can sit a hair inside a wall. */
const COLLISION_TOLERANCE = 0.02;
/** Distance between checks along a move, so thin walls cannot be skipped. */
const PATH_STEP = 0.1;

const BUDGET_PER_SECOND = MAX_SPEED * SPEED_TOLERANCE;

function isInside(x: number, z: number, boxes: Box[]): boolean {
  const reach = PLAYER_RADIUS - COLLISION_TOLERANCE;
  return boxes.some(
    (b) =>
      x + reach > b.minX &&
      x - reach < b.maxX &&
      z + reach > b.minZ &&
      z - reach < b.maxZ,
  );
}

/**
 * Server-side referee for one player's movement. The client moves itself (so
 * the game feels instant); this checks each reported position against what is
 * physically possible: not faster than a player can run, and never through or
 * into furniture and walls.
 *
 * Speed is a budget, not a per-message limit, so a burst of delayed messages
 * after a lag spike is fine as long as the total distance is plausible.
 */
export class MovementValidator {
  private x: number;
  private z: number;
  private budget: number;
  private lastAt: number;
  private readonly colliders: Box[];

  constructor(start: { x: number; z: number }, now: number, colliders: Box[]) {
    this.x = start.x;
    this.z = start.z;
    this.lastAt = now;
    this.budget = BUDGET_PER_SECOND * INITIAL_BUDGET_SECONDS;
    this.colliders = colliders;
  }

  /** The last accepted position. */
  get position() {
    return { x: this.x, z: this.z };
  }

  /**
   * Puts the player somewhere without judging how they got there: the server
   * itself moved them (onto a chair, off it). The budget starts again, as when they joined.
   */
  teleport(to: { x: number; z: number }, now: number): void {
    this.x = to.x;
    this.z = to.z;
    this.lastAt = now;
    this.budget = BUDGET_PER_SECOND * INITIAL_BUDGET_SECONDS;
  }

  validate(next: { x: number; z: number }, now: number): MoveVerdict {
    const elapsed = Math.max(0, now - this.lastAt) / 1000;
    this.lastAt = now;
    this.budget = Math.min(
      BUDGET_PER_SECOND * BUDGET_CAP_SECONDS,
      this.budget + elapsed * BUDGET_PER_SECOND,
    );

    const distance = Math.hypot(next.x - this.x, next.z - this.z);
    if (distance > this.budget + 1e-6) return { ok: false, reason: "too-fast" };

    if (!this.canWalk({ x: this.x, z: this.z }, next))
      return { ok: false, reason: "blocked" };

    this.budget -= distance;
    this.x = next.x;
    this.z = next.z;
    return { ok: true };
  }

  /**
   * Whether a player could have walked between two reports through free space.
   * Besides the straight line, an L-shaped route (first along x then z, or the
   * reverse) counts: the client resolves collisions one axis at a time, so
   * rounding a corner follows exactly that shape, while the straight chord
   * between the two reports would clip the corner and wrongly look blocked.
   * Every accepted route is a continuous path through free space, so walls
   * still cannot be crossed.
   */
  private canWalk(
    from: { x: number; z: number },
    to: { x: number; z: number },
  ): boolean {
    return (
      this.isSegmentFree(from, to) ||
      this.isRouteFree(from, { x: to.x, z: from.z }, to) ||
      this.isRouteFree(from, { x: from.x, z: to.z }, to)
    );
  }

  private isRouteFree(
    a: { x: number; z: number },
    via: { x: number; z: number },
    b: { x: number; z: number },
  ) {
    return this.isSegmentFree(a, via) && this.isSegmentFree(via, b);
  }

  private isSegmentFree(
    a: { x: number; z: number },
    b: { x: number; z: number },
  ): boolean {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / PATH_STEP),
    );
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (
        isInside(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, this.colliders)
      )
        return false;
    }
    return true;
  }
}
