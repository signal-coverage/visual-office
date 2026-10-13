import type { AuthResult } from "./authenticate.ts";
import type { Roles, UserRecord } from "./userStore.ts";

/**
 * Who is calling the admin API. The server's own tools hold the shared secret
 * and may do anything; a person brings their sign-in token and may do what their
 * roles allow.
 */
export type Actor =
  { kind: "machine" } | { kind: "user"; user: UserRecord; roles: Roles };

const MAX_NAME_LENGTH = 64;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Whether this caller may edit a floor: its head, or an admin. */
export function canEditFloor(actor: Actor, floor: string): boolean {
  if (actor.kind === "machine") return true;
  return actor.roles.admin || actor.roles.headOf.includes(floor);
}

/**
 * Who is acting, for the lock's holder or a layout's author. A person is who
 * their token says, whatever the request claims; the server's own tools say it
 * in the request (`key`), and nothing is made up when they do not.
 */
export function identityOf(
  actor: Actor,
  body: unknown,
  key: "holder" | "author",
): string | null {
  if (actor.kind === "user") return actor.user.id;
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return null;
  const name = (body as Record<string, unknown>)[key];
  if (typeof name !== "string" || CONTROL_CHARS.test(name)) return null;
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH ? name : null;
}

export interface ResolveDeps {
  /** Who a sign-in token belongs to; null when sign-in is off. */
  authenticate: (token: unknown) => Promise<AuthResult | null>;
  rolesOf: (userId: string) => Promise<Roles>;
}

/**
 * Who is calling the admin API: the server's own tools (the shared secret was
 * right), a person (their sign-in token is good), or nobody. A person's roles
 * are looked up here, so they are always the current ones.
 */
export async function resolveActor(
  request: { header: string | undefined; machine: boolean },
  deps: ResolveDeps,
): Promise<Actor | null> {
  if (request.machine) return { kind: "machine" };
  const token = /^Bearer (\S+)$/.exec(request.header ?? "")?.[1];
  if (!token) return null;
  const who = await deps.authenticate(token);
  if (!who?.ok) return null;
  return {
    kind: "user",
    user: who.user,
    roles: await deps.rolesOf(who.user.id),
  };
}
