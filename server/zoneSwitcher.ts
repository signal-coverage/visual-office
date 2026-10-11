/**
 * Decides when a player's voice call has to move to another room.
 *
 * Walking through a doorway can flip a player in and out of a zone, and every
 * switch means reconnecting to LiveKit, so changes are spaced out: the first
 * one is immediate and later ones wait for the gap, applying only the latest
 * zone. The call is what carries the privacy, so it is also the thing that is
 * rate limited, not what the player sees on screen.
 */
export class ZoneSwitcher {
  private issued: string | null = null;
  private current: string | null = null;
  private lastAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly onSwitch: (zone: string | null) => void;
  private readonly minGapMs: number;

  constructor(onSwitch: (zone: string | null) => void, minGapMs: number) {
    this.onSwitch = onSwitch;
    this.minGapMs = minGapMs;
  }

  /** The zone whose voice room this player was last sent credentials for. */
  get issuedZone(): string | null {
    return this.issued;
  }

  /** Reports the zone the player is in right now. */
  update(zone: string | null): void {
    if (this.disposed) return;
    this.current = zone;

    if (zone === this.issued) {
      this.cancelPending();
      return;
    }

    const wait = this.lastAt + this.minGapMs - Date.now();
    if (wait <= 0) {
      this.cancelPending();
      this.issue();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.current !== this.issued) this.issue();
      }, wait);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelPending();
  }

  private issue(): void {
    this.issued = this.current;
    this.lastAt = Date.now();
    this.onSwitch(this.issued);
  }

  private cancelPending(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
