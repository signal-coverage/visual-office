/**
 * Little things the installation needs to remember that are not tied to a
 * floor or a person: for now, which Clerk organization is the company.
 */
export interface SettingsStore {
  get(key: string): Promise<string | null>;
  /** Sets a value, replacing any that was there. */
  set(key: string, value: string): Promise<void>;
  /** Sets a value only when there is none yet. Whether this call was the one that set it. */
  setIfAbsent(key: string, value: string): Promise<boolean>;
}

/** Settings kept in this process's memory (development without a database). */
export class MemorySettingsStore implements SettingsStore {
  private readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
  }

  async setIfAbsent(key: string, value: string) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
}
