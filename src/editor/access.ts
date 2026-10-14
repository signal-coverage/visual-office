import type { EditorBackend } from "./backend";

/** What the game server lets a person do with the floor and the people of the building. */
export interface Access {
  /** May change the floor's layout: its head, or an admin. */
  canEdit: boolean;
  /** May name who is head of a floor: admins. */
  canManage: boolean;
}

const NOTHING: Access = { canEdit: false, canManage: false };

/**
 * What the game server lets this person do, so the game only offers what they
 * may use. Anything but a clear yes is a no: this only decides which buttons to
 * show, the server checks on every call.
 */
export async function fetchAccess(
  backend: Pick<EditorBackend, "floorBase" | "request">,
): Promise<Access> {
  try {
    const response = await backend.request(`${backend.floorBase}/access`);
    if (!response.ok) return NOTHING;
    const body = (await response.json()) as {
      canEdit?: unknown;
      canManage?: unknown;
    } | null;
    return {
      canEdit: body?.canEdit === true,
      canManage: body?.canManage === true,
    };
  } catch {
    return NOTHING;
  }
}
