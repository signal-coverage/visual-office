import { FLOOR_ID } from "../shared/floors.ts";
import { FloorLocks, type FloorLockStore } from "./floorLocks.ts";
import { MemoryLayoutStore, type LayoutStore } from "./layoutStore.ts";

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

/** The floors this server runs. */
export const KNOWN_FLOORS: readonly string[] = [FLOOR_ID];

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
