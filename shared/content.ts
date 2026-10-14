/**
 * What the computers and the bookshelves of a floor show: announcements and
 * books, set up by the admins (and the head of the floor). Everything here is
 * plain text: nothing is ever read as HTML or markdown.
 */

export const CONTENT_KINDS = ["book", "announcement"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_LIMITS = {
  titleMax: 80,
  authorMax: 60,
  bookBodyMax: 4000,
  announcementBodyMax: 1000,
  linkMax: 300,
  /** How many books, and how many announcements, a floor may have. */
  perKind: 50,
} as const;

export const isContentKind = (value: unknown): value is ContentKind =>
  typeof value === "string" &&
  (CONTENT_KINDS as readonly string[]).includes(value);

/** The words of the item that people write. */
export interface ContentFields {
  title: string;
  author: string;
  body: string;
  link: string | null;
  pinned: boolean;
}

/** One book or announcement, as the server keeps it. */
export interface ContentItem extends ContentFields {
  id: string;
  floor: string;
  kind: ContentKind;
  position: number;
  /** Milliseconds since 1970. */
  createdAt: number;
  updatedAt: number;
}

/** A book as the list shows it: no text, so the list stays small. */
export interface BookSummary {
  id: string;
  title: string;
  author: string;
  link?: string;
}

/** A book to read. */
export interface Book extends BookSummary {
  body: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link?: string;
  pinned: boolean;
  updatedAt: number;
}

export interface FloorContent {
  books: BookSummary[];
  announcements: Announcement[];
}

export function bookSummaryOf(item: ContentItem): BookSummary {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    ...(item.link ? { link: item.link } : {}),
  };
}

export function bookOf(item: ContentItem): Book {
  return { ...bookSummaryOf(item), body: item.body };
}

export function announcementOf(item: ContentItem): Announcement {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    ...(item.link ? { link: item.link } : {}),
    pinned: item.pinned,
    updatedAt: item.updatedAt,
  };
}

/** The pinned announcements first, then the most recently changed. */
export function orderAnnouncements(
  list: readonly Announcement[],
): Announcement[] {
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt - a.updatedAt ||
      a.id.localeCompare(b.id),
  );
}

// Format characters hide or reverse what is written (zero-width, bidirectional): never kept
const HIDDEN = /\p{Cf}/gu;
const SPACING = /\s/gu;
const CONTROL = /\p{Cc}/gu;
const NOT_LINE_BREAK_CONTROL = /[^\P{Cc}\n]/gu;
const LINK_FORBIDDEN = /[\p{Cc}\p{Cf}\s]/u;

/** One line of text: control characters gone, white space folded into single spaces. */
export function sanitizeLine(value: string): string {
  return value
    .replace(HIDDEN, "")
    .replace(SPACING, " ")
    .replace(CONTROL, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Text with line breaks (always `\n`): control characters gone. Never changed otherwise. */
export function sanitizeText(value: string): string {
  return value
    .replace(HIDDEN, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(NOT_LINE_BREAK_CONTROL, "")
    .trim();
}

export const LINK_PROBLEM = {
  invalid: "Use a full address that starts with https://",
  scheme: "Only https:// addresses are allowed.",
  credentials: "The address must not contain a user name or password.",
  long: `The address is too long (up to ${CONTENT_LIMITS.linkMax} characters).`,
} as const;

/** The reason an address may not be linked, or null when it may. Only https, no credentials. */
export function linkProblem(value: string): string | null {
  if (LINK_FORBIDDEN.test(value)) return LINK_PROBLEM.invalid;
  if (value.length > CONTENT_LIMITS.linkMax) return LINK_PROBLEM.long;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return LINK_PROBLEM.invalid;
  }
  if (url.protocol !== "https:") return LINK_PROBLEM.scheme;
  if (url.username || url.password) return LINK_PROBLEM.credentials;
  if (!url.hostname) return LINK_PROBLEM.invalid;
  if (url.href.length > CONTENT_LIMITS.linkMax) return LINK_PROBLEM.long;
  return null;
}

export type ContentField = "title" | "author" | "body" | "link" | "pinned";
/** What is wrong, by field; `form` is about the whole thing. */
export type ContentErrors = Partial<Record<ContentField | "form", string>>;

export type ContentValidation =
  { ok: true; fields: ContentFields } | { ok: false; errors: ContentErrors };

export const CONTENT_MESSAGES = {
  form: "Send an object with the fields of the item.",
  unknown: (names: string[]) => `Not a field of an item: ${names.join(", ")}.`,
  title: `Give it a title (1 to ${CONTENT_LIMITS.titleMax} characters).`,
  author: `The author is text of up to ${CONTENT_LIMITS.authorMax} characters.`,
  noAuthor: "Only books have an author.",
  bookBody: `The text is up to ${CONTENT_LIMITS.bookBodyMax} characters.`,
  announcementBody: `The text is up to ${CONTENT_LIMITS.announcementBodyMax} characters.`,
  link: "The link is an https:// address, or empty.",
  pinned: "Pinned is true or false.",
  noPin: "Only announcements can be pinned.",
} as const;

const FIELD_NAMES: readonly string[] = [
  "title",
  "author",
  "body",
  "link",
  "pinned",
];

const NOTHING: ContentFields = {
  title: "",
  author: "",
  body: "",
  link: null,
  pinned: false,
};

/**
 * Checks and cleans what somebody typed for a book or an announcement. For a new
 * one, only the title is needed; for a change (`existing` is what it was), what
 * is not given stays. Never throws: what is wrong comes back by field.
 */
export function validateContentFields(
  kind: ContentKind,
  input: unknown,
  existing?: ContentFields,
): ContentValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return { ok: false, errors: { form: CONTENT_MESSAGES.form } };
  const given = input as Record<string, unknown>;
  const errors: ContentErrors = {};

  const unknown = Object.keys(given).filter(
    (name) => !FIELD_NAMES.includes(name),
  );
  if (unknown.length > 0) errors.form = CONTENT_MESSAGES.unknown(unknown);

  const base = existing ?? NOTHING;
  const has = (name: ContentField) => given[name] !== undefined;
  const fields: ContentFields = { ...base };

  if (has("title") || !existing) {
    const raw = given.title;
    const title = typeof raw === "string" ? sanitizeLine(raw) : "";
    if (title.length < 1 || title.length > CONTENT_LIMITS.titleMax)
      errors.title = CONTENT_MESSAGES.title;
    else fields.title = title;
  }

  if (has("author")) {
    const raw = given.author;
    if (kind !== "book") errors.author = CONTENT_MESSAGES.noAuthor;
    else if (typeof raw !== "string") errors.author = CONTENT_MESSAGES.author;
    else {
      const author = sanitizeLine(raw);
      if (author.length > CONTENT_LIMITS.authorMax)
        errors.author = CONTENT_MESSAGES.author;
      else fields.author = author;
    }
  }

  if (has("body")) {
    const raw = given.body;
    const max =
      kind === "book"
        ? CONTENT_LIMITS.bookBodyMax
        : CONTENT_LIMITS.announcementBodyMax;
    const message =
      kind === "book"
        ? CONTENT_MESSAGES.bookBody
        : CONTENT_MESSAGES.announcementBody;
    if (typeof raw !== "string") errors.body = message;
    else {
      const body = sanitizeText(raw);
      if (body.length > max) errors.body = message;
      else fields.body = body;
    }
  }

  if (has("link")) {
    const raw = given.link;
    if (raw === null || (typeof raw === "string" && raw.trim() === ""))
      fields.link = null;
    else if (typeof raw !== "string") errors.link = CONTENT_MESSAGES.link;
    else {
      const trimmed = raw.trim();
      const problem = linkProblem(trimmed);
      if (problem) errors.link = problem;
      else fields.link = new URL(trimmed).href;
    }
  }

  if (has("pinned")) {
    if (typeof given.pinned !== "boolean")
      errors.pinned = CONTENT_MESSAGES.pinned;
    else if (given.pinned && kind !== "announcement")
      errors.pinned = CONTENT_MESSAGES.noPin;
    else fields.pinned = given.pinned;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, fields };
}
