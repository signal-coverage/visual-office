interface Bucket {
  tokens: number;
  at: number;
}

/**
 * A token bucket per player: it lets a burst through up to `capacity` and then
 * only `perSecond` actions a second, so nobody can flood the room.
 */
export class RateLimiter {
  private readonly capacity: number;
  private readonly perSecond: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    capacity: number,
    perSecond: number,
    now: () => number = Date.now,
  ) {
    this.capacity = capacity;
    this.perSecond = perSecond;
    this.now = now;
  }

  /** Whether `key` may act now; if so, it spends a token. */
  allow(key: string): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + ((now - bucket.at) / 1000) * this.perSecond,
    );
    bucket.at = now;
    this.buckets.set(key, bucket);

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }
}
