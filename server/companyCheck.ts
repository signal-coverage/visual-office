import { parseDsn } from "../shared/sentryReporter.ts";
import { authStatusFromEnv } from "./authStatus.ts";
import { databaseUrlFromEnv } from "./db/connect.ts";
import { voiceStatusFromEnv } from "./voice.ts";

type Env = Record<string, string | undefined>;

export interface Finding {
  /** An error stops the company from working; a warning is advice. */
  level: "error" | "warning";
  /** Says what is wrong. Never holds a key, a secret or a connection string. */
  message: string;
}

const set = (env: Env, name: string) => env[name]?.trim() || undefined;

/**
 * Looks over the settings of one company's installation before it is deployed:
 * the server's (Railway) and the site's (Vercel, set when it is built). It only
 * says which setting is wrong, never what it holds, since they are secrets.
 * Errors come first.
 */
export function checkCompany(server: Env, site: Env): Finding[] {
  const found: Finding[] = [];
  const error = (message: string) => found.push({ level: "error", message });
  const warn = (message: string) => found.push({ level: "warning", message });

  // The database: without it roles, layouts and bookings vanish at every restart
  try {
    if (!databaseUrlFromEnv(server))
      error(
        "DATABASE_URL is not set: people, roles and layouts would be lost at every restart",
      );
  } catch {
    error("DATABASE_URL is not a Postgres address (postgresql://…)");
  }

  // Sign-in and who is in the company
  const auth = authStatusFromEnv(server);
  if (!auth.ready) error(auth.summary);
  else if (/test keys/.test(auth.summary))
    warn(
      "The Clerk keys are test keys: for a real company use a production Clerk instance",
    );
  const organization = set(server, "CLERK_ORGANIZATION_ID");
  const admins = set(server, "ADMIN_EMAILS");
  if (!organization && !admins)
    error(
      "Neither CLERK_ORGANIZATION_ID nor ADMIN_EMAILS is set: nobody could set the company up, so nobody could enter",
    );
  else if (!organization)
    warn(
      "CLERK_ORGANIZATION_ID is not set: nobody enters until the first admin sets the company up from the game (fine for a new company)",
    );
  else if (!organization.startsWith("org_"))
    error("CLERK_ORGANIZATION_ID should look like org_…");
  if (!admins && organization)
    warn(
      "ADMIN_EMAILS is empty: nobody will be an admin, so nobody can name floor heads",
    );

  // The site must agree with the server
  const serverUrl = set(site, "VITE_SERVER_URL");
  if (!serverUrl) error("VITE_SERVER_URL is not set on the site");
  else if (!/^wss:\/\//i.test(serverUrl))
    error(
      "VITE_SERVER_URL must start with wss:// (a secure page cannot open ws://, and https:// is not a websocket address)",
    );
  const sitePublishable = set(site, "VITE_CLERK_PUBLISHABLE_KEY");
  const serverPublishable =
    set(server, "VITE_CLERK_PUBLISHABLE_KEY") ??
    set(server, "CLERK_PUBLISHABLE_KEY");
  if (!sitePublishable)
    error("VITE_CLERK_PUBLISHABLE_KEY is not set on the site");
  else if (serverPublishable && sitePublishable !== serverPublishable)
    error(
      "The site and the server use different Clerk publishable keys: they must come from the same Clerk instance",
    );

  // The sites that may call the server from a browser
  const origins = (server.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0)
    warn(
      "ALLOWED_ORIGINS is empty: the editor and the people screen inside the game will not work",
    );
  for (const origin of origins) {
    if (!/^https:\/\/[^/\s]+$/.test(origin.replace(/\/+$/, "")))
      error(
        `ALLOWED_ORIGINS has "${origin}", which is not a site address like https://office.example.com`,
      );
  }

  // Voice
  const voice = voiceStatusFromEnv({ ...server, NODE_ENV: "production" });
  if (!voice.config) warn(voice.summary);
  else if (!set(server, "VOICE_ROOM_PREFIX"))
    warn(
      "VOICE_ROOM_PREFIX is not set: fine if this company has its own LiveKit project; if it shares one with another company, set it or their voice rooms will be the same",
    );

  // Error monitoring is optional: it is only ever advice
  for (const [env, name, where] of [
    [server, "SENTRY_DSN", "the server"],
    [site, "VITE_SENTRY_DSN", "the site"],
  ] as const) {
    const dsn = set(env, name);
    if (!dsn)
      warn(
        `${name} is not set: recommended, so failures on ${where} are reported instead of going unnoticed (see docs/BUILDING.md, Operations)`,
      );
    else if (!parseDsn(dsn))
      warn(`${name} is not a valid Sentry address: no errors will be reported`);
  }

  if (set(server, "FLOOR_ADMIN_TOKEN"))
    warn(
      "FLOOR_ADMIN_TOKEN is set: it gives full access to whoever holds it; leave it out unless you need scripts",
    );

  return [
    ...found.filter((f) => f.level === "error"),
    ...found.filter((f) => f.level === "warning"),
  ];
}
