import "./env.ts";
import { readFileSync } from "node:fs";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME, SERVER_PORT } from "../shared/constants.ts";
import { COMMON_FLOOR_ID } from "../shared/floors.ts";
import { FURNITURE } from "../shared/layout.ts";
import { findProblems } from "../shared/officeProblems.ts";
import { PROPS } from "../shared/props.ts";
import type { IncomingMessage } from "node:http";
import { handleAccount } from "./account.ts";
import { resolveActor } from "./actor.ts";
import { authenticateJoin, setSignIn, setUserStore, users } from "./auth.ts";
import { auditLog, recordAudit, setAuditStore } from "./audit.ts";
import { authStatusFromEnv } from "./authStatus.ts";
import { bans, CachedBanStore, setBanStore } from "./banStore.ts";
import { clerkAuthFromEnv } from "./clerkAuth.ts";
import { createCompany } from "./company.ts";
import {
  companySettings,
  createCompanySettings,
  setCompanySettings,
} from "./companySettings.ts";
import { handleCalendarAdmin } from "./calendarAdmin.ts";
import { calendarOptionsFromEnv, createFeedFetcher } from "./calendarFetch.ts";
import { calendarRoomsOf } from "./calendarRoomList.ts";
import { handleCalendar } from "./calendarRooms.ts";
import { handleContentAdmin, MAX_CONTENT_BODY_CHARS } from "./contentAdmin.ts";
import { handleContentRead } from "./contentRead.ts";
import { MemoryContentStore, type ContentStore } from "./contentStore.ts";
import { createCalendarService } from "./calendarService.ts";
import { allowedOriginsFromEnv, corsHeadersFor } from "./cors.ts";
import { connectDatabase, databaseUrlFromEnv } from "./db/connect.ts";
import { migrate } from "./db/migrate.ts";
import { handleAuditAdmin } from "./auditAdmin.ts";
import { authorizeAdmin, handleFloorAdmin } from "./floorAdmin.ts";
import { handleFloorList } from "./floorList.ts";
import { createFloorPreviews } from "./floorPreviews.ts";
import {
  closeFloor,
  floorArchived,
  floorDirectory,
  floorLocks,
  floorRooms,
  groupDirectory,
  knownFloorIds,
  layouts,
  recheckAccess,
  refreshFloor,
  setFloorLockStore,
  setFloorStore,
  setGroupStore,
  setLayoutStore,
} from "./floors.ts";
import { handleGroupsAdmin } from "./groupsAdmin.ts";
import { handleLayoutAdmin, MAX_LAYOUT_BODY_BYTES } from "./layoutAdmin.ts";
import { createHealthCheck, versionFromEnv } from "./health.ts";
import {
  clientIp,
  createIpLimiter,
  requestsPerMinuteFromEnv,
} from "./httpRateLimit.ts";
import { runGuarded, sendReply } from "./httpReply.ts";
import { initErrorReporting, reportError } from "./errorReporting.ts";
import { handleModerationAdmin } from "./moderationAdmin.ts";
import { PgAuditStore } from "./pgAuditStore.ts";
import { PgBanStore } from "./pgBanStore.ts";
import { PgContentStore } from "./pgContentStore.ts";
import { PgFloorLocks } from "./pgFloorLocks.ts";
import { PgFloorStore } from "./pgFloorStore.ts";
import { PgGroupStore } from "./pgGroupStore.ts";
import { handlePeopleAdmin } from "./peopleAdmin.ts";
import { installProcessErrorHandlers } from "./processErrors.ts";
import { readJson } from "./readJson.ts";
import { applySecurityHeaders } from "./securityHeaders.ts";
import { createShutdown } from "./shutdown.ts";
import { handleRoomsAdmin } from "./roomsAdmin.ts";
import { handleSettingsAdmin } from "./settingsAdmin.ts";
import { PgLayoutStore } from "./pgLayoutStore.ts";
import { PgSettingsStore } from "./pgSettingsStore.ts";
import { PgUserStore } from "./pgUserStore.ts";
import { MemorySettingsStore, type SettingsStore } from "./settingsStore.ts";
import { chooseFloor, OfficeRoom } from "./OfficeRoom.ts";
import { voiceStatusFromEnv } from "./voice.ts";

const port = Number(process.env.PORT ?? SERVER_PORT);
const allowedOrigins = allowedOriginsFromEnv(process.env);

console.log(await initErrorReporting(process.env));

/** How long a shutdown may take before the process exits anyway: hosts kill a process that lingers. */
const SHUTDOWN_TIMEOUT_MS = 8000;
let pool: ReturnType<typeof connectDatabase> | null = null;
const shutdown = createShutdown({
  steps: [
    // Rooms first: everybody is told with a code of its own and the game joins again by itself
    { name: "rooms", run: () => server.gracefullyShutdown(false) },
    { name: "database", run: async () => void (await pool?.end()) },
  ],
  timeoutMs: SHUTDOWN_TIMEOUT_MS,
  exit: (code) => process.exit(code),
  log: (line) => console.log(line),
});
installProcessErrorHandlers({
  proc: process,
  log: (line) => console.error(line),
  report: reportError,
  shutdown: (reason, code) => void shutdown.run(reason, code),
});
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => void shutdown.run(signal));
// Windows has no SIGTERM: a process manager that started this one with a message channel asks it this way
process.on("message", (message) => {
  if (message === "shutdown") void shutdown.run("shutdown message");
});

const packageVersion = (() => {
  try {
    const { version } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    return typeof version === "string" ? version : "unknown";
  } catch {
    return "unknown";
  }
})();

// With a database, floor locks survive a restart; without one they live in memory
const databaseUrl = databaseUrlFromEnv(process.env);
let settings: SettingsStore = new MemorySettingsStore();
let content: ContentStore = new MemoryContentStore();
if (databaseUrl) {
  pool = connectDatabase(databaseUrl);
  await migrate(pool);
  setBanStore(new CachedBanStore(new PgBanStore(pool)));
  setFloorLockStore(new PgFloorLocks(pool));
  setLayoutStore(new PgLayoutStore(pool));
  setFloorStore(new PgFloorStore(pool));
  setGroupStore(new PgGroupStore(pool));
  setUserStore(new PgUserStore(pool));
  settings = new PgSettingsStore(pool);
  setAuditStore(new PgAuditStore(pool));
  content = new PgContentStore(pool);
  console.log(
    "Database connected: floors, groups, floor locks, layouts, people, bans, books and announcements, and the audit log are kept in it",
  );
} else {
  console.log(
    "No DATABASE_URL: floors, groups, floor locks, layouts, people, bans, books and announcements, and the audit log are kept in memory and lost on restart",
  );
}

setCompanySettings(createCompanySettings(settings));

// What the rooms are doing, from the calendar feeds the admins paste: read-only
const calendarOptions = calendarOptionsFromEnv(process.env);
if (calendarOptions.allowLocalForTests)
  console.warn(
    "CALENDAR_ALLOW_LOCAL_FOR_TESTS is on: calendar feeds may be plain http and on this machine. For tests only.",
  );
/** The private rooms of every floor, as each floor's shell has them now. */
const calendarRooms = () => calendarRoomsOf(floorDirectory, layouts);
const calendar = createCalendarService({
  store: settings,
  fetchFeed: createFeedFetcher({
    allowLocalForTests: calendarOptions.allowLocalForTests,
  }),
  rooms: async () => (await calendarRooms()).map((room) => room.id),
});

// The company: which Clerk organization its people are in. CLERK_ORGANIZATION_ID decides
// when it is set; otherwise the first admin sets it up from the game and it is kept in the database
const company = createCompany({
  fromEnv: process.env.CLERK_ORGANIZATION_ID,
  settings,
});

// Sign-in (Clerk) is on when its keys are there; without them everybody may enter, as before
const clerkAuth = clerkAuthFromEnv(
  process.env,
  users,
  company,
  companySettings,
  recordAudit,
);
setSignIn(clerkAuth);
if (clerkAuth) {
  const organizationId = await company.get();
  console.log(
    organizationId
      ? `Company: organization ${organizationId} (${process.env.CLERK_ORGANIZATION_ID?.trim() ? "from CLERK_ORGANIZATION_ID" : "saved from the game"})`
      : "The company is not set up yet: the first admin (ADMIN_EMAILS) sets it up from the game",
  );
}

/** Lets the game's own site call the server from a browser (it asks permission first). True when the request was only that question. */
function handleCors(
  req: IncomingMessage & { method?: string },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { end: () => void };
  },
): boolean {
  const cors = corsHeadersFor(
    req.headers.origin,
    allowedOrigins,
    process.env.NODE_ENV !== "production",
  );
  if (cors)
    for (const [name, value] of Object.entries(cors))
      res.setHeader(name, value);
  if (req.method === "OPTIONS") {
    res.status(cors ? 204 : 403).end();
    return true;
  }
  return false;
}

const requestsPerMinute = requestsPerMinuteFromEnv(process.env);
const ipLimiter = createIpLimiter({
  limit: requestsPerMinute,
  windowMs: 60_000,
});
// Behind Railway's proxy every connection comes from the proxy: the caller's address is in X-Forwarded-For
const trustProxy =
  process.env.NODE_ENV === "production" && process.env.TRUST_PROXY !== "0";
const reportHooks = {
  log: (line: string) => console.error(line),
  report: reportError,
};

const server = new Server({
  transport: new WebSocketTransport(),
  // Shutdown is ours (see `shutdown` above): it tells the rooms with a code of their own and closes the database
  gracefullyShutdown: false,
  express: (app) => {
    app.use((_req, res, next) => {
      applySecurityHeaders(res);
      next();
    });
    // A caller who asks for too much is told to wait, in the answer the browser can read
    app.use(["/account", "/calendar", "/admin"], (req, res, next) => {
      const area = `/${req.originalUrl.split("/")[1]?.split("?")[0] ?? ""}`;
      const result = ipLimiter.check(
        `${area} ${clientIp({
          forwardedFor: req.headers["x-forwarded-for"],
          remoteAddress: req.socket.remoteAddress,
          trustProxy,
        })}`,
      );
      if (result.allowed) {
        next();
        return;
      }
      const cors = corsHeadersFor(
        req.headers.origin,
        allowedOrigins,
        process.env.NODE_ENV !== "production",
      );
      for (const [name, value] of Object.entries(cors ?? {}))
        res.setHeader(name, value);
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).json({ error: "Too many requests. Try again shortly." });
    });
    const floorPreviews = createFloorPreviews({
      authenticate: authenticateJoin,
      floors: floorDirectory,
      layouts,
      now: Date.now,
    });
    // Hosting platforms poll this to know the process is alive: public, no CORS and no sign-in
    const health = createHealthCheck({
      uptimeSeconds: () => process.uptime(),
      version: versionFromEnv(process.env, packageVersion),
      isShuttingDown: shutdown.isShuttingDown,
      ping: pool ? () => pool!.query("SELECT 1") : null,
    });
    app.get("/health", (_req, res) => {
      void health()
        .then((reply) => {
          res.setHeader("Cache-Control", "no-store");
          res.status(reply.status).json(reply.body);
        })
        .catch(() => res.status(500).json({ ok: false }));
    });

    // Closing a floor to everybody is not for just anyone: it is for the server's
    // own tools (the shared secret, see authorizeAdmin) or for somebody who signed
    // in and whose roles allow it
    // What to show somebody who has just signed in (they may not be in the company
    // yet, so this is not behind the admin API), and setting the company up
    app.use("/account", (req, res) => {
      if (handleCors(req, res)) return;
      void runGuarded(
        res,
        "/account",
        async () => {
          const path = `/account${req.url.split("?")[0]}`;
          const token = /^Bearer (\S+)$/.exec(
            req.headers.authorization ?? "",
          )?.[1];
          const body =
            req.method === "POST" ? await readJson(req, 2048) : undefined;
          // The rooms and which of them this person may enter: with sign-in off too
          const reply =
            (await handleFloorList(
              { method: req.method, path, token },
              {
                authenticate: authenticateJoin,
                floors: floorDirectory,
                groups: groupDirectory,
                rolesOf: (id) => users.rolesOf(id),
              },
            )) ??
            (await floorPreviews({ method: req.method, path, token })) ??
            (await handleContentRead(
              { method: req.method, path, token },
              {
                authenticate: authenticateJoin,
                floors: floorDirectory,
                groups: groupDirectory,
                rolesOf: (id) => users.rolesOf(id),
                content,
              },
            )) ??
            (clerkAuth
              ? await handleAccount(
                  { method: req.method, path, token, body },
                  clerkAuth,
                )
              : null);
          sendReply(res, reply, "/account", reportError);
        },
        reportHooks,
      );
    });

    // What the rooms are doing (titles and times): for anybody who is in the company
    app.use("/calendar", (req, res) => {
      if (handleCors(req, res)) return;
      void runGuarded(
        res,
        "/calendar",
        async () => {
          const token = /^Bearer (\S+)$/.exec(
            req.headers.authorization ?? "",
          )?.[1];
          // Null means sign-in is off and everybody may enter
          const who = await authenticateJoin(token);
          if (who && !who.ok) {
            res.status(401).json({ error: "Sign in first." });
            return;
          }
          const path = `/calendar${req.url.split("?")[0]}`.replace(/\/$/, "");
          const query = Object.fromEntries(
            new URL(req.url, "http://localhost").searchParams,
          );
          const reply = await handleCalendar(
            { method: req.method, path, query },
            {
              calendar,
              rooms: calendarRooms,
            },
          );
          sendReply(res, reply, "/calendar", reportError);
        },
        reportHooks,
      );
    });

    app.use("/admin", (req, res) => {
      if (handleCors(req, res)) return;
      void runGuarded(
        res,
        "/admin",
        async () => {
          const actor = await resolveActor(
            {
              header: req.headers.authorization,
              machine: authorizeAdmin({
                header: req.headers.authorization,
                token: process.env.FLOOR_ADMIN_TOKEN,
                production: process.env.NODE_ENV === "production",
                remoteAddress: req.socket.remoteAddress,
              }),
            },
            {
              authenticate: authenticateJoin,
              rolesOf: (id) => users.rolesOf(id),
            },
          );
          if (!actor) {
            res.status(403).json({ error: "Not allowed." });
            return;
          }
          const path = `/admin${req.url.split("?")[0]}`;
          // A layout is bigger than the little messages of locking a floor
          const isLayout = /\/layout(\/|$)/.test(path);
          const isContent = /^\/admin\/content(\/|$)/.test(path);
          const body = await readJson(
            req,
            isLayout
              ? MAX_LAYOUT_BODY_BYTES
              : isContent
                ? MAX_CONTENT_BODY_CHARS
                : 4096,
          );
          const query = Object.fromEntries(
            new URL(req.url, "http://localhost").searchParams,
          );
          const request = { method: req.method, path, query, body, actor };
          const reply =
            (await handleRoomsAdmin(request, {
              floors: floorDirectory,
              layouts,
              users,
              audit: recordAudit,
              onAccessChanged: recheckAccess,
              onArchived: floorArchived,
            })) ??
            (await handleGroupsAdmin(request, {
              groups: groupDirectory,
              floors: floorDirectory,
              users,
              audit: recordAudit,
              onAccessChanged: recheckAccess,
            })) ??
            (await handleLayoutAdmin(request, {
              layouts,
              locks: floorLocks,
              knownFloors: knownFloorIds,
              onPublished: refreshFloor,
              audit: recordAudit,
            })) ??
            (await handlePeopleAdmin(request, {
              users,
              knownFloors: knownFloorIds,
              floors: floorDirectory,
              groups: groupDirectory,
              onAccessChanged: recheckAccess,
              audit: recordAudit,
              bans,
            })) ??
            (await handleSettingsAdmin(request, {
              settings: companySettings,
              audit: recordAudit,
            })) ??
            (await handleCalendarAdmin(request, {
              calendar,
              rooms: calendarRooms,
              audit: recordAudit,
              allowLocalForTests: calendarOptions.allowLocalForTests,
            })) ??
            (await handleContentAdmin(request, {
              content,
              floors: floorDirectory,
              audit: recordAudit,
            })) ??
            (await handleAuditAdmin(request, { audit: auditLog })) ??
            (await handleModerationAdmin(request, {
              users,
              bans,
              rooms: floorRooms,
              audit: recordAudit,
              now: Date.now,
              knownFloors: knownFloorIds,
              floor: COMMON_FLOOR_ID,
            })) ??
            (await handleFloorAdmin(request, {
              locks: floorLocks,
              knownFloors: knownFloorIds,
              closeFloor,
              audit: recordAudit,
            }));
          sendReply(res, reply, "/admin", reportError);
        },
        reportHooks,
      );
    });
  },
});
// One room for each floor: the floor in the join options picks (and, when there is none yet, makes) it
server.define(ROOM_NAME, OfficeRoom).filterBy(["floor"]);
// Set after defining it: Colyseus would take a static onAuth next to the room's own for a mistake and say it ignores the room's
OfficeRoom.onAuth = chooseFloor;

await server.listen(port);
console.log(`Office server listening on ws://localhost:${port}`);
// Voice is the one setting that fails quietly when misconfigured, so say how it came out
console.log(voiceStatusFromEnv(process.env).summary);
// Same for sign-in: say what the keys look like (never the keys) so a typo is seen at once
console.log(authStatusFromEnv(process.env).summary);

// The office layout can be edited; say if what is in it would trip people up
const problems = findProblems(FURNITURE, PROPS);
console.log(
  problems.length === 0
    ? `Office layout: ${FURNITURE.length} pieces of furniture and ${PROPS.length} models, no problems found`
    : `Office layout has ${problems.length} problem(s):`,
);
for (const problem of problems) console.warn(`  - ${problem.message}`);
