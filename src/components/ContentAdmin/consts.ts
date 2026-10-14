import type { ContentKind } from "../../../shared/content.ts";

export const TITLE = "Content";
export const INTRO =
  "What the computers and the bookshelves of a room show: announcements for the computers and books for the shelves. Each room has its own. It is plain text: nothing is read as formatting, and links must start with https://.";
export const ROOM_LABEL = "Room";
export const CLOSE_LABEL = "Back";
export const NO_ROOMS =
  "You are not the head of any room, so there is nothing to edit here.";
export const FLOORS_ERROR =
  "Could not load the rooms you can edit. Try again in a moment.";
export const CONTENT_ERROR = "Could not load this room's content.";
export const RETRY_LABEL = "Try again";

export const TABS: ReadonlyArray<{ id: ContentKind; label: string }> = [
  { id: "book", label: "Books" },
  { id: "announcement", label: "Announcements" },
];

export const KIND_WORDS: Record<
  ContentKind,
  { one: string; many: string; add: string; empty: string }
> = {
  book: {
    one: "book",
    many: "books",
    add: "Add a book",
    empty: "This room's shelves have no books yet.",
  },
  announcement: {
    one: "announcement",
    many: "announcements",
    add: "Add an announcement",
    empty: "This room's computers have nothing posted yet.",
  },
};

export const COUNT = (used: number, max: number, many: string) =>
  `${used} of ${max} ${many}`;

export const COLUMNS = {
  title: "Title",
  author: "Author",
  updated: "Changed",
  actions: "Actions",
} as const;
export const PINNED = "Pinned";
export const HAS_LINK = "Link";
export const EDIT_LABEL = "Edit";
export const DELETE_LABEL = "Delete";
export const CONFIRM_DELETE = (title: string) => `Delete "${title}"?`;
export const CONFIRM_LABEL = "Yes, delete";
export const CANCEL_LABEL = "Cancel";
export const DELETE_ERROR = "Could not delete it.";
export const TABLE_LABEL = (many: string) => `The ${many} of this room`;

export const EDITOR = {
  newBook: "Add a book",
  editBook: "Edit the book",
  newAnnouncement: "Add an announcement",
  editAnnouncement: "Edit the announcement",
  title: "Title",
  author: "Author",
  bookBody: "Text of the book",
  announcementBody: "Text of the announcement",
  link: "Link (optional)",
  linkHint: "An https:// address. People open it with a button.",
  linkPlaceholder: "https://example.com/page",
  pinned: "Pinned (shown first)",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
} as const;

export const COUNTER = (used: number, max: number) => `${used} / ${max}`;
