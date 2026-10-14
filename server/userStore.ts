import type { Appearance } from "../shared/appearance.ts";

/** Somebody who signed in at least once. Their id is the sign-in service's. */
export interface UserRecord {
  id: string;
  email: string | null;
  name: string;
  /** Can do anything on any floor. */
  isAdmin: boolean;
}

/** Somebody who signed in, with the floors they are head of. */
export interface PersonRecord extends UserRecord {
  headOf: string[];
}

/** What somebody may do beyond walking around: the building's roles, kept in our database. */
export interface Roles {
  admin: boolean;
  /** The floors they are head of: the ones whose layout they may edit. */
  headOf: string[];
}

/**
 * The people of the building and what each may do. Who is in the company is
 * the sign-in service's business (its invitations); which floor somebody edits
 * is decided here.
 */
export interface UserStore {
  /** Remembers somebody who signed in, or brings up to date what we know. Never touches their roles. */
  upsert(user: {
    id: string;
    email: string | null;
    name: string;
  }): Promise<UserRecord>;
  get(id: string): Promise<UserRecord | null>;
  /** False when nobody with that id ever signed in. */
  setAdmin(id: string, admin: boolean): Promise<boolean>;
  /** False when nobody with that id ever signed in. Naming the same head twice changes nothing. */
  addHead(floor: string, userId: string): Promise<boolean>;
  /** False when they were not head of that floor. */
  removeHead(floor: string, userId: string): Promise<boolean>;
  headsOf(floor: string): Promise<string[]>;
  rolesOf(userId: string): Promise<Roles>;
  /** Everybody who signed in, by name, with what each may do. */
  list(): Promise<PersonRecord[]>;
  /** The look they chose last, or null if they never chose one. */
  appearanceOf(userId: string): Promise<Appearance | null>;
  /** Remembers their look. False when nobody with that id ever signed in. */
  setAppearance(userId: string, appearance: Appearance): Promise<boolean>;
}

/** People kept in this process's memory (development without a database). */
export class MemoryUserStore implements UserStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly heads = new Set<string>();
  private readonly looks = new Map<string, Appearance>();

  async upsert(user: { id: string; email: string | null; name: string }) {
    const known = this.users.get(user.id);
    const record: UserRecord = { ...user, isAdmin: known?.isAdmin ?? false };
    this.users.set(user.id, record);
    return { ...record };
  }

  async get(id: string) {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async setAdmin(id: string, admin: boolean) {
    const user = this.users.get(id);
    if (!user) return false;
    this.users.set(id, { ...user, isAdmin: admin });
    return true;
  }

  async addHead(floor: string, userId: string) {
    if (!this.users.has(userId)) return false;
    this.heads.add(`${floor}\n${userId}`);
    return true;
  }

  async removeHead(floor: string, userId: string) {
    return this.heads.delete(`${floor}\n${userId}`);
  }

  async headsOf(floor: string) {
    return [...this.heads]
      .map((key) => key.split("\n") as [string, string])
      .filter(([f]) => f === floor)
      .map(([, id]) => id);
  }

  async list(): Promise<PersonRecord[]> {
    return [...this.users.values()]
      .sort(
        (a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
          a.id.localeCompare(b.id),
      )
      .map((user) => ({
        ...user,
        headOf: [...this.heads]
          .map((key) => key.split("\n") as [string, string])
          .filter(([, id]) => id === user.id)
          .map(([floor]) => floor)
          .sort(),
      }));
  }

  async appearanceOf(userId: string) {
    const look = this.looks.get(userId);
    return look ? { ...look } : null;
  }

  async setAppearance(userId: string, appearance: Appearance) {
    if (!this.users.has(userId)) return false;
    this.looks.set(userId, { ...appearance });
    return true;
  }

  async rolesOf(userId: string): Promise<Roles> {
    return {
      admin: this.users.get(userId)?.isAdmin ?? false,
      headOf: [...this.heads]
        .map((key) => key.split("\n") as [string, string])
        .filter(([, id]) => id === userId)
        .map(([floor]) => floor),
    };
  }
}
