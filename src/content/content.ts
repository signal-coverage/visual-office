import {
  linkProblem,
  type Announcement,
  type Book,
  type BookSummary,
  type ContentFields,
  type ContentItem,
  type ContentKind,
  type FloorContent,
} from "../../shared/content.ts";
import type { Request } from "../calendar/calendar";
import {
  CACHE_TTL_MS,
  COULD_NOT_LOAD,
  COULD_NOT_SAVE,
  OFFLINE,
} from "./consts";

/** What a call to the server gave: what was asked for, or the words to show. */
export type Outcome<T> = ({ ok: true } & T) | { ok: false; text: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A link is only kept when it is one that may be opened: https, no credentials. */
const linkOf = (value: unknown): { link?: string } =>
  typeof value === "string" && linkProblem(value) === null
    ? { link: value }
    : {};

function bookSummaryOf(value: unknown): BookSummary | null {
  if (!isRecord(value)) return null;
  const { id, title, author } = value;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof author !== "string"
  )
    return null;
  return { id, title, author, ...linkOf(value.link) };
}

function bookOf(value: unknown): Book | null {
  const summary = bookSummaryOf(value);
  if (!summary || !isRecord(value) || typeof value.body !== "string")
    return null;
  return { ...summary, body: value.body };
}

function announcementOf(value: unknown): Announcement | null {
  if (!isRecord(value)) return null;
  const { id, title, body, pinned, updatedAt } = value;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    typeof pinned !== "boolean" ||
    typeof updatedAt !== "number"
  )
    return null;
  return { id, title, body, pinned, updatedAt, ...linkOf(value.link) };
}

function itemOf(value: unknown): ContentItem | null {
  if (!isRecord(value)) return null;
  const { id, floor, kind, title, author, body, link, pinned } = value;
  const { position, createdAt, updatedAt } = value;
  if (
    typeof id !== "string" ||
    typeof floor !== "string" ||
    (kind !== "book" && kind !== "announcement") ||
    typeof title !== "string" ||
    typeof author !== "string" ||
    typeof body !== "string" ||
    (link !== null && typeof link !== "string") ||
    typeof pinned !== "boolean" ||
    typeof position !== "number" ||
    typeof createdAt !== "number" ||
    typeof updatedAt !== "number"
  )
    return null;
  return {
    id,
    floor,
    kind,
    title,
    author,
    body,
    link,
    pinned,
    position,
    createdAt,
    updatedAt,
  };
}

function listOf<T>(value: unknown, parse: (item: unknown) => T | null) {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parse);
  return parsed.every((item) => item !== null) ? (parsed as T[]) : null;
}

/** Why the server said no, in its words when it gave them (and it is not a failure of its own). */
async function refusal(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      response.status < 500 &&
      isRecord(body) &&
      typeof body.error === "string"
    )
      return body.error;
  } catch {
    // Not JSON: nothing more to say than that it failed
  }
  return fallback;
}

/** A GET whose answer is checked by `parse`; anything else is the words to show. */
async function read<T>(
  request: Request,
  url: string,
  parse: (body: Record<string, unknown>) => T | null,
): Promise<Outcome<T>> {
  try {
    const response = await request(url);
    if (!response.ok)
      return { ok: false, text: await refusal(response, COULD_NOT_LOAD) };
    const body: unknown = await response.json();
    const parsed = isRecord(body) ? parse(body) : null;
    return parsed
      ? ({ ok: true, ...parsed } as Outcome<T>)
      : { ok: false, text: COULD_NOT_LOAD };
  } catch {
    return { ok: false, text: OFFLINE };
  }
}

/** The books (no text) and the announcements of a floor. */
export function fetchFloorContent(
  request: Request,
  serverBase: string,
  floor: string,
): Promise<Outcome<{ content: FloorContent }>> {
  return read(
    request,
    `${serverBase}/account/floors/${encodeURIComponent(floor)}/content`,
    (body) => {
      const books = listOf(body.books, bookSummaryOf);
      const announcements = listOf(body.announcements, announcementOf);
      return books && announcements
        ? { content: { books, announcements } }
        : null;
    },
  );
}

/** The text of one book. */
export function fetchBook(
  request: Request,
  serverBase: string,
  floor: string,
  id: string,
): Promise<Outcome<{ book: Book }>> {
  return read(
    request,
    `${serverBase}/account/floors/${encodeURIComponent(floor)}/content/${encodeURIComponent(id)}`,
    (body) => {
      const book = bookOf(body.book);
      return book ? { book } : null;
    },
  );
}

interface Entry<T> {
  at: number;
  promise: Promise<Outcome<T>>;
}

/**
 * What was read is kept for a few seconds, so opening the same computer or shelf
 * again is instant. Only what worked is kept; two who ask together share the call.
 */
export function createContentCache(
  now: () => number = Date.now,
  ttlMs: number = CACHE_TTL_MS,
) {
  const floors = new Map<string, Entry<{ content: FloorContent }>>();
  const books = new Map<string, Entry<{ book: Book }>>();

  function remember<T>(
    store: Map<string, Entry<T>>,
    key: string,
    load: () => Promise<Outcome<T>>,
  ): Promise<Outcome<T>> {
    const hit = store.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.promise;
    const entry: Entry<T> = {
      at: now(),
      promise: load().then((result) => {
        if (!result.ok && store.get(key) === entry) store.delete(key);
        return result;
      }),
    };
    store.set(key, entry);
    return entry.promise;
  }

  return {
    floorContent: (request: Request, serverBase: string, floor: string) =>
      remember(floors, floor, () =>
        fetchFloorContent(request, serverBase, floor),
      ),
    book: (request: Request, serverBase: string, floor: string, id: string) =>
      remember(books, `${floor}\n${id}`, () =>
        fetchBook(request, serverBase, floor, id),
      ),
    /** Forget what was read, of one floor or of all: something was changed. */
    clear(floor?: string) {
      if (floor === undefined) {
        floors.clear();
        books.clear();
        return;
      }
      floors.delete(floor);
      for (const key of books.keys())
        if (key.startsWith(`${floor}\n`)) books.delete(key);
    },
  };
}

/** The reading cache of the whole page. */
export const contentCache = createContentCache();

/** The floors this person may edit the content of. */
export function fetchEditableFloors(
  request: Request,
  adminBase: string,
): Promise<Outcome<{ floors: Array<{ id: string; name: string }> }>> {
  return read(request, `${adminBase}/content`, (body) => {
    const floors = listOf(body.floors, (value) =>
      isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.name === "string"
        ? { id: value.id, name: value.name }
        : null,
    );
    return floors ? { floors } : null;
  });
}

/** Everything on a floor, with the text, for the one who edits it. */
export function fetchAdminContent(
  request: Request,
  adminBase: string,
  floor: string,
): Promise<Outcome<{ books: ContentItem[]; announcements: ContentItem[] }>> {
  return read(
    request,
    `${adminBase}/content?floor=${encodeURIComponent(floor)}`,
    (body) => {
      const books = listOf(body.books, itemOf);
      const announcements = listOf(body.announcements, itemOf);
      return books && announcements ? { books, announcements } : null;
    },
  );
}

export interface SaveInput {
  /** Set to change an item; without it a new one is made. */
  id?: string;
  floor: string;
  kind: ContentKind;
  fields: ContentFields;
}

/** Makes or changes a book or an announcement. The item as the server kept it, or why not. */
export async function saveContent(
  request: Request,
  adminBase: string,
  { id, floor, kind, fields }: SaveInput,
): Promise<Outcome<{ item: ContentItem }>> {
  try {
    const response = await request(
      id
        ? `${adminBase}/content/${encodeURIComponent(id)}`
        : `${adminBase}/content`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? fields : { floor, kind, ...fields }),
      },
    );
    if (!response.ok)
      return { ok: false, text: await refusal(response, COULD_NOT_SAVE) };
    const body: unknown = await response.json();
    const item = isRecord(body) ? itemOf(body.item) : null;
    return item ? { ok: true, item } : { ok: false, text: COULD_NOT_SAVE };
  } catch {
    return { ok: false, text: OFFLINE };
  }
}

/** Removes a book or an announcement. */
export async function deleteContent(
  request: Request,
  adminBase: string,
  id: string,
): Promise<Outcome<unknown>> {
  try {
    const response = await request(
      `${adminBase}/content/${encodeURIComponent(id)}/delete`,
      { method: "POST" },
    );
    return response.ok
      ? { ok: true }
      : { ok: false, text: await refusal(response, COULD_NOT_SAVE) };
  } catch {
    return { ok: false, text: OFFLINE };
  }
}
