const MINUTE_MS = 60_000;

export interface ActiveBan {
  userId: string;
  /** When it ends, in milliseconds since 1970. */
  until: number;
}

/** What is kept beside a ban for whoever reads the records later; it changes nothing about the ban. */
export interface BanMeta {
  byUserId?: string | null;
  reason?: string | null;
}

/** Lapsed bans removed by one call, so tidying up never holds a request for long. */
export const MAX_PURGE_PER_CALL = 100;

/** Who may not enter the office for now. A ban is for a few minutes and ends by itself. */
export interface BanStore {
  /** Bans somebody for `minutes` from `now`. Returns when it ends; a ban already in force is replaced by the new one. */
  ban(
    userId: string,
    minutes: number,
    now: number,
    meta?: BanMeta,
  ): Promise<number>;
  /** When the ban in force ends, or null when there is none. */
  activeUntil(userId: string, now: number): Promise<number | null>;
  /** Lifts a ban. False when there was none in force. */
  lift(userId: string, now: number): Promise<boolean>;
  /** The bans in force. */
  list(now: number): Promise<ActiveBan[]>;
}

/** Bans kept in this process's memory: what the server uses without a database, and in tests. */
export class MemoryBanStore implements BanStore {
  private readonly until = new Map<string, number>();

  private expire(now: number) {
    for (const [userId, end] of this.until)
      if (end <= now) this.until.delete(userId);
  }

  async ban(userId: string, minutes: number, now: number) {
    this.expire(now);
    const end = now + minutes * MINUTE_MS;
    this.until.set(userId, end);
    return end;
  }

  async activeUntil(userId: string, now: number) {
    this.expire(now);
    return this.until.get(userId) ?? null;
  }

  async lift(userId: string, now: number) {
    this.expire(now);
    return this.until.delete(userId);
  }

  async list(now: number) {
    this.expire(now);
    return [...this.until].map(([userId, until]) => ({ userId, until }));
  }
}

const DEFAULT_TTL_MS = 5000;
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Remembers what a store answered for a few seconds, so a join does not cost a
 * database read. Safe because every ban and lift goes through here (one server
 * process), and a remembered ban is never served after the moment it ends.
 */
export class CachedBanStore implements BanStore {
  private readonly seen = new Map<
    string,
    { until: number | null; at: number }
  >();

  private readonly inner: BanStore;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(
    inner: BanStore,
    ttlMs = DEFAULT_TTL_MS,
    maxEntries = DEFAULT_MAX_ENTRIES,
  ) {
    this.inner = inner;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  private remember(userId: string, until: number | null, at: number) {
    this.seen.delete(userId);
    while (this.seen.size >= this.maxEntries) {
      const oldest = this.seen.keys().next();
      if (oldest.done) break;
      this.seen.delete(oldest.value);
    }
    this.seen.set(userId, { until, at });
  }

  async ban(userId: string, minutes: number, now: number, meta?: BanMeta) {
    const until = await this.inner.ban(userId, minutes, now, meta);
    this.remember(userId, until, now);
    return until;
  }

  async activeUntil(userId: string, now: number) {
    const hit = this.seen.get(userId);
    if (
      hit &&
      now >= hit.at &&
      now - hit.at < this.ttlMs &&
      (hit.until === null || now < hit.until)
    )
      return hit.until;
    const until = await this.inner.activeUntil(userId, now);
    this.remember(userId, until, now);
    return until;
  }

  async lift(userId: string, now: number) {
    const lifted = await this.inner.lift(userId, now);
    this.remember(userId, null, now);
    return lifted;
  }

  list(now: number) {
    return this.inner.list(now);
  }
}

let store: BanStore = new MemoryBanStore();

/** Where bans are kept from now on: memory until the server connects a database. */
export function setBanStore(next: BanStore): void {
  store = next;
}

/** Who is banned, for the whole server. */
export const bans: BanStore = {
  ban: (userId, minutes, now, meta) => store.ban(userId, minutes, now, meta),
  activeUntil: (userId, now) => store.activeUntil(userId, now),
  lift: (userId, now) => store.lift(userId, now),
  list: (now) => store.list(now),
};
