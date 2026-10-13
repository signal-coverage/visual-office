import { parseAppearance, type Appearance } from "../shared/appearance.ts";
import type { Queryable } from "./db/migrate.ts";
import type {
  PersonRecord,
  Roles,
  UserRecord,
  UserStore,
} from "./userStore.ts";

interface UserRow {
  id: string;
  email: string | null;
  name: string;
  is_admin: boolean;
}

const recordOf = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  isAdmin: row.is_admin,
});

/** The people of the building, kept in Postgres. */
export class PgUserStore implements UserStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async upsert(user: { id: string; email: string | null; name: string }) {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (id, email, name, created_at, seen_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email, name = EXCLUDED.name, seen_at = EXCLUDED.seen_at
       RETURNING id, email, name, is_admin`,
      [user.id, user.email, user.name, this.now()],
    );
    return recordOf(rows[0]);
  }

  async get(id: string) {
    const { rows } = await this.db.query<UserRow>(
      `SELECT id, email, name, is_admin FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async setAdmin(id: string, admin: boolean) {
    const { rows } = await this.db.query(
      `UPDATE users SET is_admin = $2 WHERE id = $1 RETURNING id`,
      [id, admin],
    );
    return rows.length > 0;
  }

  async addHead(floor: string, userId: string) {
    const { rows } = await this.db.query(
      `INSERT INTO floor_heads (floor, user_id)
       SELECT $1, id FROM users WHERE id = $2
       ON CONFLICT DO NOTHING
       RETURNING floor`,
      [floor, userId],
    );
    if (rows.length > 0) return true;
    // Nothing was added: they were head already, or they never signed in
    return (await this.get(userId)) !== null;
  }

  async removeHead(floor: string, userId: string) {
    const { rows } = await this.db.query(
      `DELETE FROM floor_heads WHERE floor = $1 AND user_id = $2 RETURNING floor`,
      [floor, userId],
    );
    return rows.length > 0;
  }

  async headsOf(floor: string) {
    const { rows } = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM floor_heads WHERE floor = $1 ORDER BY user_id`,
      [floor],
    );
    return rows.map((row) => row.user_id);
  }

  async list(): Promise<PersonRecord[]> {
    const { rows } = await this.db.query<UserRow & { heads: string[] }>(
      `SELECT u.id, u.email, u.name, u.is_admin,
              COALESCE(
                array_agg(h.floor ORDER BY h.floor) FILTER (WHERE h.floor IS NOT NULL),
                ARRAY[]::text[]
              ) AS heads
       FROM users u
       LEFT JOIN floor_heads h ON h.user_id = u.id
       GROUP BY u.id
       ORDER BY lower(u.name), u.id`,
    );
    return rows.map((row) => ({ ...recordOf(row), headOf: row.heads }));
  }

  async appearanceOf(userId: string) {
    const { rows } = await this.db.query<{ appearance: unknown }>(
      `SELECT appearance FROM users WHERE id = $1`,
      [userId],
    );
    // Read strictly: what is kept is somebody's choice, or nothing
    return parseAppearance(rows[0]?.appearance);
  }

  async setAppearance(userId: string, appearance: Appearance) {
    const { rows } = await this.db.query(
      `UPDATE users SET appearance = $2::jsonb WHERE id = $1 RETURNING id`,
      [userId, JSON.stringify(appearance)],
    );
    return rows.length > 0;
  }

  async rolesOf(userId: string): Promise<Roles> {
    const user = await this.get(userId);
    const { rows } = await this.db.query<{ floor: string }>(
      `SELECT floor FROM floor_heads WHERE user_id = $1 ORDER BY floor`,
      [userId],
    );
    return { admin: user?.isAdmin ?? false, headOf: rows.map((r) => r.floor) };
  }
}
