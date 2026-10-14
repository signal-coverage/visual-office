import pg from "pg";

/**
 * Where the database is, from the environment (DATABASE_URL, the connection
 * string Neon gives). Null when there is none: the server then runs without a
 * database, keeping what it can in memory. A value that is not a Postgres
 * address is refused, without printing it: it holds the password.
 */
export function databaseUrlFromEnv(
  env: Record<string, string | undefined>,
): string | null {
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!/^postgres(ql)?:\/\//i.test(url))
    throw new Error(
      "DATABASE_URL must be a Postgres address (it should start with postgres:// or postgresql://).",
    );
  return url;
}

/**
 * A few connections that are let go when idle, so a quiet server does not keep
 * the database awake (Neon switches its compute off after a while without use,
 * which is what keeps the cost down).
 */
export function connectDatabase(url: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    // The first request after the database slept has to wait for it to wake
    connectionTimeoutMillis: 15_000,
  });
  // The database may drop an idle connection; without a listener that would crash the server
  pool.on("error", (error) => {
    console.error("Database connection error:", error.message);
  });
  return pool;
}
