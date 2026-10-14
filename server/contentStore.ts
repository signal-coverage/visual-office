import { randomUUID } from "node:crypto";
import {
  CONTENT_LIMITS,
  type ContentFields,
  type ContentItem,
  type ContentKind,
} from "../shared/content.ts";

export type CreateResult =
  { ok: true; item: ContentItem } | { ok: false; reason: "limit" };

/**
 * The books and the announcements of each floor. It keeps what it is given:
 * checking and cleaning the words is the caller's job (shared/content.ts).
 */
export interface ContentStore {
  /** The items of a floor (of one kind, or both): the pinned first, then in the order they were made. */
  list(floor: string, kind?: ContentKind): Promise<ContentItem[]>;
  get(id: string): Promise<ContentItem | null>;
  /** A new item at the end. Refused when the floor already has the most it may have of that kind. */
  create(
    floor: string,
    kind: ContentKind,
    fields: ContentFields,
  ): Promise<CreateResult>;
  /** Changes the words of an item. Null when there is no such item. */
  update(id: string, fields: ContentFields): Promise<ContentItem | null>;
  /** Takes an item away and says what it was. Null when there was none. */
  remove(id: string): Promise<ContentItem | null>;
}

const inOrder = (a: ContentItem, b: ContentItem) =>
  Number(b.pinned) - Number(a.pinned) ||
  a.position - b.position ||
  a.createdAt - b.createdAt ||
  a.id.localeCompare(b.id);

/** The content, in this process's memory (development without a database). */
export class MemoryContentStore implements ContentStore {
  private readonly items = new Map<string, ContentItem>();
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(now: () => number = Date.now, newId: () => string = randomUUID) {
    this.now = now;
    this.newId = newId;
  }

  async list(floor: string, kind?: ContentKind) {
    return [...this.items.values()]
      .filter((item) => item.floor === floor && (!kind || item.kind === kind))
      .sort(inOrder)
      .map((item) => ({ ...item }));
  }

  async get(id: string) {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  async create(
    floor: string,
    kind: ContentKind,
    fields: ContentFields,
  ): Promise<CreateResult> {
    const same = [...this.items.values()].filter(
      (item) => item.floor === floor && item.kind === kind,
    );
    if (same.length >= CONTENT_LIMITS.perKind)
      return { ok: false, reason: "limit" };
    const position = Math.max(0, ...same.map((item) => item.position)) + 1;
    const at = this.now();
    const item: ContentItem = {
      ...fields,
      id: this.newId(),
      floor,
      kind,
      position,
      createdAt: at,
      updatedAt: at,
    };
    this.items.set(item.id, item);
    return { ok: true, item: { ...item } };
  }

  async update(id: string, fields: ContentFields) {
    const item = this.items.get(id);
    if (!item) return null;
    const changed: ContentItem = { ...item, ...fields, updatedAt: this.now() };
    this.items.set(id, changed);
    return { ...changed };
  }

  async remove(id: string) {
    const item = this.items.get(id);
    if (!item) return null;
    this.items.delete(id);
    return { ...item };
  }
}
