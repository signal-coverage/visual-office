import type { ErrorReporter } from "../shared/sentryReporter.ts";

type Env = Record<string, string | undefined>;

interface Loader {
  load?: () => Promise<typeof import("../shared/sentryReporter.ts")>;
  fetch?: typeof fetch;
}

let current: ErrorReporter | null = null;

/**
 * Turns error monitoring on when SENTRY_DSN is set. Until then (and always when
 * it is not) nothing is loaded and nothing is sent. Returns a line for the log
 * that never holds the address, which carries a key.
 */
export async function initErrorReporting(
  env: Env,
  {
    load = () => import("../shared/sentryReporter.ts"),
    fetch: send = fetch,
  }: Loader = {},
): Promise<string> {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return "Error monitoring: off (SENTRY_DSN is not set)";
  try {
    const { createSentryReporter } = await load();
    const reporter = createSentryReporter({
      dsn,
      platform: "node",
      fetch: send,
      environment: env.NODE_ENV,
      release: env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7),
    });
    if (!reporter)
      return "Error monitoring: off (SENTRY_DSN is not a valid Sentry address)";
    current = reporter;
    return "Error monitoring: on (Sentry)";
  } catch {
    return "Error monitoring: off (could not load the reporter)";
  }
}

/** Tells the monitoring service about a failure, with a few plain facts. Does nothing when monitoring is off, and never throws. */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    current?.(error, context);
  } catch {
    // Reporting must never be the thing that fails
  }
}

export function resetErrorReporting(): void {
  current = null;
}
