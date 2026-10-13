import type { Appearance } from "../shared/appearance.ts";
import type { AdminReply } from "./floorAdmin.ts";
import { knownUser, type AuthDeps } from "./authenticate.ts";
import type { Company } from "./company.ts";
import type { UserRecord } from "./userStore.ts";

/** What the account endpoints need on top of what letting people in needs. */
export interface AccountDeps extends AuthDeps {
  /** Which organization is the company: the one the people of the company are in. */
  company: Company;
  /** Whether somebody is part of an organization, whatever it is. */
  isInOrganization: (
    userId: string,
    organizationId: string,
  ) => Promise<boolean>;
}

type Refused = "missing" | "invalid" | "unavailable";

export type SessionResult =
  | { ok: false; reason: Refused }
  | {
      ok: true;
      state: "member";
      user: UserRecord;
      organizationId: string;
      /** The look they chose last, or null if they never chose one. */
      appearance: Appearance | null;
    }
  /** Signed in, but not in the company: they need an invitation. */
  | { ok: true; state: "not_member" }
  /** Nobody has set the company up yet. Only the first admins can. */
  | { ok: true; state: "company_missing"; canSetUp: boolean };

/** Organization ids look like org_ followed by letters and digits. */
const ORGANIZATION_ID = /^org_[A-Za-z0-9]{1,100}$/;

/** Whether somebody may set the company up: an admin by email (a verified one) or already an admin. */
async function mayAdminister(
  userId: string,
  deps: AccountDeps,
): Promise<boolean> {
  if ((await deps.users.get(userId))?.isAdmin) return true;
  const { email } = await deps.profile(userId);
  return email !== null && deps.adminEmails.has(email.toLowerCase());
}

/**
 * What a person who just signed in should be shown: the office, the news that
 * they need an invitation, or (for the first admins) the way to set the
 * company up. Who they are comes from the token, never from the request. A
 * stranger is not remembered: nothing is stored for somebody who is not in.
 */
export async function describeSession(
  token: unknown,
  deps: AccountDeps,
): Promise<SessionResult> {
  if (typeof token !== "string" || token === "")
    return { ok: false, reason: "missing" };

  let userId: string;
  let organizationId: string | null;
  let member = false;
  try {
    const verified = await deps.verify(token);
    if (!verified) return { ok: false, reason: "invalid" };
    userId = verified.userId;
    organizationId = await deps.company.get();
    if (organizationId) member = await deps.isMember(userId);
  } catch (error) {
    console.error("Could not check who is signing in:", error);
    return { ok: false, reason: "unavailable" };
  }

  if (!organizationId) {
    let canSetUp: boolean;
    try {
      canSetUp = await mayAdminister(userId, deps);
    } catch (error) {
      console.error("Could not get the profile of somebody signing in:", error);
      return { ok: false, reason: "unavailable" };
    }
    // The admin who will set the company up is remembered; anybody else is not
    if (canSetUp) {
      const known = await knownUser(userId, deps);
      if (!known.ok) return { ok: false, reason: "unavailable" };
    }
    return { ok: true, state: "company_missing", canSetUp };
  }

  if (!member) return { ok: true, state: "not_member" };
  const known = await knownUser(userId, deps);
  if (!known.ok) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    state: "member",
    user: known.user,
    organizationId,
    appearance: await deps.users.appearanceOf(known.user.id),
  };
}

export type SetUpResult =
  | { ok: true; organizationId: string }
  | {
      ok: false;
      reason:
        | Refused
        | "forbidden"
        | "invalid_organization"
        | "not_in_organization"
        | "already_set_up";
    };

/**
 * Makes an organization the company. Only an admin who is part of that
 * organization may, once: the company is not changed from the game afterwards.
 */
export async function setUpCompany(
  token: unknown,
  organizationId: string,
  deps: AccountDeps,
): Promise<SetUpResult> {
  if (typeof token !== "string" || token === "")
    return { ok: false, reason: "missing" };

  try {
    const verified = await deps.verify(token);
    if (!verified) return { ok: false, reason: "invalid" };
    const userId = verified.userId;

    if (!ORGANIZATION_ID.test(organizationId))
      return { ok: false, reason: "invalid_organization" };
    if (await deps.company.get())
      return { ok: false, reason: "already_set_up" };
    if (!(await mayAdminister(userId, deps)))
      return { ok: false, reason: "forbidden" };
    if (!(await deps.isInOrganization(userId, organizationId)))
      return { ok: false, reason: "not_in_organization" };

    // Of two admins doing this at once, only one is saved
    if (!(await deps.company.set(organizationId)))
      return { ok: false, reason: "already_set_up" };
    await knownUser(userId, deps);
    return { ok: true, organizationId };
  } catch (error) {
    console.error("Could not set the company up:", error);
    return { ok: false, reason: "unavailable" };
  }
}

const WORDS: Record<string, string> = {
  missing: "Sign in first.",
  invalid: "Your sign-in is not valid or has expired. Sign in again.",
  unavailable: "Could not check your sign-in right now. Try again in a moment.",
  forbidden: "Only an admin can set the company up.",
  invalid_organization: "That is not an organization id.",
  not_in_organization: "You are not part of that organization.",
  already_set_up: "The company is already set up.",
};

const STATUS: Record<string, number> = {
  missing: 401,
  invalid: 401,
  unavailable: 503,
  forbidden: 403,
  invalid_organization: 400,
  not_in_organization: 403,
  already_set_up: 409,
};

const failure = (reason: string): AdminReply => ({
  status: STATUS[reason] ?? 400,
  body: { error: WORDS[reason] ?? "Not possible.", reason },
});

export interface AccountRequest {
  method: string;
  path: string;
  /** The sign-in token the caller brought, if any. */
  token?: string;
  body?: unknown;
}

/**
 * The account endpoints, for a person who has just signed in and may not be in
 * the company yet (so they are not behind the admin API): what to show them, and
 * setting the company up. Returns null for a path that is not its own.
 */
export async function handleAccount(
  request: AccountRequest,
  deps: AccountDeps,
): Promise<AdminReply | null> {
  const isSession = request.path === "/account/session";
  const isCompany = request.path === "/account/company";
  if (!isSession && !isCompany) return null;

  try {
    if (isSession) {
      if (request.method !== "GET")
        return { status: 405, body: { error: "Use GET." } };
      const result = await describeSession(request.token, deps);
      if (!result.ok) return failure(result.reason);
      if (result.state === "member")
        return {
          status: 200,
          body: {
            state: "member",
            organizationId: result.organizationId,
            appearance: result.appearance,
            user: result.user,
          },
        };
      if (result.state === "company_missing")
        return {
          status: 200,
          body: { state: "company_missing", canSetUp: result.canSetUp },
        };
      return { status: 200, body: { state: "not_member" } };
    }

    if (request.method !== "POST")
      return { status: 405, body: { error: "Use POST." } };
    const organizationId =
      typeof request.body === "object" &&
      request.body !== null &&
      !Array.isArray(request.body)
        ? (request.body as { organizationId?: unknown }).organizationId
        : undefined;
    if (typeof organizationId !== "string")
      return {
        status: 400,
        body: { error: "Say which organization (organizationId)." },
      };
    const result = await setUpCompany(request.token, organizationId, deps);
    return result.ok
      ? { status: 200, body: { organizationId: result.organizationId } }
      : failure(result.reason);
  } catch (error) {
    console.error("The account endpoints could not reach the database", error);
    return {
      status: 503,
      body: { error: "The database cannot be reached right now." },
    };
  }
}
