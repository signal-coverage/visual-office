import { FloorLocks, type FloorLockStore } from "./floorLocks.ts";
import { MemoryFloorStore, type FloorStore } from "./floorStore.ts";
import { MemoryLayoutStore, type LayoutStore } from "./layoutStore.ts";
import type { ModerationRooms } from "./moderationService.ts";

let store: FloorLockStore = new FloorLocks();

/** Where locks are kept from now on: memory until the server connects a database. */
export function setFloorLockStore(next: FloorLockStore): void {
  store = next;
}

/** Who is editing which floor. One for the whole server. */
export const floorLocks: FloorLockStore = {
  current: (floor) => store.current(floor),
  acquire: (floor, holder) => store.acquire(floor, holder),
  renew: (floor, holder) => store.renew(floor, holder),
  release: (floor, holder) => store.release(floor, holder),
};

let layoutStore: LayoutStore = new MemoryLayoutStore();

/** Where layouts are kept from now on: memory until the server connects a database. */
export function setLayoutStore(next: LayoutStore): void {
  layoutStore = next;
}

/** Every layout each floor has had. One for the whole server. */
export const layouts: LayoutStore = {
  current: (floor) => layoutStore.current(floor),
  get: (floor, version) => layoutStore.get(floor, version),
  history: (floor, limit) => layoutStore.history(floor, limit),
  publish: (floor, layout, author) =>
    layoutStore.publish(floor, layout, author),
  mark: (floor, version, by) => layoutStore.mark(floor, version, by),
  lastGood: (floor) => layoutStore.lastGood(floor),
};

let floorStore: FloorStore = new MemoryFloorStore();

/** Where the floors are kept from now on: memory until the server connects a database. */
export function setFloorStore(next: FloorStore): void {
  floorStore = next;
}

/** The floors of the building and who has an entry for each. One for the whole server. */
export const floorDirectory: FloorStore = {
  list: () => floorStore.list(),
  get: (id) => floorStore.get(id),
  create: (input) => floorStore.create(input),
  rename: (id, name) => floorStore.rename(id, name),
  grant: (floor, userId) => floorStore.grant(floor, userId),
  revoke: (floor, userId) => floorStore.revoke(floor, userId),
  floorsOf: (userId) => floorStore.floorsOf(userId),
  allGrants: () => floorStore.allGrants(),
};

/** The ids of the floors there are now: floors are made while the server runs, so this is asked for each time. */
export async function knownFloorIds(): Promise<string[]> {
  return (await floorDirectory.list()).map((floor) => floor.id);
}

/** What a game room offers so its floor can be closed. */
export interface ClosableRoom {
  /** Tells the people inside, sends them out after `graceSeconds`, returns how many were told. */
  closeForEditing: (graceSeconds: number) => number;
  /** A new version of the floor's layout was published: a room made from an older one has to go. */
  layoutPublished: (version: number) => void;
}

const rooms = new Map<string, Set<ClosableRoom>>();

/** A game room says which floor it is. Returns how to undo it when the room is gone. */
export function registerRoom(floor: string, room: ClosableRoom): () => void {
  const set = rooms.get(floor) ?? new Set();
  set.add(room);
  rooms.set(floor, set);
  return () => {
    set.delete(room);
  };
}

/** Tells every room of a floor that this version of its layout was published. */
export function refreshFloor(floor: string, version: number): void {
  for (const room of rooms.get(floor) ?? []) {
    try {
      room.layoutPublished(version);
    } catch (error) {
      // One room failing must not leave the others on the old layout
      console.error("A room could not be told about the new layout:", error);
    }
  }
}

/** Closes every room of a floor to the people inside. Returns how many were told. */
export function closeFloor(floor: string, graceSeconds: number): number {
  let told = 0;
  for (const room of rooms.get(floor) ?? [])
    told += room.closeForEditing(graceSeconds);
  return told;
}

/** What a game room offers so a moderator's action can reach the people in it. */
export interface ModeratedRoom {
  /** Disconnects every session of this person in the room. Returns how many there were. */
  removeUser: (userId: string, code: number, message: string) => number;
  /** Takes this person's microphone away (or gives it back). Returns how many sessions of theirs there were. */
  setVoiceMuted: (userId: string, muted: boolean) => Promise<number>;
  /** Somebody's roles or entries changed: sends them out if they may no longer be here. */
  accessChanged?: (userId: string) => void;
}

const moderatedRooms = new Map<string, Set<ModeratedRoom>>();

/** A game room says which floor it is, for moderation. Returns how to undo it when the room is gone. */
export function registerModeratedRoom(
  floor: string,
  room: ModeratedRoom,
): () => void {
  const set = moderatedRooms.get(floor) ?? new Set();
  set.add(room);
  moderatedRooms.set(floor, set);
  return () => {
    set.delete(room);
  };
}

/** Tells every room of a floor that what somebody may do there changed (an entry was taken away, a head was removed). */
export function recheckAccess(floor: string, userId: string): void {
  for (const room of moderatedRooms.get(floor) ?? []) {
    try {
      room.accessChanged?.(userId);
    } catch (error) {
      // One room failing must not leave the person in the others
      console.error("A room could not check somebody's access:", error);
    }
  }
}

/** Moderation, applied to every room of a floor. */
export const floorRooms: ModerationRooms = {
  removeUser: (floor, userId, code, message) => {
    let removed = 0;
    for (const room of moderatedRooms.get(floor) ?? []) {
      try {
        removed += room.removeUser(userId, code, message);
      } catch (error) {
        // One room failing must not leave the person in the others
        console.error("A room could not remove somebody:", error);
      }
    }
    return removed;
  },
  setVoiceMuted: async (floor, userId, muted) => {
    const counts = await Promise.all(
      [...(moderatedRooms.get(floor) ?? [])].map((room) =>
        room.setVoiceMuted(userId, muted),
      ),
    );
    return counts.reduce((total, count) => total + count, 0);
  },
};
