const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** The sites that may call the admin API from a browser (ALLOWED_ORIGINS, comma separated). */
export function allowedOriginsFromEnv(
  env: Record<string, string | undefined>,
): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

/**
 * The headers that let a page from `origin` call the admin API, or null to say
 * nothing (the browser then refuses the call). Only the listed sites are let in
 * and, in development, pages served from this machine. Never `*`: the calls
 * carry a person's sign-in token.
 */
export function corsHeadersFor(
  origin: string | undefined,
  allowed: ReadonlySet<string>,
  development: boolean,
): Record<string, string> | null {
  if (!origin) return null;
  if (!allowed.has(origin) && !(development && LOCAL_ORIGIN.test(origin)))
    return null;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
  };
}
