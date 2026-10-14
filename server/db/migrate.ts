/** The little a database must offer for us to talk to it: `pg` and PGlite both do. */
export interface Queryable {
  query<Row = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

/**
 * The shape of the database, in order. A step that has run is never edited:
 * a change is a new step at the end. Times are milliseconds since 1970, the
 * same numbers the server uses everywhere else.
 */
export const MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  {
    id: "001_floor_locks",
    sql: `
      CREATE TABLE floor_locks (
        floor      text   PRIMARY KEY,
        holder     text   NOT NULL,
        since      bigint NOT NULL,
        expires_at bigint NOT NULL
      )`,
  },
  {
    id: "002_floor_layouts",
    sql: `
      CREATE TABLE floor_layouts (
        floor      text    NOT NULL,
        version    integer NOT NULL,
        author     text    NOT NULL,
        created_at bigint  NOT NULL,
        furniture  jsonb   NOT NULL,
        models     jsonb   NOT NULL,
        PRIMARY KEY (floor, version)
      )`,
  },
  {
    // Kept apart so that a published version is never edited: a mark is a note beside it
    id: "003_floor_layout_marks",
    sql: `
      CREATE TABLE floor_layout_marks (
        floor     text    NOT NULL,
        version   integer NOT NULL,
        marked_by text    NOT NULL,
        marked_at bigint  NOT NULL,
        PRIMARY KEY (floor, version),
        FOREIGN KEY (floor, version) REFERENCES floor_layouts (floor, version)
      )`,
  },
  {
    // Who is in the company is the sign-in service's business; these tables hold
    // what is ours: who we have seen, and what each may do in the building
    // IF NOT EXISTS: an earlier draft of these two steps already ran on the shared database
    id: "004_users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id         text    PRIMARY KEY,
        email      text,
        name       text    NOT NULL,
        is_admin   boolean NOT NULL DEFAULT false,
        created_at bigint  NOT NULL,
        seen_at    bigint  NOT NULL
      )`,
  },
  {
    // One statement per step, so every step runs the same on any database
    id: "005_floor_heads",
    sql: `
      CREATE TABLE IF NOT EXISTS floor_heads (
        floor   text NOT NULL,
        user_id text NOT NULL REFERENCES users (id),
        PRIMARY KEY (floor, user_id)
      )`,
  },
  {
    id: "006_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key        text   PRIMARY KEY,
        value      text   NOT NULL,
        updated_at bigint NOT NULL
      )`,
  },
  {
    // The look somebody chose last: kept with them, so it follows them to any browser
    id: "007_user_appearance",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS appearance jsonb`,
  },
  {
    // Who did what: only ever added to. Names are copied in, so an entry still reads
    // right after somebody changes their name or is gone
    id: "008_audit_log",
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        at             bigint NOT NULL,
        actor_user_id  text,
        actor_name     text   NOT NULL,
        action         text   NOT NULL,
        target_user_id text,
        target_name    text,
        floor          text,
        detail         jsonb  NOT NULL DEFAULT '{}'::jsonb
      )`,
  },
  {
    // The rooms of the building. Heads (floor_heads) keep their own table: a floor can have
    // heads that this table never heard of, as it could before floors were data
    id: "009_floors",
    sql: `
      CREATE TABLE IF NOT EXISTS floors (
        id         text    PRIMARY KEY,
        name       text    NOT NULL,
        common     boolean NOT NULL DEFAULT false,
        created_at bigint  NOT NULL
      )`,
  },
  {
    // The floor every installation already had, made the first and common one
    id: "010_floors_seed_office",
    sql: `
      INSERT INTO floors (id, name, common, created_at)
      VALUES ('office', 'Main office', true, 0)
      ON CONFLICT DO NOTHING`,
  },
  {
    // Who may enter a floor that is not common: an entry given by an admin
    id: "011_floor_access",
    sql: `
      CREATE TABLE IF NOT EXISTS floor_access (
        floor   text NOT NULL REFERENCES floors (id),
        user_id text NOT NULL,
        PRIMARY KEY (floor, user_id)
      )`,
  },
  {
    // What the computers and the bookshelves of a floor show. Each floor's content is its own;
    // no foreign key, so content never depends on the floors table being in step
    id: "012_floor_content",
    sql: `
      CREATE TABLE IF NOT EXISTS floor_content (
        id         text    PRIMARY KEY,
        floor      text    NOT NULL,
        kind       text    NOT NULL CHECK (kind IN ('book', 'announcement')),
        title      text    NOT NULL,
        author     text    NOT NULL DEFAULT '',
        body       text    NOT NULL DEFAULT '',
        link       text,
        pinned     boolean NOT NULL DEFAULT false,
        position   integer NOT NULL,
        created_at bigint  NOT NULL,
        updated_at bigint  NOT NULL
      )`,
  },
  {
    id: "013_floor_content_floor_index",
    sql: `
      CREATE INDEX IF NOT EXISTS floor_content_floor_idx
      ON floor_content (floor, kind, position)`,
  },
];

/** Brings the database up to date, running only the steps it has not had yet. */
export async function migrate(db: Queryable): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY)`,
  );
  const done = new Set(
    (
      await db.query<{ id: string }>(`SELECT id FROM schema_migrations`)
    ).rows.map((row) => row.id),
  );
  for (const step of MIGRATIONS) {
    if (done.has(step.id)) continue;
    await db.query(step.sql);
    // Two servers starting together may both run a step; the second must not fail for it
    await db.query(
      `INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [step.id],
    );
  }
}
