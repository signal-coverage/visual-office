import type { Queryable } from "./db/migrate.ts";
import type { FloorRecord, FloorStore } from "./floorStore.ts";

interface Row {
  id: string;
  name: string;
  common: boolean;
  created_at: string | number | bigint;
  archived_at: string | number | bigint | null;
}

const COLUMNS = `id, name, common, created_at, archived_at`;

const recordOf = (row: Row): FloorRecord => ({
  id: row.id,
  name: row.name,
  common: row.common,
  createdAt: Number(row.created_at),
  ...(row.archived_at === null ? {} : { archivedAt: Number(row.archived_at) }),
});

/** The floors and who has an entry for each, kept in Postgres. */
export class PgFloorStore implements FloorStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async list() {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM floors ORDER BY created_at, id`,
    );
    return rows.map(recordOf);
  }

  async get(id: string) {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM floors WHERE id = $1`,
      [id],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async create({ id, name }: { id: string; name: string }) {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO floors (id, name, common, created_at)
       VALUES ($1, $2, false, $3)
       ON CONFLICT DO NOTHING
       RETURNING ${COLUMNS}`,
      [id, name, this.now()],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async rename(id: string, name: string) {
    const { rows } = await this.db.query<Row>(
      `UPDATE floors SET name = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, name],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async archive(id: string) {
    const { rows } = await this.db.query<Row>(
      `UPDATE floors SET archived_at = COALESCE(archived_at, $2)
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, this.now()],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async unarchive(id: string) {
    const { rows } = await this.db.query<Row>(
      `UPDATE floors SET archived_at = NULL WHERE id = $1 RETURNING ${COLUMNS}`,
      [id],
    );
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async grant(floor: string, userId: string) {
    const { rows } = await this.db.query(
      `INSERT INTO floor_access (floor, user_id)
       SELECT id, $2 FROM floors WHERE id = $1
       ON CONFLICT DO NOTHING
       RETURNING floor`,
      [floor, userId],
    );
    if (rows.length > 0) return true;
    // Nothing was added: they had the entry already, or there is no such floor
    return (await this.get(floor)) !== null;
  }

  async revoke(floor: string, userId: string) {
    const { rows } = await this.db.query(
      `DELETE FROM floor_access WHERE floor = $1 AND user_id = $2 RETURNING floor`,
      [floor, userId],
    );
    return rows.length > 0;
  }

  async floorsOf(userId: string) {
    const { rows } = await this.db.query<{ floor: string }>(
      `SELECT floor FROM floor_access WHERE user_id = $1 ORDER BY floor`,
      [userId],
    );
    return rows.map((row) => row.floor);
  }

  async allGrants() {
    const { rows } = await this.db.query<{ floor: string; user_id: string }>(
      `SELECT floor, user_id FROM floor_access ORDER BY floor, user_id`,
    );
    return rows.map((row) => ({ floor: row.floor, userId: row.user_id }));
  }
}
