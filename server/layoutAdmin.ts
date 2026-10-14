import { sanitizeFurniture } from "../shared/furniture.ts";
import { findProblems } from "../shared/officeProblems.ts";
import { sanitizeModels } from "../shared/props.ts";
import { canEditFloor, identityOf } from "./actor.ts";
import { auditActor, type AuditRecorder } from "./audit.ts";
import {
  floorIdsOf,
  type AdminReply,
  type AdminRequest,
  type KnownFloors,
} from "./floorAdmin.ts";
import type { FloorLockStore } from "./floorLocks.ts";
import type { Layout, LayoutStore } from "./layoutStore.ts";

/** A layout is a few kilobytes; this leaves room for the largest the sanitizers allow. */
export const MAX_LAYOUT_BODY_BYTES = 1_000_000;

const ROUTE =
  /^\/admin\/floors\/([^/]+)\/layout(?:\/(revert|versions)(?:\/([^/]+)(?:\/(good))?)?)?$/;
const VERSION = /^[1-9]\d{0,8}$/;

export interface LayoutAdminDeps {
  layouts: LayoutStore;
  /** Who has closed which floor: publishing needs the floor closed by the publisher. */
  locks: FloorLockStore;
  /** The floors that exist. */
  knownFloors: KnownFloors;
  /** A new version of a floor's layout was stored: the rooms running it may need to know. */
  onPublished?: (floor: string, version: number) => void;
  /** Where publishing, going back and vouching are noted: who did it. */
  audit?: AuditRecorder;
}

function record(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

const bad = (error: string): AdminReply => ({ status: 400, body: { error } });
const notFound = (error: string): AdminReply => ({
  status: 404,
  body: { error },
});
const FORBIDDEN: AdminReply = {
  status: 403,
  body: {
    error: "Only the head of this floor, or an admin, may change its layout.",
  },
};
const AUTHOR_ERROR = "Say who is publishing (an author of 1 to 64 characters).";

/**
 * Nobody may be inside while a floor changes, so only whoever has closed it
 * (see the floor lock) may publish. Null when `author` holds the floor.
 */
async function lockProblem(
  deps: LayoutAdminDeps,
  floor: string,
  author: string,
): Promise<AdminReply | null> {
  const lock = await deps.locks.current(floor);
  if (lock?.holder === author) return null;
  return {
    status: 409,
    body: {
      error: lock
        ? `${lock.holder} has this floor closed. Only they can publish.`
        : "Close the floor before publishing, so nobody is inside while it changes.",
      ...(lock ? { heldBy: lock.holder } : {}),
    },
  };
}

/**
 * A layout that would trip people up (a piece inside a wall…) is only stored
 * when the author says they know (`acceptProblems: true`). Null when it may go on.
 */
function problemsRefusal(
  layout: Layout,
  body: Record<string, unknown> | null,
): { refusal: AdminReply | null; problems: string[] } {
  const problems = findProblems(layout.furniture, layout.models).map(
    (p) => p.message,
  );
  if (problems.length === 0 || body?.acceptProblems === true)
    return { refusal: null, problems };
  return {
    problems,
    refusal: {
      status: 422,
      body: {
        error: `This layout has ${problems.length} problem${problems.length === 1 ? "" : "s"}. Publish it anyway by accepting them.`,
        needsConfirmation: true,
        problems,
      },
    },
  };
}

/** Stores a layout as the next version and tells the rooms; the reply says which version it is. */
async function store(
  deps: LayoutAdminDeps,
  floor: string,
  layout: Layout,
  author: string,
) {
  const stored = await deps.layouts.publish(floor, layout, author);
  try {
    deps.onPublished?.(floor, stored.version);
  } catch (error) {
    // The version is stored whatever the rooms make of the news
    console.error("Could not tell the rooms about the new layout:", error);
  }
  return stored;
}

async function route(
  request: AdminRequest,
  deps: LayoutAdminDeps,
): Promise<AdminReply | null> {
  const match = ROUTE.exec(request.path);
  if (!match) return null;
  const [, floor, part, rest, mark] = match;
  if (!(await floorIdsOf(deps.knownFloors)).includes(floor))
    return notFound("No such floor.");
  const { layouts } = deps;
  const actor = request.actor ?? { kind: "machine" as const };
  const wrongMethod = (use: string): AdminReply => ({
    status: 405,
    body: { error: `Use ${use}.` },
  });

  // The layout the floor has now
  if (!part) {
    if (request.method === "GET") {
      const current = await layouts.current(floor);
      return current
        ? { status: 200, body: { ...current } }
        : notFound("This floor has no stored layout.");
    }
    if (request.method !== "POST") return wrongMethod("GET or POST");

    // Publishing one
    if (!canEditFloor(actor, floor)) return FORBIDDEN;
    const body = record(request.body);
    const author = identityOf(actor, request.body, "author");
    if (!author) return bad(AUTHOR_ERROR);
    if (!Array.isArray(body?.furniture) || !Array.isArray(body?.models))
      return bad("Expected a furniture list and a models list.");
    const refused = await lockProblem(deps, floor, author);
    if (refused) return refused;
    const furniture = sanitizeFurniture(body.furniture);
    const models = sanitizeModels(body.models);
    const { refusal, problems } = problemsRefusal({ furniture, models }, body);
    if (refusal) return refusal;
    const stored = await store(deps, floor, { furniture, models }, author);
    const dropped =
      body.furniture.length -
      furniture.length +
      (body.models.length - models.length);
    await deps.audit?.({
      ...auditActor(actor),
      action: "layout.publish",
      floor,
      detail: {
        version: stored.version,
        dropped,
        problems: problems.length,
      },
    });
    return {
      status: 200,
      body: { version: stored.version, dropped, problems },
    };
  }

  if (part === "versions") {
    // Vouching for a version: it changes nothing people see, so it needs no lock
    if (mark) {
      if (request.method !== "POST") return wrongMethod("POST");
      if (!canEditFloor(actor, floor)) return FORBIDDEN;
      const author = identityOf(actor, request.body, "author");
      if (!author) return bad(AUTHOR_ERROR);
      const version =
        rest !== undefined && VERSION.test(rest) ? Number(rest) : 0;
      if (!(version > 0 && (await layouts.mark(floor, version, author))))
        return notFound("No such version.");
      await deps.audit?.({
        ...auditActor(actor),
        action: "layout.mark",
        floor,
        detail: { version },
      });
      return { status: 200, body: { version, good: true } };
    }
    if (request.method !== "GET") return wrongMethod("GET");
    if (rest === undefined)
      return {
        status: 200,
        body: { versions: await layouts.history(floor) },
      };
    const found = VERSION.test(rest)
      ? await layouts.get(floor, Number(rest))
      : null;
    return found
      ? { status: 200, body: { ...found } }
      : notFound("No such version.");
  }

  // part === "revert": publish an earlier version again, so history is never rewritten
  if (rest !== undefined) return null;
  if (request.method !== "POST") return wrongMethod("POST");
  if (!canEditFloor(actor, floor)) return FORBIDDEN;
  const body = record(request.body);
  const author = identityOf(actor, request.body, "author");
  if (!author) return bad(AUTHOR_ERROR);
  const wanted = body?.version;
  const toGood = wanted === "good";
  if (
    !toGood &&
    (typeof wanted !== "number" || !Number.isInteger(wanted) || wanted < 1)
  )
    return bad(
      'Say which version to go back to (a whole number, or "good" for the last one vouched for).',
    );
  const refused = await lockProblem(deps, floor, author);
  if (refused) return refused;
  const earlier = toGood
    ? await layouts.lastGood(floor)
    : await layouts.get(floor, wanted as number);
  if (!earlier)
    return notFound(
      toGood ? "No version has been marked as good yet." : "No such version.",
    );
  const { refusal } = problemsRefusal(earlier, body);
  if (refusal) return refusal;
  const stored = await store(
    deps,
    floor,
    { furniture: earlier.furniture, models: earlier.models },
    author,
  );
  await deps.audit?.({
    ...auditActor(actor),
    action: "layout.revert",
    floor,
    detail: { version: stored.version, revertedTo: earlier.version },
  });
  return {
    status: 200,
    body: { version: stored.version, revertedTo: earlier.version },
  };
}

/**
 * The admin API for a floor's layouts: publish one, read the current one or any
 * old one, vouch for a version, and go back to an earlier one. Returns null for
 * a path that is not its own. Who may call it is decided before, by `authorizeAdmin`.
 */
export async function handleLayoutAdmin(
  request: AdminRequest,
  deps: LayoutAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Layout admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
