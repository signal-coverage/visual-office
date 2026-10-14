import type { Queryable } from "./db/migrate.ts";
import type {
  Layout,
  LayoutStore,
  LayoutSummary,
  StoredLayout,
} from "./layoutStore.ts";

interface Row {
  floor: string;
  version: number | string;
  author: string;
  created_at: number | string | bigint;
  furniture?: StoredLayout["furniture"];
  models?: StoredLayout["models"];
  good?: boolean;
}

const baseOf = (row: Row) => ({
  floor: row.floor,
  version: Number(row.version),
  author: row.author,
  createdAt: Number(row.created_at),
});

const summaryOf = (row: Row): LayoutSummary => ({
  ...baseOf(row),
  good: row.good === true,
});

const storedOf = (row: Row): StoredLayout => ({
  ...baseOf(row),
  furniture: row.furniture ?? [],
  models: row.models ?? [],
});

/** Postgres error code for breaking a UNIQUE rule: somebody published at the same moment. */
const UNIQUE_VIOLATION = "23505";
const PUBLISH_ATTEMPTS = 5;

/** Layouts kept in Postgres, one row per published version. */
export class PgLayoutStore implements LayoutStore {
  private readonly db: Queryable;
  private readonly now: () => number;

  constructor(db: Queryable, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async current(floor: string) {
    const { rows } = await this.db.query<Row>(
      `SELECT floor, version, author, created_at, furniture, models
       FROM floor_layouts WHERE floor = $1 ORDER BY version DESC LIMIT 1`,
      [floor],
    );
    return rows[0] ? storedOf(rows[0]) : null;
  }

  async get(floor: string, version: number) {
    const { rows } = await this.db.query<Row>(
      `SELECT floor, version, author, created_at, furniture, models
       FROM floor_layouts WHERE floor = $1 AND version = $2`,
      [floor, version],
    );
    return rows[0] ? storedOf(rows[0]) : null;
  }

  async history(floor: string, limit = 50) {
    const { rows } = await this.db.query<Row>(
      `SELECT l.floor, l.version, l.author, l.created_at,
              (m.version IS NOT NULL) AS good
       FROM floor_layouts l
       LEFT JOIN floor_layout_marks m
         ON m.floor = l.floor AND m.version = l.version
       WHERE l.floor = $1 ORDER BY l.version DESC LIMIT $2`,
      [floor, limit],
    );
    return rows.map(summaryOf);
  }

  async mark(floor: string, version: number, by: string) {
    const { rows } = await this.db.query(
      `INSERT INTO floor_layout_marks (floor, version, marked_by, marked_at)
       SELECT floor, version, $3, $4 FROM floor_layouts
       WHERE floor = $1 AND version = $2
       ON CONFLICT DO NOTHING
       RETURNING floor`,
      [floor, version, by, this.now()],
    );
    if (rows.length > 0) return true;
    // Nothing was added: either it was marked already, or there is no such version
    return (await this.get(floor, version)) !== null;
  }

  async lastGood(floor: string) {
    const { rows } = await this.db.query<Row>(
      `SELECT l.floor, l.version, l.author, l.created_at, l.furniture, l.models
       FROM floor_layouts l
       JOIN floor_layout_marks m ON m.floor = l.floor AND m.version = l.version
       WHERE l.floor = $1 ORDER BY l.version DESC LIMIT 1`,
      [floor],
    );
    return rows[0] ? storedOf(rows[0]) : null;
  }

  async publish(floor: string, layout: Layout, author: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        // The next number is worked out by the same statement that stores it;
        // if somebody else took it a moment earlier the UNIQUE rule says so
        const { rows } = await this.db.query<Row>(
          `INSERT INTO floor_layouts (floor, version, author, created_at, furniture, models)
           SELECT $1, COALESCE(MAX(version), 0) + 1, $2, $3, $4::jsonb, $5::jsonb
           FROM floor_layouts WHERE floor = $1
           RETURNING floor, version, author, created_at, furniture, models`,
          [
            floor,
            author,
            this.now(),
            JSON.stringify(layout.furniture),
            JSON.stringify(layout.models),
          ],
        );
        return storedOf(rows[0]);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== UNIQUE_VIOLATION || attempt >= PUBLISH_ATTEMPTS)
          throw error;
      }
    }
  }
}
