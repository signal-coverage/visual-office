export interface SharedScreen {
  identity: string;
  /** Who is sharing, as shown to the others. */
  name: string;
  element: HTMLVideoElement;
}

/**
 * The screens being shared in the call we are in. The wall screen shows one at
 * a time: the one that started last, and when it stops, the one before.
 */
export class ScreenShares {
  private shares: SharedScreen[] = [];

  add(identity: string, name: string, element: HTMLVideoElement): void {
    this.remove(identity);
    this.shares.push({ identity, name, element });
  }

  remove(identity: string): void {
    this.shares = this.shares.filter((share) => share.identity !== identity);
  }

  current(): SharedScreen | null {
    return this.shares.at(-1) ?? null;
  }

  clear(): void {
    this.shares = [];
  }
}
