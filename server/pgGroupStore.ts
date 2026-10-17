import type { Queryable } from "./db/migrate.ts";
import type { GroupRecord, GroupStore } from "./groupStore.ts";

interface Row {
  id: string;
  name: string;
  created_at: string | number | bigint;
  floors: string[];
  members: string[];
}

// The rooms and members are gathered in the same statement, so a group is always read whole
const SELECT = `
  SELECT g.id, g.name, g.created_at,
    COALESCE(
      (SELECT array_agg(f.floor_id ORDER BY f.floor_id)
         FROM group_floors f WHERE f.group_id = g.id),
      ARRAY[]::text[]) AS floors,
    COALESCE(
      (SELECT array_agg(m.user_id ORDER BY m.user_id)
         FROM group_members m WHERE m.group_id = g.id),
      ARRAY[]::text[]) AS members
  FROM groups g`;

const recordOf = (row: Row): GroupRecord => ({
  id: row.id,
  name: row.name,
  createdAt: Number(row.created_at),
  floors: row.floors,
  members: row.members,
});

/** The role groups, kept in Postgres. */
export class PgGroupStore implements GroupStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async list() {
    const { rows } = await this.db.query<Row>(
      `${SELECT} ORDER BY g.created_at, g.id`,
    );
    return rows.map(recordOf);
  }

  async get(id: string) {
    const { rows } = await this.db.query<Row>(`${SELECT} WHERE g.id = $1`, [
      id,
    ]);
    return rows[0] ? recordOf(rows[0]) : null;
  }

  async create({ id, name }: { id: string; name: string }) {
    const { rows } = await this.db.query(
      `INSERT INTO groups (id, name, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [id, name, this.now()],
    );
    return rows.length > 0 ? this.get(id) : null;
  }

  async rename(id: string, name: string) {
    const { rows } = await this.db.query(
      `UPDATE groups SET name = $2 WHERE id = $1 RETURNING id`,
      [id, name],
    );
    return rows.length > 0 ? this.get(id) : null;
  }

  async remove(id: string) {
    // The members and rooms go with it (ON DELETE CASCADE)
    const { rows } = await this.db.query(
      `DELETE FROM groups WHERE id = $1 RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async setMember(group: string, userId: string, member: boolean) {
    if (member) {
      await this.db.query(
        `INSERT INTO group_members (group_id, user_id)
         SELECT id, $2 FROM groups WHERE id = $1
         ON CONFLICT DO NOTHING`,
        [group, userId],
      );
    } else {
      await this.db.query(
        `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [group, userId],
      );
    }
    return this.exists(group);
  }

  async setFloor(group: string, floor: string, allowed: boolean) {
    if (allowed) {
      await this.db.query(
        `INSERT INTO group_floors (group_id, floor_id)
         SELECT g.id, f.id FROM groups g, floors f
         WHERE g.id = $1 AND f.id = $2
         ON CONFLICT DO NOTHING`,
        [group, floor],
      );
    } else {
      await this.db.query(
        `DELETE FROM group_floors WHERE group_id = $1 AND floor_id = $2`,
        [group, floor],
      );
    }
    const { rows } = await this.db.query(
      `SELECT 1 FROM groups g, floors f WHERE g.id = $1 AND f.id = $2`,
      [group, floor],
    );
    return rows.length > 0;
  }

  async groupsOf(userId: string) {
    const { rows } = await this.db.query<Row>(
      `${SELECT}
       WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       ORDER BY g.created_at, g.id`,
      [userId],
    );
    return rows.map(recordOf);
  }

  private async exists(group: string) {
    const { rows } = await this.db.query(`SELECT 1 FROM groups WHERE id = $1`, [
      group,
    ]);
    return rows.length > 0;
  }
}
