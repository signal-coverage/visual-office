import { MAX_PURGE_PER_CALL, type BanMeta, type BanStore } from "./banStore.ts";
import type { Queryable } from "./db/migrate.ts";

const MINUTE_MS = 60_000;

/** Bans kept in Postgres, so they outlive a restart. Lapsed rows are ignored and removed a few at a time. */
export class PgBanStore implements BanStore {
  private readonly db: Queryable;

  constructor(db: Queryable) {
    this.db = db;
  }

  private async purge(now: number) {
    await this.db.query(
      `DELETE FROM bans WHERE id IN (
         SELECT id FROM bans WHERE until <= $1 ORDER BY until LIMIT $2
       )`,
      [now, MAX_PURGE_PER_CALL],
    );
  }

  async ban(userId: string, minutes: number, now: number, meta?: BanMeta) {
    const until = now + minutes * MINUTE_MS;
    await this.db.query(
      `WITH replaced AS (DELETE FROM bans WHERE user_id = $1)
       INSERT INTO bans (user_id, until, reason, by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, until, meta?.reason ?? null, meta?.byUserId ?? null, now],
    );
    await this.purge(now);
    return until;
  }

  async activeUntil(userId: string, now: number) {
    const { rows } = await this.db.query<{ until: number | string | null }>(
      `SELECT max(until) AS until FROM bans WHERE user_id = $1 AND until > $2`,
      [userId, now],
    );
    return rows[0]?.until == null ? null : Number(rows[0].until);
  }

  async lift(userId: string, now: number) {
    const { rows } = await this.db.query<{ until: number | string }>(
      `DELETE FROM bans WHERE user_id = $1 RETURNING until`,
      [userId],
    );
    return rows.some((row) => Number(row.until) > now);
  }

  async list(now: number) {
    await this.purge(now);
    const { rows } = await this.db.query<{
      user_id: string;
      until: number | string;
    }>(
      `SELECT user_id, max(until) AS until FROM bans
       WHERE until > $1 GROUP BY user_id ORDER BY max(created_at), user_id`,
      [now],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      until: Number(row.until),
    }));
  }
}
