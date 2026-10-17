type ClientReporter = (
  error: unknown,
  context?: Record<string, unknown>,
) => void;

let current: ClientReporter | null = null;

/** Where the page's failures go. Nothing until monitoring is on, which needs VITE_SENTRY_DSN at build time. */
export function setClientReporter(next: ClientReporter | null): void {
  current = next;
}

/** Tells the monitoring service about a failure, when there is one. Does nothing otherwise, and never throws. */
export function reportClientError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    current?.(error, context);
  } catch {
    // Reporting must never be the thing that fails
  }
}
