import { randomUUID } from "node:crypto";
import {
  CONTENT_LIMITS,
  type ContentFields,
  type ContentItem,
  type ContentKind,
} from "../shared/content.ts";
import type { ContentStore, CreateResult } from "./contentStore.ts";
import type { Queryable } from "./db/migrate.ts";

interface Row {
  id: string;
  floor: string;
  kind: ContentKind;
  title: string;
  author: string;
  body: string;
  link: string | null;
  pinned: boolean;
  position: number;
  created_at: string | number | bigint;
  updated_at: string | number | bigint;
}

const COLUMNS = `id, floor, kind, title, author, body, link, pinned, position, created_at, updated_at`;

const itemOf = (row: Row): ContentItem => ({
  id: row.id,
  floor: row.floor,
  kind: row.kind,
  title: row.title,
  author: row.author,
  body: row.body,
  link: row.link,
  pinned: row.pinned,
  position: row.position,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

/** The books and announcements of the floors, kept in Postgres. */
export class PgContentStore implements ContentStore {
  private readonly db: Queryable;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(
    db: Queryable,
    now: () => number = Date.now,
    newId: () => string = randomUUID,
  ) {
    this.db = db;
    this.now = now;
    this.newId = newId;
  }

  async list(floor: string, kind?: ContentKind) {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM floor_content
       WHERE floor = $1 AND ($2::text IS NULL OR kind = $2)
       ORDER BY pinned DESC, position, created_at, id`,
      [floor, kind ?? null],
    );
    return rows.map(itemOf);
  }

  async get(id: string) {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM floor_content WHERE id = $1`,
      [id],
    );
    return rows[0] ? itemOf(rows[0]) : null;
  }

  async create(
    floor: string,
    kind: ContentKind,
    fields: ContentFields,
  ): Promise<CreateResult> {
    const at = this.now();
    // The count and the insert are one statement: two at once cannot both take the last place
    const { rows } = await this.db.query<Row>(
      `INSERT INTO floor_content
         (id, floor, kind, title, author, body, link, pinned, position, created_at, updated_at)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8,
              COALESCE(MAX(position), 0) + 1, $9, $9
       FROM floor_content WHERE floor = $2 AND kind = $3
       HAVING COUNT(*) < $10
       RETURNING ${COLUMNS}`,
      [
        this.newId(),
        floor,
        kind,
        fields.title,
        fields.author,
        fields.body,
        fields.link,
        fields.pinned,
        at,
        CONTENT_LIMITS.perKind,
      ],
    );
    return rows[0]
      ? { ok: true, item: itemOf(rows[0]) }
      : { ok: false, reason: "limit" };
  }

  async update(id: string, fields: ContentFields) {
    const { rows } = await this.db.query<Row>(
      `UPDATE floor_content
       SET title = $2, author = $3, body = $4, link = $5, pinned = $6, updated_at = $7
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        fields.title,
        fields.author,
        fields.body,
        fields.link,
        fields.pinned,
        this.now(),
      ],
    );
    return rows[0] ? itemOf(rows[0]) : null;
  }

  async remove(id: string) {
    const { rows } = await this.db.query<Row>(
      `DELETE FROM floor_content WHERE id = $1 RETURNING ${COLUMNS}`,
      [id],
    );
    return rows[0] ? itemOf(rows[0]) : null;
  }
}
