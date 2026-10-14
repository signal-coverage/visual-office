import {
  announcementOf,
  bookOf,
  bookSummaryOf,
  orderAnnouncements,
} from "../shared/content.ts";
import type { AuthResult } from "./authenticate.ts";
import type { ContentStore } from "./contentStore.ts";
import { mayEnterFloor } from "./floorAccess.ts";
import type { AdminReply } from "./floorAdmin.ts";
import type { FloorStore } from "./floorStore.ts";
import type { Roles } from "./userStore.ts";

export interface ContentReadDeps {
  /** Who is asking, from their token. Null when sign-in is off. */
  authenticate: (token: unknown) => Promise<AuthResult | null>;
  floors: Pick<FloorStore, "get" | "floorsOf">;
  rolesOf: (userId: string) => Promise<Roles>;
  content: Pick<ContentStore, "list" | "get">;
}

const PATH = /^\/account\/floors\/([^/]+)\/content(?:\/([^/]+))?$/;

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
 * What the computers and the bookshelves of a floor show, for the people who may
 * enter that floor: the list of books (no text, so it stays small) and the
 * announcements, and the text of one book on its own. Returns null for a path
 * that is not its own.
 */
export async function handleContentRead(
  request: { method: string; path: string; token?: string },
  deps: ContentReadDeps,
): Promise<AdminReply | null> {
  const match = PATH.exec(request.path);
  if (!match) return null;
  if (request.method !== "GET")
    return { status: 405, body: { error: "Use GET." } };
  const [, floorId, bookId] = match;

  try {
    const who = await deps.authenticate(request.token);
    if (who && !who.ok) {
      const { status, error } = REFUSALS[who.reason];
      return { status, body: { error, reason: who.reason } };
    }
    const floor = await deps.floors.get(floorId);
    if (!floor) return { status: 404, body: { error: "No such floor." } };

    // With sign-in off there is nobody to identify: everybody may enter everywhere
    const roles = who ? await deps.rolesOf(who.user.id) : null;
    const granted = who
      ? (await deps.floors.floorsOf(who.user.id)).includes(floor.id)
      : false;
    if (!mayEnterFloor(roles, floor, granted))
      return {
        status: 403,
        body: { error: "You may not enter this room, so you cannot read it." },
      };

    if (bookId !== undefined) {
      const item = await deps.content.get(bookId);
      if (!item || item.floor !== floor.id || item.kind !== "book")
        return { status: 404, body: { error: "No such book." } };
      return { status: 200, body: { book: bookOf(item) } };
    }

    const [books, announcements] = await Promise.all([
      deps.content.list(floor.id, "book"),
      deps.content.list(floor.id, "announcement"),
    ]);
    return {
      status: 200,
      body: {
        books: books.map(bookSummaryOf),
        announcements: orderAnnouncements(announcements.map(announcementOf)),
      },
    };
  } catch (error) {
    console.error("The room's content could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
