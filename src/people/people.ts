import {
  moderationReplyText,
  REFUSAL_TEXT,
  type ModerationAction,
  type ModerationReply,
} from "../../shared/moderation.ts";

/** Somebody who signed in, with what they may do. */
export interface Person {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  /** The floors they are head of. */
  headOf: string[];
  /** The rooms an admin gave them an entry for; absent when the server does not say. */
  access?: string[];
  /** The groups they are in; absent when the server does not say. */
  groups?: Array<{ id: string; name: string }>;
  /** Where each room they have an entry for comes from ("direct", "group:<name>"); absent when the server does not say. */
  effectiveAccess?: Array<{ floor: string; sources: string[] }>;
  /** Until when they are banned (milliseconds since 1970), or null; absent when the server does not say. */
  bannedUntil?: number | null;
}

/** A room as the people screen names it. */
export interface FloorLabel {
  id: string;
  name: string;
  /** Everybody may enter it. */
  common: boolean;
}

export interface PeopleList {
  /** The floors there are. */
  floors: string[];
  /** The same floors with their names (the ids stand in when the server says none). */
  floorInfo: FloorLabel[];
  people: Person[];
}

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

const isGroupRef = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const group = value as Record<string, unknown>;
  return typeof group.id === "string" && typeof group.name === "string";
};

const isAccessEntry = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.floor === "string" &&
    Array.isArray(entry.sources) &&
    entry.sources.every((source) => typeof source === "string")
  );
};

const isPerson = (value: unknown): value is Person => {
  if (typeof value !== "object" || value === null) return false;
  const person = value as Record<string, unknown>;
  return (
    typeof person.id === "string" &&
    typeof person.name === "string" &&
    (typeof person.email === "string" || person.email === null) &&
    typeof person.isAdmin === "boolean" &&
    Array.isArray(person.headOf) &&
    person.headOf.every((floor) => typeof floor === "string") &&
    (person.access === undefined ||
      (Array.isArray(person.access) &&
        person.access.every((floor) => typeof floor === "string"))) &&
    (person.groups === undefined ||
      (Array.isArray(person.groups) && person.groups.every(isGroupRef))) &&
    (person.effectiveAccess === undefined ||
      (Array.isArray(person.effectiveAccess) &&
        person.effectiveAccess.every(isAccessEntry))) &&
    (person.bannedUntil === undefined ||
      person.bannedUntil === null ||
      typeof person.bannedUntil === "number")
  );
};

const isLabel = (value: unknown): value is FloorLabel => {
  if (typeof value !== "object" || value === null) return false;
  const label = value as Record<string, unknown>;
  return (
    typeof label.id === "string" &&
    typeof label.name === "string" &&
    typeof label.common === "boolean"
  );
};

/** The names of the floors from what the server sent, or the ids when it sent none. */
function labelsOf(floors: string[], sent: unknown): FloorLabel[] {
  if (Array.isArray(sent) && sent.every(isLabel)) return sent;
  return floors.map((id) => ({ id, name: id, common: false }));
}

/** Everybody who signed in and the floors there are, or null when the server would not say. */
export async function fetchPeople(
  request: Request,
  adminBase: string,
): Promise<PeopleList | null> {
  try {
    const response = await request(`${adminBase}/people`);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      floors?: unknown;
      floorInfo?: unknown;
      people?: unknown;
    } | null;
    if (
      !Array.isArray(body?.floors) ||
      !body.floors.every((floor) => typeof floor === "string") ||
      !Array.isArray(body.people) ||
      !body.people.every(isPerson)
    )
      return null;
    return {
      floors: body.floors,
      floorInfo: labelsOf(body.floors, body.floorInfo),
      people: body.people,
    };
  } catch {
    return null;
  }
}

/** Names somebody head of a floor, or takes it away. Whether the server did it. */
export async function setHead(
  request: Request,
  adminBase: string,
  floor: string,
  userId: string,
  head: boolean,
): Promise<boolean> {
  try {
    const response = await request(`${adminBase}/floors/${floor}/heads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, head }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The list with somebody made head of a floor, or no longer. The list it was given is not changed. */
export function withHead(
  people: readonly Person[],
  userId: string,
  floor: string,
  head: boolean,
): Person[] {
  return people.map((person) => {
    if (person.id !== userId) return person;
    const others = person.headOf.filter((f) => f !== floor);
    return { ...person, headOf: (head ? [...others, floor] : others).sort() };
  });
}

/** What came of asking the server to moderate somebody: the words to show, whether it was done or not. */
export async function moderatePerson(
  request: Request,
  adminBase: string,
  action: ModerationAction,
  userId: string,
  minutes?: number,
): Promise<{ ok: boolean; text: string }> {
  try {
    const response = await request(`${adminBase}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        userId,
        ...(action === "ban" && minutes !== undefined ? { minutes } : {}),
      }),
    });
    const body = (await response.json()) as
      (Partial<ModerationReply> & { error?: unknown }) | null;
    if (response.ok && body?.ok === true)
      return { ok: true, text: moderationReplyText(body as ModerationReply) };
    return {
      ok: false,
      text:
        typeof body?.error === "string" ? body.error : REFUSAL_TEXT.unavailable,
    };
  } catch {
    return { ok: false, text: REFUSAL_TEXT.unavailable };
  }
}

/** Whether somebody may enter a room, from what the list says about them (the server decides again at the door). */
export function canEnterFloor(person: Person, floor: FloorLabel): boolean {
  return (
    person.isAdmin ||
    floor.common ||
    person.headOf.includes(floor.id) ||
    (person.access ?? []).includes(floor.id) ||
    groupsGiving(person, floor.id).length > 0
  );
}

const GROUP_PREFIX = "group:";

/** The names of the groups that give somebody a room. */
export function groupsGiving(person: Person, floorId: string): string[] {
  const sources =
    person.effectiveAccess?.find((entry) => entry.floor === floorId)?.sources ??
    [];
  return sources
    .filter((source) => source.startsWith(GROUP_PREFIX))
    .map((source) => source.slice(GROUP_PREFIX.length));
}

/**
 * Whether the checkbox of this room is not for changing: what already lets
 * somebody in (see `entryIsFixed`), or a group that is their only way in. When
 * they also have an entry of their own, that one can still be taken away.
 */
export function entryIsLocked(person: Person, floor: FloorLabel): boolean {
  if (entryIsFixed(person, floor)) return true;
  return (
    groupsGiving(person, floor.id).length > 0 &&
    !(person.access ?? []).includes(floor.id)
  );
}

/** Whether the entry for this room is not somebody's to give or take: they are in anyway (admin, head, common room). */
export function entryIsFixed(person: Person, floor: FloorLabel): boolean {
  return person.isAdmin || floor.common || person.headOf.includes(floor.id);
}

/** Names the rooms somebody was given an entry for, or no longer. The list it was given is not changed. */
export function withAccess(
  people: readonly Person[],
  userId: string,
  floor: string,
  allowed: boolean,
): Person[] {
  return people.map((person) => {
    if (person.id !== userId) return person;
    const others = (person.access ?? []).filter((f) => f !== floor);
    return {
      ...person,
      access: (allowed ? [...others, floor] : others).sort(),
      ...(person.effectiveAccess
        ? {
            effectiveAccess: withDirectSource(
              person.effectiveAccess,
              floor,
              allowed,
            ),
          }
        : {}),
    };
  });
}

/** The sources of somebody's rooms with their own entry for one of them given or taken away. */
function withDirectSource(
  entries: ReadonlyArray<{ floor: string; sources: string[] }>,
  floor: string,
  direct: boolean,
): Array<{ floor: string; sources: string[] }> {
  const others = entries.filter((entry) => entry.floor !== floor);
  const groups = (
    entries.find((entry) => entry.floor === floor)?.sources ?? []
  ).filter((source) => source !== "direct");
  const sources = direct ? ["direct", ...groups] : groups;
  return (sources.length > 0 ? [...others, { floor, sources }] : others).sort(
    (a, b) => a.floor.localeCompare(b.floor),
  );
}
