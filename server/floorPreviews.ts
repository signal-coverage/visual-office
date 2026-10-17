import { previewOf, type FloorPreview } from "../shared/floorPreview.ts";
import type { Layout } from "../shared/layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../shared/officeData.ts";
import type { AuthResult } from "./authenticate.ts";
import type { AdminReply } from "./floorAdmin.ts";
import { isArchived } from "./floorArchive.ts";
import type { FloorStore } from "./floorStore.ts";
import type { LayoutStore } from "./layoutStore.ts";

/** How long the plans are kept before they are made again. */
export const PREVIEWS_TTL_MS = 15_000;

export interface FloorPreviewsDeps {
  /** Who is asking, from their token. Null when sign-in is off. */
  authenticate: (token: unknown) => Promise<AuthResult | null>;
  floors: Pick<FloorStore, "list">;
  layouts: Pick<LayoutStore, "current">;
  now: () => number;
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

const DEFAULT_LAYOUT: Layout = {
  furniture: OFFICE_FURNITURE,
  models: OFFICE_MODELS,
};

/**
 * The plan of every room, for anybody who is in the company: also of the rooms
 * they may not enter (they only see the silhouette). Made from each room's
 * published layout, or the default, and kept for a few seconds for everybody.
 * Returns null for a path that is not its own.
 */
export function createFloorPreviews(deps: FloorPreviewsDeps) {
  let cached: { at: number; previews: FloorPreview[] } | null = null;

  const previews = async (): Promise<FloorPreview[]> => {
    if (cached && deps.now() - cached.at < PREVIEWS_TTL_MS)
      return cached.previews;
    const floors = await deps.floors.list();
    const made = await Promise.all(
      floors.map(async (floor) => {
        const stored = await deps.layouts.current(floor.id);
        return previewOf(floor.id, stored ?? DEFAULT_LAYOUT);
      }),
    );
    cached = { at: deps.now(), previews: made };
    return made;
  };

  return async function handleFloorPreviews(request: {
    method: string;
    path: string;
    token?: string;
  }): Promise<AdminReply | null> {
    if (request.path !== "/account/floors/previews") return null;
    if (request.method !== "GET")
      return { status: 405, body: { error: "Use GET." } };
    try {
      const who = await deps.authenticate(request.token);
      if (who && !who.ok) {
        const { status, error } = REFUSALS[who.reason];
        return { status, body: { error, reason: who.reason } };
      }
      // Archived rooms are hidden at once, though their plans stay cached for when they come back
      const active = new Set(
        (await deps.floors.list())
          .filter((floor) => !isArchived(floor))
          .map((floor) => floor.id),
      );
      return {
        status: 200,
        body: {
          previews: (await previews()).filter((plan) => active.has(plan.id)),
        },
      };
    } catch (error) {
      console.error("The room plans could not reach the database", error);
      return {
        status: 503,
        body: { error: "The database cannot be reached right now." },
      };
    }
  };
}
