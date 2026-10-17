export interface IpLimiterOptions {
  /** Requests allowed per address in a window. Zero turns the limiter off. */
  limit: number;
  windowMs: number;
  /** How many addresses are remembered at most. */
  maxKeys?: number;
  now?: () => number;
}

export type IpLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

const DEFAULT_MAX_KEYS = 10_000;
const SWEEP_EVERY_MS = 10_000;

/**
 * A counter per address over a fixed window. The map is bounded: expired
 * entries go first, and when it is still full the oldest address is forgotten
 * (it starts a fresh count, which costs a little leniency and never memory).
 */
export function createIpLimiter(options: IpLimiterOptions) {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const entries = new Map<string, { count: number; resetAt: number }>();

  let nextSweep = 0;

  function makeRoom(at: number) {
    if (at >= nextSweep) {
      nextSweep = at + Math.min(options.windowMs, SWEEP_EVERY_MS);
      for (const [key, entry] of entries)
        if (entry.resetAt <= at) entries.delete(key);
    }
    while (entries.size >= maxKeys) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  }

  return {
    check(key: string): IpLimitResult {
      if (options.limit <= 0) return { allowed: true };
      const at = now();
      const found = entries.get(key);
      if (found && found.resetAt > at) {
        if (found.count >= options.limit)
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((found.resetAt - at) / 1000),
            ),
          };
        found.count++;
        return { allowed: true };
      }
      entries.delete(key);
      makeRoom(at);
      entries.set(key, { count: 1, resetAt: at + options.windowMs });
      return { allowed: true };
    },
    size: () => entries.size,
  };
}

/**
 * Who is calling. Behind a trusted proxy (Railway) the connection is always the
 * proxy, so the address comes from the last hop of X-Forwarded-For: the one the
 * proxy itself added, which the caller cannot forge. Otherwise the header is ignored.
 */
export function clientIp(input: {
  forwardedFor?: string | string[];
  remoteAddress?: string;
  trustProxy: boolean;
}): string {
  const header = Array.isArray(input.forwardedFor)
    ? input.forwardedFor.join(",")
    : input.forwardedFor;
  const hops = input.trustProxy
    ? (header ?? "")
        .split(",")
        .map((hop) => hop.trim())
        .filter(Boolean)
    : [];
  const address = hops.at(-1) ?? input.remoteAddress;
  return address ? address.replace(/^::ffff:/i, "") : "unknown";
}

/** What each address may ask of one area (/account, /calendar, /admin) in a minute: generous, since a whole office can share one address. */
export const DEFAULT_REQUESTS_PER_MINUTE = 1200;

/** HTTP_RATE_LIMIT_PER_MINUTE: a whole number, 0 to turn the limit off; anything else means the default. */
export function requestsPerMinuteFromEnv(
  env: Record<string, string | undefined>,
): number {
  const raw = env.HTTP_RATE_LIMIT_PER_MINUTE?.trim();
  if (!raw || !/^\d{1,7}$/.test(raw)) return DEFAULT_REQUESTS_PER_MINUTE;
  return Number(raw);
}
