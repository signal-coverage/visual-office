import {
  isContentKind,
  validateContentFields,
  type ContentErrors,
  type ContentFields,
  type ContentItem,
} from "../shared/content.ts";
import type { Actor } from "./actor.ts";
import { auditActor, type AuditRecorder } from "./audit.ts";
import { mayEditContent } from "./contentAccess.ts";
import type { ContentStore } from "./contentStore.ts";
import type { AdminReply, AdminRequest } from "./floorAdmin.ts";
import { isArchived } from "./floorArchive.ts";
import type { FloorStore } from "./floorStore.ts";

const CONTENT = "/admin/content";
const ONE = /^\/admin\/content\/([A-Za-z0-9_-]{1,64})(\/delete)?$/;

/** A book can hold 4000 characters and a line break takes two in JSON: the body of a call is bigger than the usual little messages. */
export const MAX_CONTENT_BODY_CHARS = 24_000;

export interface ContentAdminDeps {
  content: ContentStore;
  floors: Pick<FloorStore, "get" | "list">;
  /** Where adding, changing and removing are noted: who, where, which kind and its title (never the text). */
  audit?: AuditRecorder;
}

const bad = (errors: ContentErrors): AdminReply => ({
  status: 400,
  body: { error: Object.values(errors).join(" "), errors },
});
const sayBad = (error: string): AdminReply => ({
  status: 400,
  body: { error },
});

const NOT_ALLOWED: AdminReply = {
  status: 403,
  body: {
    error:
      "Only admins, and the head of a floor on their own floor, may change what its computers and shelves show.",
  },
};
const NO_FLOOR: AdminReply = { status: 404, body: { error: "No such floor." } };
const NO_ITEM: AdminReply = {
  status: 404,
  body: { error: "No such book or announcement." },
};

const fieldsOf = (item: ContentItem): ContentFields => ({
  title: item.title,
  author: item.author,
  body: item.body,
  link: item.link,
  pinned: item.pinned,
});

const sameFields = (a: ContentFields, b: ContentFields) =>
  a.title === b.title &&
  a.author === b.author &&
  a.body === b.body &&
  a.link === b.link &&
  a.pinned === b.pinned;

function record(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

async function route(
  request: AdminRequest,
  deps: ContentAdminDeps,
): Promise<AdminReply | null> {
  const one = ONE.exec(request.path);
  if (request.path !== CONTENT && !one) return null;
  // `/delete` is only for POST; `DELETE` is for the id itself
  if (one?.[2] && request.method !== "POST") {
    return request.actor
      ? { status: 405, body: { error: "Use POST." } }
      : { status: 401, body: { error: "Sign in first." } };
  }

  const { actor } = request;
  if (!actor) return { status: 401, body: { error: "Sign in first." } };

  if (!one) return list(request, actor, deps);
  const id = one[1];

  if (request.method === "DELETE" || (one[2] && request.method === "POST"))
    return remove(id, actor, deps);
  if (request.method !== "POST")
    return { status: 405, body: { error: "Use POST." } };
  return change(id, request.body, actor, deps);
}

/** Without a floor: which floors this caller may edit. With one: everything on it, text included. */
async function list(
  request: AdminRequest,
  actor: Actor,
  deps: ContentAdminDeps,
): Promise<AdminReply> {
  if (request.method === "POST") return create(request.body, actor, deps);
  if (request.method !== "GET")
    return { status: 405, body: { error: "Use GET or POST." } };

  const floorId = request.query?.floor;
  if (floorId === undefined) {
    const floors = (await deps.floors.list())
      .filter((floor) => !isArchived(floor))
      .filter((floor) => mayEditContent(actor, floor.id))
      .map(({ id, name }) => ({ id, name }));
    if (floors.length === 0 && actor.kind === "user") return NOT_ALLOWED;
    return { status: 200, body: { floors } };
  }

  const floor = await deps.floors.get(floorId);
  if (!floor) return NO_FLOOR;
  if (!mayEditContent(actor, floor.id)) return NOT_ALLOWED;
  const [books, announcements] = await Promise.all([
    deps.content.list(floor.id, "book"),
    deps.content.list(floor.id, "announcement"),
  ]);
  return {
    status: 200,
    body: { floor: { id: floor.id, name: floor.name }, books, announcements },
  };
}

async function create(
  rawBody: unknown,
  actor: Actor,
  deps: ContentAdminDeps,
): Promise<AdminReply> {
  const body = record(rawBody);
  if (!body) return sayBad("Send the book or announcement as an object.");
  const { floor: floorId, kind, ...rest } = body;
  if (typeof floorId !== "string" || floorId === "")
    return sayBad("Say which floor it is for (floor).");
  if (!isContentKind(kind))
    return sayBad('Say what it is (kind: "book" or "announcement").');

  const floor = await deps.floors.get(floorId);
  if (!floor) return NO_FLOOR;
  if (!mayEditContent(actor, floor.id)) return NOT_ALLOWED;

  const checked = validateContentFields(kind, rest);
  if (!checked.ok) return bad(checked.errors);

  const made = await deps.content.create(floor.id, kind, checked.fields);
  if (!made.ok)
    return {
      status: 409,
      body: {
        error: `This floor already has the most ${kind === "book" ? "books" : "announcements"} it can have. Remove one first.`,
      },
    };
  await deps.audit?.({
    ...auditActor(actor),
    action: "content.create",
    floor: floor.id,
    detail: { kind, title: made.item.title },
  });
  return { status: 201, body: { item: made.item } };
}

async function change(
  id: string,
  rawBody: unknown,
  actor: Actor,
  deps: ContentAdminDeps,
): Promise<AdminReply> {
  const before = await deps.content.get(id);
  if (!before) return NO_ITEM;
  if (!mayEditContent(actor, before.floor)) return NOT_ALLOWED;

  const checked = validateContentFields(before.kind, rawBody, fieldsOf(before));
  if (!checked.ok) return bad(checked.errors);
  // Nothing to change: the item keeps its time, so the announcements do not move
  if (sameFields(checked.fields, fieldsOf(before)))
    return { status: 200, body: { item: before } };

  const item = await deps.content.update(id, checked.fields);
  if (!item) return NO_ITEM;
  await deps.audit?.({
    ...auditActor(actor),
    action: "content.update",
    floor: item.floor,
    detail: { kind: item.kind, title: item.title },
  });
  return { status: 200, body: { item } };
}

async function remove(
  id: string,
  actor: Actor,
  deps: ContentAdminDeps,
): Promise<AdminReply> {
  const item = await deps.content.get(id);
  if (!item) return NO_ITEM;
  if (!mayEditContent(actor, item.floor)) return NOT_ALLOWED;
  const gone = await deps.content.remove(id);
  if (!gone) return NO_ITEM;
  await deps.audit?.({
    ...auditActor(actor),
    action: "content.delete",
    floor: gone.floor,
    detail: { kind: gone.kind, title: gone.title },
  });
  return { status: 200, body: { deleted: id } };
}

/**
 * The admin API for what the computers and the bookshelves of each floor show:
 * list what can be edited, add, change and remove books and announcements.
 * Returns null for a path that is not its own. Who may edit a floor's content is
 * decided in one place, `mayEditContent`; the server checks it on every call.
 */
export async function handleContentAdmin(
  request: AdminRequest,
  deps: ContentAdminDeps,
): Promise<AdminReply | null> {
  try {
    return await route(request, deps);
  } catch (error) {
    console.error("Content admin could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
