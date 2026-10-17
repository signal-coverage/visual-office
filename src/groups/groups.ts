import {
  MAX_GROUP_FLOORS,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS,
} from "../../shared/groups.ts";

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

/** A role group as the admins see it. */
export interface Group {
  id: string;
  name: string;
  /** Milliseconds since 1970. */
  createdAt: number;
  /** The rooms it opens (ids). */
  floors: string[];
  /** The people in it (user ids). */
  members: string[];
}

export interface GroupLimits {
  groups: number;
  members: number;
  floors: number;
}

export interface GroupList {
  groups: Group[];
  limits: GroupLimits;
}

/** One step of saving a group: a new name, a room given or taken away, a person added or removed. */
export type GroupChange =
  | { kind: "rename"; name: string }
  | { kind: "floor"; floor: string; allowed: boolean }
  | { kind: "member"; userId: string; member: boolean };

const DEFAULT_LIMITS: GroupLimits = {
  groups: MAX_GROUPS,
  members: MAX_GROUP_MEMBERS,
  floors: MAX_GROUP_FLOORS,
};

const COULD_NOT = "Could not change the group. Try again in a moment.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTexts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

function groupOf(value: unknown): Group | null {
  if (!isRecord(value)) return null;
  const { id, name, createdAt, floors, members } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof createdAt !== "number" ||
    !isTexts(floors) ||
    !isTexts(members)
  )
    return null;
  return { id, name, createdAt, floors, members };
}

function limitsOf(value: unknown): GroupLimits {
  if (!isRecord(value)) return DEFAULT_LIMITS;
  const { groups, members, floors } = value;
  return typeof groups === "number" &&
    typeof members === "number" &&
    typeof floors === "number"
    ? { groups, members, floors }
    : DEFAULT_LIMITS;
}

/** Every group and the limits, or null when the server would not say. */
export async function fetchGroups(
  request: Request,
  adminBase: string,
): Promise<GroupList | null> {
  try {
    const response = await request(`${adminBase}/groups`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.groups)) return null;
    const groups = body.groups.map(groupOf);
    if (!groups.every((group) => group !== null)) return null;
    return { groups: groups as Group[], limits: limitsOf(body.limits) };
  } catch {
    return null;
  }
}

/** What a call that changes a group came to: ok, or the server's words. */
type Outcome = { ok: true } | { ok: false; text: string };

async function post(
  request: Request,
  url: string,
  body: unknown,
): Promise<{ answer: unknown } | { text: string }> {
  try {
    const response = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer: unknown = await response.json().catch(() => null);
    if (response.ok) return { answer };
    return {
      text:
        isRecord(answer) && typeof answer.error === "string"
          ? answer.error
          : COULD_NOT,
    };
  } catch {
    return { text: COULD_NOT };
  }
}

async function outcome(
  request: Request,
  url: string,
  body: unknown,
): Promise<Outcome> {
  const reply = await post(request, url, body);
  return "text" in reply ? { ok: false, text: reply.text } : { ok: true };
}

async function withGroup(
  request: Request,
  url: string,
  body: unknown,
): Promise<{ ok: true; group: Group } | { ok: false; text: string }> {
  const reply = await post(request, url, body);
  if ("text" in reply) return { ok: false, text: reply.text };
  const group = isRecord(reply.answer) ? groupOf(reply.answer.group) : null;
  return group ? { ok: true, group } : { ok: false, text: COULD_NOT };
}

/** Makes a group. It starts empty: its rooms and people are added after. */
export const createGroup = (
  request: Request,
  adminBase: string,
  name: string,
) => withGroup(request, `${adminBase}/groups`, { name });

export const renameGroup = (
  request: Request,
  adminBase: string,
  id: string,
  name: string,
) => withGroup(request, `${adminBase}/groups/${id}`, { name });

export const deleteGroup = (request: Request, adminBase: string, id: string) =>
  outcome(request, `${adminBase}/groups/${id}/delete`, {});

export const setGroupMember = (
  request: Request,
  adminBase: string,
  id: string,
  userId: string,
  member: boolean,
) => outcome(request, `${adminBase}/groups/${id}/members`, { userId, member });

export const setGroupFloor = (
  request: Request,
  adminBase: string,
  id: string,
  floor: string,
  allowed: boolean,
) => outcome(request, `${adminBase}/groups/${id}/floors`, { floor, allowed });

/**
 * Makes the changes of a group one after another, and stops at the first one
 * the server refuses: how many were made and why it stopped, so nothing is
 * left half said.
 */
export async function applyChanges(
  request: Request,
  adminBase: string,
  id: string,
  changes: readonly GroupChange[],
): Promise<
  { ok: true; done: number } | { ok: false; done: number; text: string }
> {
  let done = 0;
  for (const change of changes) {
    const result =
      change.kind === "rename"
        ? await renameGroup(request, adminBase, id, change.name)
        : change.kind === "floor"
          ? await setGroupFloor(
              request,
              adminBase,
              id,
              change.floor,
              change.allowed,
            )
          : await setGroupMember(
              request,
              adminBase,
              id,
              change.userId,
              change.member,
            );
    if (!result.ok) return { ok: false, done, text: result.text };
    done++;
  }
  return { ok: true, done };
}
