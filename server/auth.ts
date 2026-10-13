import {
  authenticate,
  type AuthDeps,
  type AuthResult,
} from "./authenticate.ts";
import { MemoryUserStore, type UserStore } from "./userStore.ts";

let signIn: AuthDeps | null = null;
let userStore: UserStore = new MemoryUserStore();

/** The people of the building: in memory until the server connects a database. */
export function setUserStore(next: UserStore): void {
  userStore = next;
}

/** Same for the whole server; hands out whichever store is current. */
export const users: UserStore = {
  upsert: (user) => userStore.upsert(user),
  get: (id) => userStore.get(id),
  setAdmin: (id, admin) => userStore.setAdmin(id, admin),
  addHead: (floor, userId) => userStore.addHead(floor, userId),
  removeHead: (floor, userId) => userStore.removeHead(floor, userId),
  headsOf: (floor) => userStore.headsOf(floor),
  rolesOf: (userId) => userStore.rolesOf(userId),
  list: () => userStore.list(),
  appearanceOf: (userId) => userStore.appearanceOf(userId),
  setAppearance: (userId, appearance) =>
    userStore.setAppearance(userId, appearance),
};

/** Turns sign-in on (with how to check people) or off (null: everybody may enter, as before). */
export function setSignIn(next: AuthDeps | null): void {
  signIn = next;
}

/**
 * Who is entering, from the token their game sent. Null when sign-in is off,
 * so there is nobody to identify.
 */
export async function authenticateJoin(
  token: unknown,
): Promise<AuthResult | null> {
  return signIn ? authenticate(token, signIn) : null;
}
