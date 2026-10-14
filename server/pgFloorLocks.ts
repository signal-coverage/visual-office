import type { Queryable } from "./db/migrate.ts";
import {
  LOCK_TTL_MS,
  type AcquireResult,
  type FloorLock,
  type FloorLockStore,
} from "./floorLocks.ts";

interface Row {
  floor: string;
  holder: string;
  since: string | number | bigint;
  expires_at: string | number | bigint;
}

// A lapsed lock is one whose time is strictly before now, as in memory
const toLock = (row: Row): FloorLock => ({
  floor: row.floor,
  holder: row.holder,
  since: Number(row.since),
  expiresAt: Number(row.expires_at),
});

/**
 * The locks kept in Postgres. Each operation is a single statement, so two
 * servers (or two requests) asking at once cannot both win: the database
 * decides, not this code.
 */
export class PgFloorLocks implements FloorLockStore {
  private readonly db: Queryable;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(
    db: Queryable,
    now: () => number = Date.now,
    ttlMs: number = LOCK_TTL_MS,
  ) {
    this.db = db;
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async current(floor: string): Promise<FloorLock | null> {
    const { rows } = await this.db.query<Row>(
      `SELECT floor, holder, since, expires_at FROM floor_locks
       WHERE floor = $1 AND expires_at >= $2`,
      [floor, this.now()],
    );
    return rows[0] ? toLock(rows[0]) : null;
  }

  async acquire(floor: string, holder: string): Promise<AcquireResult> {
    const now = this.now();
    // Takes a free or lapsed floor, or carries on the holder's own; changes
    // nothing (and returns no row) when somebody else holds it.
    const { rows } = await this.db.query<Row>(
      `INSERT INTO floor_locks (floor, holder, since, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (floor) DO UPDATE SET
         since = CASE
           WHEN floor_locks.holder = EXCLUDED.holder AND floor_locks.expires_at >= $3
           THEN floor_locks.since ELSE EXCLUDED.since END,
         holder = EXCLUDED.holder,
         expires_at = EXCLUDED.expires_at
       WHERE floor_locks.holder = EXCLUDED.holder OR floor_locks.expires_at < $3
       RETURNING floor, holder, since, expires_at`,
      [floor, holder, now, now + this.ttlMs],
    );
    if (rows[0]) return { ok: true, lock: toLock(rows[0]) };

    const existing = await this.current(floor);
    if (existing) return { ok: false, lock: existing };
    // It lapsed between the two statements: take it now
    return this.acquire(floor, holder);
  }

  async renew(floor: string, holder: string): Promise<boolean> {
    const now = this.now();
    const { rows } = await this.db.query(
      `UPDATE floor_locks SET expires_at = $3
       WHERE floor = $1 AND holder = $2 AND expires_at >= $4
       RETURNING floor`,
      [floor, holder, now + this.ttlMs, now],
    );
    return rows.length > 0;
  }

  async release(floor: string, holder: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `DELETE FROM floor_locks
       WHERE floor = $1 AND holder = $2 AND expires_at >= $3
       RETURNING floor`,
      [floor, holder, this.now()],
    );
    return rows.length > 0;
  }
}
