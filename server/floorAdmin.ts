import { timingSafeEqual } from "node:crypto";
import { canEditFloor, identityOf, type Actor } from "./actor.ts";
import { auditActor, type AuditRecorder } from "./audit.ts";
import { LOCK_TTL_MS, type FloorLockStore } from "./floorLocks.ts";

/** A call to the admin API, and who is making it (the server's own tools unless said otherwise). */
export interface AdminRequest {
  method: string;
  path: string;
  /** The query string, as `?limit=10` gives `{limit: "10"}`. */
  query?: Record<string, string>;
  body?: unknown;
  actor?: Actor;
}

/**
 * The floors that exist: a list that does not change, or a way to ask each
 * time, for floors that are made while the server runs.
 */
export type KnownFloors =
  readonly string[] | (() => Promise<readonly string[]>);

/** The ids of the floors that exist now. */
export async function floorIdsOf(
  known: KnownFloors,
): Promise<readonly string[]> {
  return typeof known === "function" ? await known() : known;
}

export interface AdminReply {
  status: number;
  body: Record<string, unknown>;
}

const DEFAULT_GRACE_SECONDS = 10;
const MAX_GRACE_SECONDS = 120;
/** How often an editor should say it is still there: a third of how long a lock lasts. */
export const HEARTBEAT_MS = Math.floor(LOCK_TTL_MS / 3);

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Whether a request may use the admin API, which can close a floor to everybody.
 * With a token configured it has to bring it, from anywhere. Without one it is
 * off in production, and in development it answers only to this machine.
 */
export function authorizeAdmin(request: {
  header: string | undefined;
  token: string | undefined;
  production: boolean;
  remoteAddress: string | undefined;
}): boolean {
  if (request.token) {
    const expected = Buffer.from(`Bearer ${request.token}`);
    const given = Buffer.from(request.header ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
  if (request.production) return false;
  return (
    request.remoteAddress !== undefined && LOOPBACK.has(request.remoteAddress)
  );
}

export interface FloorAdminDeps {
  locks: FloorLockStore;
  /** The floors that exist. */
  knownFloors: KnownFloors;
  /**
   * Tells the people in a floor it is closing in `graceSeconds`, and sends them
   * out when the time is up. Returns how many were told.
   */
  closeFloor: (floor: string, graceSeconds: number) => number;
  /** Where closing and opening a floor are noted: who did it. */
  audit?: AuditRecorder;
}

const ROUTE = /^\/admin\/floors\/([^/]+)(?:\/(lock|heartbeat|unlock|access))?$/;

function graceOf(body: unknown): number {
  if (typeof body !== "object" || body === null) return DEFAULT_GRACE_SECONDS;
  const { graceSeconds } = body as { graceSeconds?: unknown };
  if (typeof graceSeconds !== "number" || !Number.isFinite(graceSeconds))
    return DEFAULT_GRACE_SECONDS;
  return Math.min(MAX_GRACE_SECONDS, Math.max(0, Math.round(graceSeconds)));
}

/**
 * The admin API for floors: who is editing one, closing it to everybody while
 * they do, and opening it again. Returns null for a path that is not its own.
 * Who may call it is decided before, by `authorizeAdmin`.
 */
async function route(
  request: AdminRequest,
  deps: FloorAdminDeps,
): Promise<AdminReply | null> {
  if (!request.path.startsWith("/admin/floors/")) return null;
  const match = ROUTE.exec(request.path);
  if (!match || !(await floorIdsOf(deps.knownFloors)).includes(match[1]))
    return { status: 404, body: { error: "No such floor." } };
  const [, floor, action] = match;

  // Whether the caller may edit this floor: what decides if the game offers them the editor
  if (action === "access") {
    if (request.method !== "GET")
      return { status: 405, body: { error: "Use GET." } };
    const actor = request.actor ?? { kind: "machine" as const };
    return {
      status: 200,
      body: {
        floor,
        canEdit: canEditFloor(actor, floor),
        // Naming heads is for admins: what decides whether the game offers that screen
        canManage: actor.kind === "machine" || actor.roles.admin,
      },
    };
  }

  if (!action) {
    if (request.method !== "GET")
      return { status: 405, body: { error: "Use GET." } };
    const lock = await deps.locks.current(floor);
    return {
      status: 200,
      body: lock
        ? {
            floor,
            locked: true,
            holder: lock.holder,
            since: lock.since,
            expiresAt: lock.expiresAt,
          }
        : { floor, locked: false },
    };
  }
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };

  const actor = request.actor ?? { kind: "machine" as const };
  if (!canEditFloor(actor, floor))
    return {
      status: 403,
      body: {
        error:
          "Only the head of this floor, or an admin, may close it to edit.",
      },
    };

  const holder = identityOf(actor, request.body, "holder");
  if (!holder)
    return {
      status: 400,
      body: { error: "Say who is editing (a holder of 1 to 64 characters)." },
    };

  if (action === "lock") {
    const before = await deps.locks.current(floor);
    const result = await deps.locks.acquire(floor, holder);
    if (!result.ok)
      return {
        status: 409,
        body: {
          error: `${result.lock.holder} is already editing this floor.`,
          heldBy: result.lock.holder,
          since: result.lock.since,
        },
      };
    // Carrying on an editing session does not send everybody away a second time
    const continued = before?.holder === holder;
    const graceSeconds = graceOf(request.body);
    const told = continued ? 0 : deps.closeFloor(floor, graceSeconds);
    if (!continued)
      await deps.audit?.({
        ...auditActor(actor),
        action: "floor.lock",
        floor,
        detail: { graceSeconds, told },
      });
    return {
      status: 200,
      body: {
        locked: true,
        holder,
        since: result.lock.since,
        expiresAt: result.lock.expiresAt,
        heartbeatMs: HEARTBEAT_MS,
        told,
      },
    };
  }

  if (action === "heartbeat") {
    return (await deps.locks.renew(floor, holder))
      ? { status: 200, body: { renewed: true, heartbeatMs: HEARTBEAT_MS } }
      : { status: 404, body: { error: "You no longer hold this floor." } };
  }

  if (!(await deps.locks.release(floor, holder)))
    return {
      status: 404,
      body: { released: false, error: "You do not hold this floor." },
    };
  await deps.audit?.({
    ...auditActor(actor),
    action: "floor.unlock",
    floor,
  });
  return { status: 200, body: { released: true } };
}

/** The admin API. When the database cannot be reached it says so (503) rather than guessing. */
export async function handleFloorAdmin(
  request: AdminRequest,
  deps: FloorAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Floor admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
