export interface FloorLock {
  floor: string;
  /** Who is editing. */
  holder: string;
  /** When this session of editing began. */
  since: number;
  /** When the lock lapses unless the editor says it is still there. */
  expiresAt: number;
}

export type AcquireResult =
  { ok: true; lock: FloorLock } | { ok: false; lock: FloorLock };

/**
 * Where locks are kept. Memory is enough for one process in development;
 * Postgres keeps them across restarts and between processes.
 */
export interface FloorLockStore {
  /** The lock on a floor, or null when it is free (or the last one has lapsed). */
  current(floor: string): Promise<FloorLock | null>;
  /**
   * Takes the floor for `holder`. Asking again as the same holder carries on the
   * same session. When somebody else has it, nothing changes and the answer says who.
   */
  acquire(floor: string, holder: string): Promise<AcquireResult>;
  /** The holder says it is still editing. False if it no longer holds the floor. */
  renew(floor: string, holder: string): Promise<boolean>;
  /** The holder is done. Nobody else can release their lock. */
  release(floor: string, holder: string): Promise<boolean>;
}

/** How long a lock lasts without a sign of life from its editor. */
export const LOCK_TTL_MS = 45_000;

/**
 * Who is editing which floor. While a floor has a lock nobody else may edit it,
 * and (see the game rooms) nobody may enter it. The lock only lasts as long as
 * its editor keeps renewing it, so a closed tab or a lost connection cannot
 * leave a floor shut forever.
 */
export class FloorLocks implements FloorLockStore {
  private readonly held = new Map<string, FloorLock>();
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(now: () => number = Date.now, ttlMs: number = LOCK_TTL_MS) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  /** The lock on a floor, or null when it is free (or the last one has lapsed). */
  async current(floor: string): Promise<FloorLock | null> {
    const lock = this.held.get(floor);
    if (!lock) return null;
    if (this.now() > lock.expiresAt) {
      this.held.delete(floor);
      return null;
    }
    return lock;
  }

  /**
   * Takes the floor for `holder`. Asking again as the same holder carries on the
   * same session. When somebody else has it, nothing changes and the answer says who.
   */
  async acquire(floor: string, holder: string): Promise<AcquireResult> {
    const existing = await this.current(floor);
    if (existing && existing.holder !== holder)
      return { ok: false, lock: existing };

    const lock: FloorLock = {
      floor,
      holder,
      since: existing?.since ?? this.now(),
      expiresAt: this.now() + this.ttlMs,
    };
    this.held.set(floor, lock);
    return { ok: true, lock };
  }

  /** The holder says it is still editing. False if it no longer holds the floor. */
  async renew(floor: string, holder: string): Promise<boolean> {
    const lock = await this.current(floor);
    if (!lock || lock.holder !== holder) return false;
    this.held.set(floor, { ...lock, expiresAt: this.now() + this.ttlMs });
    return true;
  }

  /** The holder is done. Nobody else can release their lock. */
  async release(floor: string, holder: string): Promise<boolean> {
    const lock = await this.current(floor);
    if (!lock || lock.holder !== holder) return false;
    this.held.delete(floor);
    return true;
  }
}
