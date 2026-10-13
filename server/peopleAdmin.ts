import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import type { UserStore } from "./userStore.ts";

const MAX_USER_ID_LENGTH = 128;
const PEOPLE = "/admin/people";
const HEADS = /^\/admin\/floors\/([^/]+)\/heads$/;

export interface PeopleAdminDeps {
  users: UserStore;
  /** The floors that exist. */
  knownFloors: readonly string[];
}

const FORBIDDEN: AdminReply = {
  status: 403,
  body: { error: "Only admins may manage who is head of a floor." },
};

async function route(
  request: AdminRequest,
  deps: PeopleAdminDeps,
): Promise<AdminReply | null> {
  const isPeople = request.path === PEOPLE;
  const heads = HEADS.exec(request.path);
  if (!isPeople && !heads) return null;

  // Who is head of what is for admins (and the server's own tools): heads cannot name heads
  const actor = request.actor ?? { kind: "machine" as const };
  if (actor.kind === "user" && !actor.roles.admin) return FORBIDDEN;

  if (isPeople) {
    if (request.method !== "GET")
      return { status: 405, body: { error: "Use GET." } };
    return {
      status: 200,
      body: {
        floors: [...deps.knownFloors],
        people: (await deps.users.list()).map((person) => ({
          id: person.id,
          name: person.name,
          email: person.email,
          isAdmin: person.isAdmin,
          headOf: person.headOf,
        })),
      },
    };
  }

  const floor = heads![1];
  if (!deps.knownFloors.includes(floor))
    return { status: 404, body: { error: "No such floor." } };
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };

  const body =
    typeof request.body === "object" &&
    request.body !== null &&
    !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  const { userId, head } = body;
  if (
    typeof userId !== "string" ||
    userId.length < 1 ||
    userId.length > MAX_USER_ID_LENGTH ||
    typeof head !== "boolean"
  )
    return {
      status: 400,
      body: {
        error: "Say who (userId) and whether they are head (true or false).",
      },
    };

  if (head) {
    if (!(await deps.users.addHead(floor, userId)))
      return {
        status: 404,
        body: { error: "Nobody with that id has signed in." },
      };
  } else {
    // Whether they were head or not, afterwards they are not
    await deps.users.removeHead(floor, userId);
  }
  return { status: 200, body: { floor, userId, head } };
}

/**
 * The admin API for people: who has signed in, and who is head of which floor.
 * Returns null for a path that is not its own. Who may call it is decided
 * here too: admins and the server's own tools, nobody else.
 */
export async function handlePeopleAdmin(
  request: AdminRequest,
  deps: PeopleAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("People admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
