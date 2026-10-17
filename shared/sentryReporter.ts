import { redactContext, redactText } from "./redact.ts";

const MAX_STACK_LENGTH = 4000;
const MAX_MESSAGE_LENGTH = 1000;
const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_MINUTE = 10;

/** Reports a failure to a monitoring service. Never throws and never waits. */
export type ErrorReporter = (
  error: unknown,
  context?: Record<string, unknown>,
) => void;

/** Where a Sentry address (DSN) sends events: the endpoint carries the public key. */
export function parseDsn(
  dsn: string,
): { publicKey: string; endpoint: string } | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const publicKey = url.username;
  const parts = url.pathname.split("/").filter(Boolean);
  const project = parts.pop();
  if (!publicKey || !project || !/^\d+$/.test(project)) return null;
  const prefix = parts.length > 0 ? `/${parts.join("/")}` : "";
  return {
    publicKey,
    endpoint: `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/?sentry_version=7&sentry_key=${publicKey}`,
  };
}

export interface SentryReporterOptions {
  dsn: string;
  platform: "node" | "javascript";
  fetch: typeof fetch;
  environment?: string;
  release?: string;
  now?: () => number;
  randomId?: () => string;
  /** More failures than this in a minute are dropped, so a loop of errors cannot flood the service or the network. */
  maxPerMinute?: number;
}

const newId = () => crypto.randomUUID().replaceAll("-", "");

function describe(error: unknown): {
  type: string;
  value: string;
  stack?: string;
} {
  if (error instanceof Error)
    return { type: error.name, value: error.message, stack: error.stack };
  return {
    type: "Error",
    value: typeof error === "string" ? error : "Non-error value thrown",
  };
}

/**
 * Sends errors to Sentry with plain HTTP (its envelope format), so no SDK has to
 * be installed or downloaded. Everything is redacted first: no tokens, emails,
 * addresses with passwords or request bodies leave this process. Null when the
 * address is not a usable DSN.
 */
export function createSentryReporter(
  options: SentryReporterOptions,
): ErrorReporter | null {
  const parsed = parseDsn(options.dsn);
  if (!parsed) return null;
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? newId;
  const maxPerMinute = options.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE;
  let windowStart = 0;
  let sent = 0;

  return (error, context = {}) => {
    try {
      const at = now();
      if (at - windowStart >= WINDOW_MS) {
        windowStart = at;
        sent = 0;
      }
      if (sent >= maxPerMinute) return;
      sent++;

      const { type, value, stack } = describe(error);
      const eventId = randomId();
      const event = {
        event_id: eventId,
        timestamp: at / 1000,
        platform: options.platform,
        level: "error",
        ...(options.environment ? { environment: options.environment } : {}),
        ...(options.release ? { release: options.release } : {}),
        exception: {
          values: [
            {
              type,
              value: redactText(value).slice(0, MAX_MESSAGE_LENGTH),
            },
          ],
        },
        tags: redactContext(context),
        ...(stack
          ? {
              extra: {
                stack: redactText(stack).slice(0, MAX_STACK_LENGTH),
              },
            }
          : {}),
      };
      const body = [
        JSON.stringify({
          event_id: eventId,
          sent_at: new Date(at).toISOString(),
        }),
        JSON.stringify({ type: "event" }),
        JSON.stringify(event),
      ].join("\n");
      void options
        .fetch(parsed.endpoint, {
          method: "POST",
          body,
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          keepalive: true,
        })
        .catch(() => {});
    } catch {
      // Reporting must never be the thing that fails
    }
  };
}
