import { sanitizeName } from "../shared/name.ts";
import type { UserRecord, UserStore } from "./userStore.ts";

export type AuthResult =
  | { ok: true; user: UserRecord }
  | { ok: false; reason: "missing" | "invalid" | "not_member" | "unavailable" };

export interface AuthDeps {
  /** Checks a sign-in token. Null when it is not valid; throws when it cannot be checked. */
  verify: (token: string) => Promise<{ userId: string } | null>;
  /** What the sign-in service knows about somebody. Throws when it cannot say. */
  profile: (userId: string) => Promise<Profile>;
  /** Whether the person belongs to the company (the sign-in service's invitations decide). */
  isMember: (userId: string) => Promise<boolean>;
  users: UserStore;
  /** Lower-case emails that become admins the first time they sign in. */
  adminEmails: ReadonlySet<string>;
  now: () => number;
}

export interface Profile {
  name: string;
  email: string | null;
}

/** How long what the service said about somebody is trusted before asking again. */
export const PROFILE_TTL_MS = 10 * 60_000;

/** When each person's profile was last asked for, per authenticator. */
const askedAt = new WeakMap<AuthDeps, Map<string, number>>();

/**
 * Decides whether somebody may enter, from the token their game sent. Who they
 * are comes from the sign-in service (never from what the client says); what
 * they may do is ours (see UserStore).
 */
export async function authenticate(
  token: unknown,
  deps: AuthDeps,
): Promise<AuthResult> {
  if (typeof token !== "string" || token === "")
    return { ok: false, reason: "missing" };

  let userId: string;
  try {
    const verified = await deps.verify(token);
    if (!verified) return { ok: false, reason: "invalid" };
    userId = verified.userId;
    if (!(await deps.isMember(userId)))
      return { ok: false, reason: "not_member" };
  } catch (error) {
    console.error("Could not check who is signing in:", error);
    return { ok: false, reason: "unavailable" };
  }

  return knownUser(userId, deps);
}

/**
 * Brings up to date what we know of somebody the sign-in service vouches for,
 * and gives them the admin mark if their (verified) email is on the list.
 * Somebody already known can still be let in when the service cannot answer now.
 */
export async function knownUser(
  userId: string,
  deps: AuthDeps,
): Promise<AuthResult> {
  const asked = askedAt.get(deps) ?? new Map<string, number>();
  askedAt.set(deps, asked);
  const last = asked.get(userId);
  const fresh = last !== undefined && deps.now() - last < PROFILE_TTL_MS;

  let user = fresh ? await deps.users.get(userId) : null;
  if (!user) {
    try {
      const profile = await deps.profile(userId);
      user = await deps.users.upsert({ id: userId, ...profile });
      asked.set(userId, deps.now());
    } catch (error) {
      console.error("Could not get the profile of somebody signing in:", error);
      // Somebody we already know can still come in with what we remember
      user = await deps.users.get(userId);
      if (!user) return { ok: false, reason: "unavailable" };
    }
  }

  if (
    !user.isAdmin &&
    user.email &&
    deps.adminEmails.has(user.email.toLowerCase())
  ) {
    await deps.users.setAdmin(user.id, true);
    user = { ...user, isAdmin: true };
  }
  return { ok: true, user };
}

/** The parts of a Clerk user this needs, so it can be tested without Clerk. */
export interface ClerkUserLike {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
}

/**
 * The name to show and the email to trust. Only a verified email counts:
 * anybody can type another person's address, and an admin is chosen by email.
 */
export function profileFromClerkUser(user: ClerkUserLike): Profile {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  const email =
    primary?.verification?.status === "verified" ? primary.emailAddress : null;
  const fullName = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
  const fromEmail = primary?.emailAddress.split("@")[0];
  return {
    name: sanitizeName(fullName || user.username || fromEmail),
    email,
  };
}
