import type { AuditEntry } from "../shared/audit.ts";
import type { AuditInput, AuditStore } from "./auditStore.ts";
import type { Queryable } from "./db/migrate.ts";

interface Row {
  id: number | string;
  at: number | string;
  actor_user_id: string | null;
  actor_name: string;
  action: string;
  target_user_id: string | null;
  target_name: string | null;
  floor: string | null;
  detail: Record<string, unknown> | null;
}

const COLUMNS = `id, at, actor_user_id, actor_name, action, target_user_id, target_name, floor, detail`;

const entryOf = (row: Row): AuditEntry => ({
  id: Number(row.id),
  at: Number(row.at),
  actorUserId: row.actor_user_id,
  actorName: row.actor_name,
  action: row.action,
  targetUserId: row.target_user_id,
  targetName: row.target_name,
  floor: row.floor,
  detail: row.detail ?? {},
});

/** The audit log, kept in Postgres. */
export class PgAuditStore implements AuditStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async append(input: AuditInput) {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO audit_log
         (at, actor_user_id, actor_name, action, target_user_id, target_name, floor, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING ${COLUMNS}`,
      [
        this.now(),
        input.actorUserId,
        input.actorName,
        input.action,
        input.targetUserId ?? null,
        input.targetName ?? null,
        input.floor ?? null,
        JSON.stringify(input.detail ?? {}),
      ],
    );
    return entryOf(rows[0]);
  }

  async list({ limit, before }: { limit: number; before?: number }) {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM audit_log
       WHERE ($1::bigint IS NULL OR id < $1)
       ORDER BY id DESC LIMIT $2`,
      [before ?? null, limit],
    );
    return rows.map(entryOf);
  }
}
