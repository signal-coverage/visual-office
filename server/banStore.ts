const MINUTE_MS = 60_000;

export interface ActiveBan {
  userId: string;
  /** When it ends, in milliseconds since 1970. */
  until: number;
}

/** Who may not enter the office for now. A ban is for a few minutes and ends by itself. */
export interface BanStore {
  /** Bans somebody for `minutes` from `now`. Returns when it ends; a ban already in force is replaced by the new one. */
  ban(userId: string, minutes: number, now: number): Promise<number>;
  /** When the ban in force ends, or null when there is none. */
  activeUntil(userId: string, now: number): Promise<number | null>;
  /** Lifts a ban. False when there was none in force. */
  lift(userId: string, now: number): Promise<boolean>;
  /** The bans in force. */
  list(now: number): Promise<ActiveBan[]>;
}

/**
 * Bans kept in this process's memory. They are short, so losing them in a
 * restart costs little; a database would only matter for long bans or for
 * several servers sharing them (see docs/BUILDING.md).
 */
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

/** Who is banned, for the whole server. */
export const bans: BanStore = new MemoryBanStore();
