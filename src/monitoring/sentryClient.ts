import { createSentryReporter } from "../../shared/sentryReporter.ts";

/** The reporter for this site: Sentry's HTTP API, no SDK. Its own chunk, downloaded only when the site was built with VITE_SENTRY_DSN. */
export function createClientReporter(dsn: string) {
  return createSentryReporter({
    dsn,
    platform: "javascript",
    fetch: (input, init) => window.fetch(input, init),
    environment: import.meta.env.MODE,
  });
}
