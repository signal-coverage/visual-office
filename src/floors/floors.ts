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
  const { id, name, common, createdAt } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof common !== "boolean" ||
    typeof createdAt !== "number"
  )
    return null;
  return { id, name, common, createdAt };
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

/** Every room, for the admins, or null when the server would not say. */
export async function fetchRoomsAdmin(
  request: Request,
  adminBase: string,
): Promise<AdminFloor[] | null> {
  try {
    const response = await request(`${adminBase}/floors`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.floors)) return null;
    const floors = body.floors.map(adminFloorOf);
    return floors.every((floor) => floor !== null)
      ? (floors as AdminFloor[])
      : null;
  } catch {
    return null;
  }
}

const COULD_NOT_CREATE = "Could not make the room. Try again in a moment.";

/** Makes a room from its name. The room that was made, or the words to show when it was not. */
export async function createRoom(
  request: Request,
  adminBase: string,
  name: string,
): Promise<{ ok: true; floor: AdminFloor } | { ok: false; text: string }> {
  try {
    const response = await request(`${adminBase}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body: unknown = await response.json().catch(() => null);
    const floor =
      response.ok && isRecord(body) ? adminFloorOf(body.floor) : null;
    if (floor) return { ok: true, floor };
    return {
      ok: false,
      text:
        isRecord(body) && typeof body.error === "string"
          ? body.error
          : COULD_NOT_CREATE,
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
