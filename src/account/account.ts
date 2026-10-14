import { parseAppearance, type Appearance } from "../../shared/appearance.ts";

/** What a person who just signed in should be shown. */
export type Session =
  | {
      state: "member";
      organizationId: string;
      /** The look they chose last, or null if they never chose one (or it is not valid). */
      appearance: Appearance | null;
      /** Whether the company lets people choose their own name. */
      canEditName: boolean;
      user: {
        id: string;
        name: string;
        email: string | null;
        isAdmin: boolean;
      };
    }
  /** Signed in, but not in the company: they need an invitation. */
  | { state: "not_member" }
  /** Nobody has set the company up. Only the first admins can. */
  | { state: "company_missing"; canSetUp: boolean }
  /** Could not find out. `signedOut`: the server does not know the token, so sign in again. */
  | { state: "error"; signedOut: boolean };

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

const COULD_NOT_FIND_OUT: Session = { state: "error", signedOut: false };

/** What the game server says the signed-in person is: in the company, in need of an invitation, or first to set it up. */
export async function fetchSession(
  request: Request,
  serverUrl: string,
): Promise<Session> {
  try {
    const response = await request(`${serverUrl}/account/session`);
    if (response.status === 401) return { state: "error", signedOut: true };
    if (!response.ok) return COULD_NOT_FIND_OUT;
    const body = (await response.json()) as Record<string, unknown> | null;

    if (body?.state === "not_member") return { state: "not_member" };
    if (body?.state === "company_missing")
      return typeof body.canSetUp === "boolean"
        ? { state: "company_missing", canSetUp: body.canSetUp }
        : COULD_NOT_FIND_OUT;
    if (body?.state === "member") {
      const user = body.user as Record<string, unknown> | undefined;
      if (
        typeof body.organizationId === "string" &&
        user &&
        typeof user.id === "string" &&
        typeof user.name === "string" &&
        (typeof user.email === "string" || user.email === null) &&
        typeof user.isAdmin === "boolean"
      )
        return {
          state: "member",
          organizationId: body.organizationId,
          appearance: parseAppearance(body.appearance),
          canEditName: body.canEditName === true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
          },
        };
    }
    return COULD_NOT_FIND_OUT;
  } catch {
    return COULD_NOT_FIND_OUT;
  }
}

/** Makes an organization the company. Whether the server did it. */
export async function registerCompany(
  request: Request,
  serverUrl: string,
  organizationId: string,
): Promise<boolean> {
  try {
    const response = await request(`${serverUrl}/account/company`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
