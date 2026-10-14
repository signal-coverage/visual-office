import type { Layout } from "../shared/layout.ts";

/** What a floor holds: the furniture and the models standing on it. */
export type { Layout };

/** A layout as it was published: one entry of a floor's history, never edited afterwards. */
export interface StoredLayout extends Layout {
  floor: string;
  /** 1 for the first publish of a floor, then one more each time. */
  version: number;
  author: string;
  createdAt: number;
}

/** A line of a floor's history, without the (larger) contents. */
export type LayoutSummary = Omit<StoredLayout, "furniture" | "models"> & {
  /** Somebody vouched that this version is fine to go back to. */
  good: boolean;
};

/**
 * Every layout a floor has had. Publishing adds a version and never changes an
 * old one, so a mistake is undone by publishing an earlier version again.
 * The current layout of a floor is its newest version.
 */
export interface LayoutStore {
  current(floor: string): Promise<StoredLayout | null>;
  get(floor: string, version: number): Promise<StoredLayout | null>;
  /** Newest first. */
  history(floor: string, limit?: number): Promise<LayoutSummary[]>;
  publish(floor: string, layout: Layout, author: string): Promise<StoredLayout>;
  /**
   * Vouches for a version as a safe one to go back to. Marks never change the
   * layout itself. False when the floor has no such version.
   */
  mark(floor: string, version: number, by: string): Promise<boolean>;
  /** The newest version somebody vouched for. */
  lastGood(floor: string): Promise<StoredLayout | null>;
}

/** Layouts kept in this process's memory (development without a database). */
export class MemoryLayoutStore implements LayoutStore {
  private readonly versions = new Map<string, StoredLayout[]>();
  /** `floor:version` of each version vouched for, and who did it. */
  private readonly good = new Map<string, string>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async current(floor: string) {
    return this.versions.get(floor)?.at(-1) ?? null;
  }

  async get(floor: string, version: number) {
    return this.versions.get(floor)?.[version - 1] ?? null;
  }

  async history(floor: string, limit = 50) {
    return [...(this.versions.get(floor) ?? [])]
      .reverse()
      .slice(0, limit)
      .map(({ floor, version, author, createdAt }) => ({
        floor,
        version,
        author,
        createdAt,
        good: this.good.has(`${floor}:${version}`),
      }));
  }

  async mark(floor: string, version: number, by: string) {
    if (!this.versions.get(floor)?.[version - 1]) return false;
    const key = `${floor}:${version}`;
    // The first one to vouch for it is the one remembered
    if (!this.good.has(key)) this.good.set(key, by);
    return true;
  }

  async lastGood(floor: string) {
    const list = this.versions.get(floor) ?? [];
    const found = list.findLast((v) => this.good.has(`${floor}:${v.version}`));
    return found ? structuredClone(found) : null;
  }

  async publish(floor: string, layout: Layout, author: string) {
    const list = this.versions.get(floor) ?? [];
    // A copy, so what is stored cannot be changed through what was passed in
    const stored: StoredLayout = {
      floor,
      version: list.length + 1,
      author,
      createdAt: this.now(),
      ...structuredClone(layout),
    };
    this.versions.set(floor, [...list, stored]);
    return structuredClone(stored);
  }
}
