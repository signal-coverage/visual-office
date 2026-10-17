const DEFAULT_TIMEOUT_MS = 2000;

export interface HealthDeps {
  uptimeSeconds: () => number;
  version: string;
  isShuttingDown: () => boolean;
  /** A cheap round trip to the database, or null when there is none. */
  ping: (() => Promise<unknown>) | null;
  /** How long the database gets to answer before it counts as down. */
  timeoutMs?: number;
}

export interface HealthReply {
  status: 200 | 503;
  body: {
    ok: boolean;
    uptime: number;
    db: "up" | "down" | "none";
    version: string;
  };
}

/**
 * What GET /health answers: that the process is serving, for how long, which
 * build, and whether the database answers. Nothing about people or settings,
 * and a database error is never described, only reported as "down". A database
 * that is down does not make the answer 503: restarting the game server would
 * not bring the database back. 503 means the server is shutting down.
 */
export function createHealthCheck(
  deps: HealthDeps,
): () => Promise<HealthReply> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function database(): Promise<"up" | "down" | "none"> {
    if (!deps.ping) return "none";
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        deps.ping(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      return "up";
    } catch {
      return "down";
    } finally {
      clearTimeout(timer);
    }
  }

  return async () => {
    const shuttingDown = deps.isShuttingDown();
    return {
      status: shuttingDown ? 503 : 200,
      body: {
        ok: !shuttingDown,
        uptime: Math.floor(deps.uptimeSeconds()),
        db: shuttingDown ? "none" : await database(),
        version: deps.version,
      },
    };
  };
}

const COMMIT = /^[0-9a-f]{7,40}$/i;

/** The version to report: the package's, plus the short commit hash the host gives at build time when there is one. */
export function versionFromEnv(
  env: Record<string, string | undefined>,
  packageVersion: string,
): string {
  const commit = [
    env.RAILWAY_GIT_COMMIT_SHA,
    env.GIT_COMMIT_SHA,
    env.SOURCE_VERSION,
  ]
    .map((value) => value?.trim())
    .find((value) => value && COMMIT.test(value));
  return commit ? `${packageVersion}+${commit.slice(0, 7)}` : packageVersion;
}
