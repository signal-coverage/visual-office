import { createClerkClient, verifyToken } from "@clerk/backend";
import { profileFromClerkUser, type Profile } from "./authenticate.ts";
import type { AccountDeps } from "./account.ts";
import type { AuditRecorder } from "./audit.ts";
import { authStatusFromEnv } from "./authStatus.ts";
import type { Company } from "./company.ts";
import type { CompanySettings } from "./companySettings.ts";
import type { UserStore } from "./userStore.ts";

type Env = Record<string, string | undefined>;

/** How long a "yes, they are in the company" is trusted before asking Clerk again. */
const MEMBERSHIP_TTL_MS = 60_000;
/** More organizations than anybody belongs to; the list is searched for the company's. */
const MEMBERSHIP_PAGE = 100;

/**
 * Whether a reason the token was refused says something about the token itself
 * (expired, forged, meant for another app) rather than about checking it (a bad
 * secret key, the key set not loading). Only the first is the visitor's problem.
 */
export function isTokenProblem(reason: string | undefined): boolean {
  return reason?.startsWith("token-") ?? false;
}

/** The emails that become admins when they first sign in (ADMIN_EMAILS, comma separated). */
export function adminEmailsFromEnv(env: Env): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Remembers a "yes" per person for a while. A "no" is not remembered (somebody
 * who has just accepted an invitation must get in at once), nor is a failure to ask.
 */
export function membershipCache(
  ask: (key: string) => Promise<boolean>,
  now: () => number,
  ttlMs: number,
): (key: string) => Promise<boolean> {
  const yes = new Map<string, number>();
  return async (key) => {
    const at = yes.get(key);
    if (at !== undefined && now() - at < ttlMs) return true;
    const answer = await ask(key);
    if (answer) yes.set(key, now());
    return answer;
  };
}

/**
 * What the game server needs to know who is signing in, from Clerk. Null when
 * the keys are not configured: the server then lets everybody in, as before.
 *
 * Who belongs to the company is Clerk's business: the people of one
 * organization (see `company`), who join it by invitation. Until the company is
 * set up nobody is in it.
 */
export function clerkAuthFromEnv(
  env: Env,
  users: UserStore,
  company: Company,
  settings: CompanySettings,
  audit?: AuditRecorder,
): AccountDeps | null {
  if (!authStatusFromEnv(env).ready) return null;
  const secretKey = env.CLERK_SECRET_KEY!.trim();
  const publishableKey = (env.VITE_CLERK_PUBLISHABLE_KEY ??
    env.CLERK_PUBLISHABLE_KEY)!.trim();
  const clerk = createClerkClient({ secretKey, publishableKey });
  const authorizedParties = (env.CLERK_AUTHORIZED_PARTIES ?? "")
    .split(",")
    .map((party) => party.trim())
    .filter(Boolean);

  const isInOrganization = async (userId: string, organizationId: string) => {
    const { data } = await clerk.users.getOrganizationMembershipList({
      userId,
      limit: MEMBERSHIP_PAGE,
    });
    return data.some((m) => m.organization.id === organizationId);
  };
  const remembered = membershipCache(
    (key) => {
      const [userId, organizationId] = key.split("|");
      return isInOrganization(userId, organizationId);
    },
    Date.now,
    MEMBERSHIP_TTL_MS,
  );
  const isMember = async (userId: string) => {
    const organizationId = await company.get();
    return organizationId ? remembered(`${userId}|${organizationId}`) : false;
  };

  return {
    verify: async (token) => {
      // This version returns the token's contents, and throws (with a `reason`) when it is refused
      try {
        const claims = await verifyToken(token, {
          secretKey,
          ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
        });
        // A session that has not finished its setup steps (`pending`) is not a person to let in yet
        if ((claims as { sts?: string }).sts === "pending") return null;
        return { userId: claims.sub };
      } catch (error) {
        if (isTokenProblem((error as { reason?: string }).reason)) return null;
        // Something is wrong on our side (keys, network): say so, do not blame the visitor
        throw error;
      }
    },
    profile: async (userId): Promise<Profile> =>
      profileFromClerkUser(await clerk.users.getUser(userId)),
    isMember,
    isInOrganization,
    company,
    settings,
    users,
    adminEmails: adminEmailsFromEnv(env),
    now: Date.now,
    ...(audit ? { audit } : {}),
  };
}
