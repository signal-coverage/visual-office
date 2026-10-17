import { COMMON_FLOOR_ID, COMMON_FLOOR_NAME } from "../shared/floors.ts";

/** A floor of the building. */
export interface FloorRecord {
  id: string;
  name: string;
  /** Everybody in the company may enter it. */
  common: boolean;
  /** Milliseconds since 1970: the main office is 0, so it is always first. */
  createdAt: number;
  /** Milliseconds since 1970 when it was archived: absent for a room in use. */
  archivedAt?: number;
}

/**
 * The floors there are, and who was given an entry for each. Who is head of a
 * floor is kept apart (the user store): a head can always enter, with no entry.
 */
export interface FloorStore {
  /** Every floor, the oldest first. */
  list(): Promise<FloorRecord[]>;
  get(id: string): Promise<FloorRecord | null>;
  /** A new floor, which is not common. Null when the id is taken: nothing changes then. */
  create(input: { id: string; name: string }): Promise<FloorRecord | null>;
  /** Null when there is no such floor. */
  rename(id: string, name: string): Promise<FloorRecord | null>;
  /** Archives a floor (hides it and closes it to everybody) keeping the first moment if it already was. Null when there is no such floor. */
  archive(id: string): Promise<FloorRecord | null>;
  /** Brings an archived floor back. Null when there is no such floor. */
  unarchive(id: string): Promise<FloorRecord | null>;
  /** Gives somebody an entry for a floor. False when there is no such floor; doing it twice changes nothing. */
  grant(floor: string, userId: string): Promise<boolean>;
  /** Takes the entry away. False when there was none. */
  revoke(floor: string, userId: string): Promise<boolean>;
  /** The floors somebody has an entry for. */
  floorsOf(userId: string): Promise<string[]>;
  /** Every entry there is, for the admin screens. */
  allGrants(): Promise<Array<{ floor: string; userId: string }>>;
}

/** The floors, in this process's memory (development without a database). */
export class MemoryFloorStore implements FloorStore {
  private readonly floors = new Map<string, FloorRecord>([
    [
      COMMON_FLOOR_ID,
      {
        id: COMMON_FLOOR_ID,
        name: COMMON_FLOOR_NAME,
        common: true,
        createdAt: 0,
      },
    ],
  ]);
  private readonly grants = new Set<string>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async list() {
    return [...this.floors.values()]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map((floor) => ({ ...floor }));
  }

  async get(id: string) {
    const floor = this.floors.get(id);
    return floor ? { ...floor } : null;
  }

  async create({ id, name }: { id: string; name: string }) {
    if (this.floors.has(id)) return null;
    const floor: FloorRecord = {
      id,
      name,
      common: false,
      createdAt: this.now(),
    };
    this.floors.set(id, floor);
    return { ...floor };
  }

  async rename(id: string, name: string) {
    const floor = this.floors.get(id);
    if (!floor) return null;
    const renamed = { ...floor, name };
    this.floors.set(id, renamed);
    return { ...renamed };
  }

  async archive(id: string) {
    const floor = this.floors.get(id);
    if (!floor) return null;
    const archived = { ...floor, archivedAt: floor.archivedAt ?? this.now() };
    this.floors.set(id, archived);
    return { ...archived };
  }

  async unarchive(id: string) {
    const floor = this.floors.get(id);
    if (!floor) return null;
    const back: FloorRecord = { ...floor };
    delete back.archivedAt;
    this.floors.set(id, back);
    return { ...back };
  }

  async grant(floor: string, userId: string) {
    if (!this.floors.has(floor)) return false;
    this.grants.add(`${floor}\n${userId}`);
    return true;
  }

  async revoke(floor: string, userId: string) {
    return this.grants.delete(`${floor}\n${userId}`);
  }

  async floorsOf(userId: string) {
    return (await this.allGrants())
      .filter((grant) => grant.userId === userId)
      .map((grant) => grant.floor)
      .sort();
  }

  async allGrants() {
    return [...this.grants]
      .map((key) => {
        const [floor, userId] = key.split("\n") as [string, string];
        return { floor, userId };
      })
      .sort(
        (a, b) =>
          a.floor.localeCompare(b.floor) || a.userId.localeCompare(b.userId),
      );
  }
}
