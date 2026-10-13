import "./env.ts";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME, SERVER_PORT } from "../shared/constants.ts";
import { FURNITURE } from "../shared/layout.ts";
import { findProblems } from "../shared/officeProblems.ts";
import { PROPS } from "../shared/props.ts";
import type { IncomingMessage } from "node:http";
import { handleAccount } from "./account.ts";
import { resolveActor } from "./actor.ts";
import { authenticateJoin, setSignIn, setUserStore, users } from "./auth.ts";
import { authStatusFromEnv } from "./authStatus.ts";
import { clerkAuthFromEnv } from "./clerkAuth.ts";
import { createCompany } from "./company.ts";
import { allowedOriginsFromEnv, corsHeadersFor } from "./cors.ts";
import { connectDatabase, databaseUrlFromEnv } from "./db/connect.ts";
import { migrate } from "./db/migrate.ts";
import { authorizeAdmin, handleFloorAdmin } from "./floorAdmin.ts";
import {
  closeFloor,
  floorLocks,
  KNOWN_FLOORS,
  layouts,
  refreshFloor,
  setFloorLockStore,
  setLayoutStore,
} from "./floors.ts";
import { handleLayoutAdmin, MAX_LAYOUT_BODY_BYTES } from "./layoutAdmin.ts";
import { PgFloorLocks } from "./pgFloorLocks.ts";
import { handlePeopleAdmin } from "./peopleAdmin.ts";
import { PgLayoutStore } from "./pgLayoutStore.ts";
import { PgSettingsStore } from "./pgSettingsStore.ts";
import { PgUserStore } from "./pgUserStore.ts";
import { MemorySettingsStore, type SettingsStore } from "./settingsStore.ts";
import { OfficeRoom } from "./OfficeRoom.ts";
import { voiceStatusFromEnv } from "./voice.ts";

const port = Number(process.env.PORT ?? SERVER_PORT);
const allowedOrigins = allowedOriginsFromEnv(process.env);

// With a database, floor locks survive a restart; without one they live in memory
const databaseUrl = databaseUrlFromEnv(process.env);
let settings: SettingsStore = new MemorySettingsStore();
if (databaseUrl) {
  const pool = connectDatabase(databaseUrl);
  await migrate(pool);
  setFloorLockStore(new PgFloorLocks(pool));
  setLayoutStore(new PgLayoutStore(pool));
  setUserStore(new PgUserStore(pool));
  settings = new PgSettingsStore(pool);
  console.log(
    "Database connected: floor locks, layouts and people are kept in it",
  );
} else {
  console.log(
    "No DATABASE_URL: floor locks, layouts and people are kept in memory and lost on restart",
  );
}

// The company: which Clerk organization its people are in. CLERK_ORGANIZATION_ID decides
// when it is set; otherwise the first admin sets it up from the game and it is kept in the database
const company = createCompany({
  fromEnv: process.env.CLERK_ORGANIZATION_ID,
  settings,
});

// Sign-in (Clerk) is on when its keys are there; without them everybody may enter, as before
const clerkAuth = clerkAuthFromEnv(process.env, users, company);
setSignIn(clerkAuth);
if (clerkAuth) {
  const organizationId = await company.get();
  console.log(
    organizationId
      ? `Company: organization ${organizationId} (${process.env.CLERK_ORGANIZATION_ID?.trim() ? "from CLERK_ORGANIZATION_ID" : "saved from the game"})`
      : "The company is not set up yet: the first admin (ADMIN_EMAILS) sets it up from the game",
  );
}

/** The JSON a request carries, or undefined when there is none, it is not JSON, or it is too large. */
function readJson(req: IncomingMessage, maxChars: number): Promise<unknown> {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (chunk: Buffer) => {
      text += chunk.toString("utf8");
      if (text.length > maxChars) {
        req.destroy();
        resolve(undefined);
      }
    });
    req.on("end", () => {
      try {
        resolve(text ? JSON.parse(text) : undefined);
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
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

const server = new Server({
  transport: new WebSocketTransport(),
  // Hosting platforms poll this to know the process is alive
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    // Closing a floor to everybody is not for just anyone: it is for the server's
    // own tools (the shared secret, see authorizeAdmin) or for somebody who signed
    // in and whose roles allow it
    // What to show somebody who has just signed in (they may not be in the company
    // yet, so this is not behind the admin API), and setting the company up
    app.use("/account", (req, res) => {
      if (handleCors(req, res)) return;
      void (async () => {
        const path = `/account${req.url.split("?")[0]}`;
        const token = /^Bearer (\S+)$/.exec(
          req.headers.authorization ?? "",
        )?.[1];
        const body =
          req.method === "POST" ? await readJson(req, 2048) : undefined;
        const reply = clerkAuth
          ? await handleAccount(
              { method: req.method, path, token, body },
              clerkAuth,
            )
          : null;
        res
          .status(reply?.status ?? 404)
          .json(reply?.body ?? { error: "Not found." });
      })();
    });

    app.use("/admin", (req, res) => {
      if (handleCors(req, res)) return;
      void (async () => {
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
        const body = await readJson(
          req,
          isLayout ? MAX_LAYOUT_BODY_BYTES : 2048,
        );
        const request = { method: req.method, path, body, actor };
        const reply =
          (await handleLayoutAdmin(request, {
            layouts,
            locks: floorLocks,
            knownFloors: KNOWN_FLOORS,
            onPublished: refreshFloor,
          })) ??
          (await handlePeopleAdmin(request, {
            users,
            knownFloors: KNOWN_FLOORS,
          })) ??
          (await handleFloorAdmin(request, {
            locks: floorLocks,
            knownFloors: KNOWN_FLOORS,
            closeFloor,
          }));
        res
          .status(reply?.status ?? 404)
          .json(reply?.body ?? { error: "Not found." });
      })();
    });
  },
});
server.define(ROOM_NAME, OfficeRoom);

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
