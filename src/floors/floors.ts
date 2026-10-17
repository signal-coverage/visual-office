import type { FloorInfo } from "../../shared/floors.ts";

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

/** A room as the admins see it. */
export interface AdminFloor {
  id: string;
  name: string;
  common: boolean;
  /** Milliseconds since 1970. */
  createdAt: number;
  /** Milliseconds since 1970 when it was archived: absent for a room in use. */
  archivedAt?: number;
}

/** A template a room can be made from, as the server describes it: enough to choose one. */
export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
}

/** The rooms for the admins, and the templates a new room can start from. */
export interface AdminRooms {
  floors: AdminFloor[];
  templates: RoomTemplate[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Only what is meant for the player is kept, whatever else the server sent. */
function floorInfoOf(value: unknown): FloorInfo | null {
  if (!isRecord(value)) return null;
  const { id, name, common, canEnter } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof common !== "boolean" ||
    typeof canEnter !== "boolean"
  )
    return null;
  return { id, name, common, canEnter };
}

function adminFloorOf(value: unknown): AdminFloor | null {
  if (!isRecord(value)) return null;
  const { id, name, common, createdAt, archivedAt } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof common !== "boolean" ||
    typeof createdAt !== "number" ||
    (archivedAt !== undefined && typeof archivedAt !== "number")
  )
    return null;
  return {
    id,
    name,
    common,
    createdAt,
    ...(archivedAt === undefined ? {} : { archivedAt }),
  };
}

/** The rooms and which of them this person may enter, or null when the server would not say. */
export async function fetchFloors(
  request: Request,
  serverBase: string,
): Promise<FloorInfo[] | null> {
  try {
    const response = await request(`${serverBase}/account/floors`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.floors)) return null;
    const floors = body.floors.map(floorInfoOf);
    return floors.every((floor) => floor !== null)
      ? (floors as FloorInfo[])
      : null;
  } catch {
    return null;
  }
}

function templateOf(value: unknown): RoomTemplate | null {
  if (!isRecord(value)) return null;
  const { id, name, description } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof description !== "string"
  )
    return null;
  return { id, name, description };
}

/** Every room and the templates there are, for the admins, or null when the server would not say. */
export async function fetchRoomsAdmin(
  request: Request,
  adminBase: string,
): Promise<AdminRooms | null> {
  try {
    const response = await request(`${adminBase}/floors`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.floors)) return null;
    const floors = body.floors.map(adminFloorOf);
    if (!floors.every((floor) => floor !== null)) return null;
    // A server that does not offer templates (an older one) just has none to choose from
    const templates = Array.isArray(body.templates)
      ? body.templates.flatMap((entry) => templateOf(entry) ?? [])
      : [];
    return { floors: floors as AdminFloor[], templates };
  } catch {
    return null;
  }
}

const COULD_NOT_CREATE = "Could not make the room. Try again in a moment.";

/**
 * Makes a room from its name, and the template to start from when one is
 * chosen. The room that was made, or the words to show when it was not (and the
 * room, when it was made all the same but its template could not be applied).
 */
export async function createRoom(
  request: Request,
  adminBase: string,
  name: string,
  template?: string,
): Promise<
  | { ok: true; floor: AdminFloor }
  | { ok: false; text: string; floor?: AdminFloor }
> {
  try {
    const response = await request(`${adminBase}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...(template ? { template } : {}) }),
    });
    const body: unknown = await response.json().catch(() => null);
    const floor =
      response.ok && isRecord(body) ? adminFloorOf(body.floor) : null;
    if (floor) return { ok: true, floor };
    const made = isRecord(body) ? adminFloorOf(body.floor) : null;
    return {
      ok: false,
      text:
        isRecord(body) && typeof body.error === "string"
          ? body.error
          : COULD_NOT_CREATE,
      ...(made ? { floor: made } : {}),
    };
  } catch {
    return { ok: false, text: COULD_NOT_CREATE };
  }
}

/** Gives somebody an entry for a room, or takes it away. Whether the server did it. */
export async function setFloorAccess(
  request: Request,
  adminBase: string,
  floor: string,
  userId: string,
  allowed: boolean,
): Promise<boolean> {
  try {
    const response = await request(`${adminBase}/floors/${floor}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, allowed }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The rooms in use and the archived ones, each in the order given. */
export function splitRooms(rooms: readonly AdminFloor[]): {
  active: AdminFloor[];
  archived: AdminFloor[];
} {
  return {
    active: rooms.filter((room) => room.archivedAt === undefined),
    archived: rooms.filter((room) => room.archivedAt !== undefined),
  };
}

const COULD_NOT_CHANGE = "Could not change the room. Try again in a moment.";

/** What a call that changes a room came to: the room as it is now, or the words to show. */
async function changeRoom(
  request: Request,
  url: string,
  body: unknown,
): Promise<{ ok: true; floor: AdminFloor } | { ok: false; text: string }> {
  try {
    const response = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer: unknown = await response.json().catch(() => null);
    const floor =
      response.ok && isRecord(answer) ? adminFloorOf(answer.floor) : null;
    if (floor) return { ok: true, floor };
    return {
      ok: false,
      text:
        isRecord(answer) && typeof answer.error === "string"
          ? answer.error
          : COULD_NOT_CHANGE,
    };
  } catch {
    return { ok: false, text: COULD_NOT_CHANGE };
  }
}

/** Gives a room another name. The room as it is now, or the words to show when it was not done. */
export function renameRoom(
  request: Request,
  adminBase: string,
  id: string,
  name: string,
) {
  return changeRoom(request, `${adminBase}/floors/${id}`, { name });
}

/** Archives a room (it disappears for everybody) or brings it back. The room as it is now, or the words to show. */
export function archiveRoom(
  request: Request,
  adminBase: string,
  id: string,
  archive: boolean,
) {
  return changeRoom(
    request,
    `${adminBase}/floors/${id}/${archive ? "archive" : "unarchive"}`,
    {},
  );
}
