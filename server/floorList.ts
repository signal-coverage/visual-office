import { floorInfoFor } from "./floorAccess.ts";
import type { AuthResult } from "./authenticate.ts";
import type { AdminReply } from "./floorAdmin.ts";
import type { FloorStore } from "./floorStore.ts";
import type { Roles } from "./userStore.ts";

export interface FloorListDeps {
  /** Who is asking, from their token. Null when sign-in is off. */
  authenticate: (token: unknown) => Promise<AuthResult | null>;
  floors: Pick<FloorStore, "list" | "floorsOf">;
  rolesOf: (userId: string) => Promise<Roles>;
}

const REFUSALS = {
  missing: { status: 401, error: "Sign in first." },
  invalid: {
    status: 401,
    error: "Your sign-in is not valid or has expired. Sign in again.",
  },
  not_member: {
    status: 403,
    error: "Your account is not part of this company.",
  },
  unavailable: {
    status: 503,
    error: "Could not check your sign-in right now. Try again in a moment.",
  },
} as const;

/**
 * What a person who is in the company is told about the rooms: which there
 * are, and which of them they may enter. Never who else may. Returns null for
 * a path that is not its own.
 */
export async function handleFloorList(
  request: { method: string; path: string; token?: string },
  deps: FloorListDeps,
): Promise<AdminReply | null> {
  if (request.path !== "/account/floors") return null;
  if (request.method !== "GET")
    return { status: 405, body: { error: "Use GET." } };
  try {
    const who = await deps.authenticate(request.token);
    if (who && !who.ok) {
      const { status, error } = REFUSALS[who.reason];
      return { status, body: { error, reason: who.reason } };
    }
    const floors = await deps.floors.list();
    // With sign-in off there is nobody to identify: everybody may enter everywhere
    const roles = who ? await deps.rolesOf(who.user.id) : null;
    const granted = who ? await deps.floors.floorsOf(who.user.id) : [];
    return {
      status: 200,
      body: { floors: floorInfoFor(roles, floors, granted) },
    };
  } catch (error) {
    console.error("The room list could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
