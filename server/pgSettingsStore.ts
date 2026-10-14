import type { Queryable } from "./db/migrate.ts";
import type { SettingsStore } from "./settingsStore.ts";

/** Settings kept in Postgres. */
export class PgSettingsStore implements SettingsStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async get(key: string) {
    const { rows } = await this.db.query<{ value: string }>(
      `SELECT value FROM settings WHERE key = $1`,
      [key],
    );
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string) {
    await this.db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [key, value, this.now()],
    );
  }

  async setIfAbsent(key: string, value: string) {
    // One statement: of two callers at once, the database lets only one insert
    const { rows } = await this.db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, value, this.now()],
    );
    return rows.length > 0;
  }
}
