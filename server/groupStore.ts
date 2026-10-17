import type { FloorStore } from "./floorStore.ts";

/** A group of people who get the same rooms. */
export interface GroupRecord {
  id: string;
  name: string;
  /** Milliseconds since 1970. */
  createdAt: number;
  /** The rooms its members may enter, sorted. Rooms that are archived stay in it. */
  floors: string[];
  /** The people in it, by user id, sorted. */
  members: string[];
}

/**
 * The role groups: a name, the people in it and the rooms it opens. Who is in
 * which group, and which rooms a group has, are kept apart from the entries an
 * admin gives one person at a time (the floor store): a person may enter a room
 * with either.
 */
export interface GroupStore {
  /** Every group, the oldest first. */
  list(): Promise<GroupRecord[]>;
  get(id: string): Promise<GroupRecord | null>;
  /** A new, empty group. Null when the id is taken: nothing changes then. */
  create(input: { id: string; name: string }): Promise<GroupRecord | null>;
  /** Null when there is no such group. */
  rename(id: string, name: string): Promise<GroupRecord | null>;
  /** Deletes the group with its members and rooms. False when there was none. */
  remove(id: string): Promise<boolean>;
  /** Adds or removes a member; doing it twice changes nothing. False when there is no such group. */
  setMember(group: string, userId: string, member: boolean): Promise<boolean>;
  /** Gives or takes away a room; doing it twice changes nothing. False when there is no such group or room. */
  setFloor(group: string, floor: string, allowed: boolean): Promise<boolean>;
  /** The groups somebody is in. */
  groupsOf(userId: string): Promise<GroupRecord[]>;
}

/** The groups, in this process's memory (development without a database). */
export class MemoryGroupStore implements GroupStore {
  private readonly groups = new Map<string, GroupRecord>();
  private readonly now: () => number;
  private readonly floors: Pick<FloorStore, "get">;

  constructor(now: () => number, floors: Pick<FloorStore, "get">) {
    this.now = now;
    this.floors = floors;
  }

  private static copy(group: GroupRecord): GroupRecord {
    return {
      ...group,
      floors: [...group.floors],
      members: [...group.members],
    };
  }

  async list() {
    return [...this.groups.values()]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(MemoryGroupStore.copy);
  }

  async get(id: string) {
    const group = this.groups.get(id);
    return group ? MemoryGroupStore.copy(group) : null;
  }

  async create({ id, name }: { id: string; name: string }) {
    if (this.groups.has(id)) return null;
    const group: GroupRecord = {
      id,
      name,
      createdAt: this.now(),
      floors: [],
      members: [],
    };
    this.groups.set(id, group);
    return MemoryGroupStore.copy(group);
  }

  async rename(id: string, name: string) {
    const group = this.groups.get(id);
    if (!group) return null;
    group.name = name;
    return MemoryGroupStore.copy(group);
  }

  async remove(id: string) {
    return this.groups.delete(id);
  }

  async setMember(group: string, userId: string, member: boolean) {
    const found = this.groups.get(group);
    if (!found) return false;
    const others = found.members.filter((id) => id !== userId);
    found.members = (member ? [...others, userId] : others).sort();
    return true;
  }

  async setFloor(group: string, floor: string, allowed: boolean) {
    const found = this.groups.get(group);
    if (!found || !(await this.floors.get(floor))) return false;
    const others = found.floors.filter((id) => id !== floor);
    found.floors = (allowed ? [...others, floor] : others).sort();
    return true;
  }

  async groupsOf(userId: string) {
    return (await this.list()).filter((group) =>
      group.members.includes(userId),
    );
  }
}
