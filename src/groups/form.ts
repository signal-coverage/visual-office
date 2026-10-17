import {
  MAX_GROUP_NAME_LENGTH,
  sanitizeGroupName,
} from "../../shared/groups.ts";
import type { Group, GroupChange, GroupLimits } from "./groups";

/** What the group editor holds while somebody is typing: not saved until they say so. */
export interface GroupDraft {
  name: string;
  /** Room ids. */
  floors: string[];
  /** User ids. */
  members: string[];
}

export const EMPTY_NAME_ERROR = "Give the group a name.";
export const NAME_TOO_LONG_ERROR = `The name can have at most ${MAX_GROUP_NAME_LENGTH} characters.`;
export const NAME_TAKEN_ERROR = "There is a group with that name.";
export const tooManyGroupsError = (max: number) =>
  `There are already ${max} groups: delete one first.`;
export const tooManyMembersError = (max: number) =>
  `A group has at most ${max} people.`;
export const tooManyFloorsError = (max: number) =>
  `A group has at most ${max} rooms.`;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** The draft to start editing from: the group as it is, or an empty one for a new group. */
export function draftOf(group: Group | null): GroupDraft {
  return group
    ? {
        name: group.name,
        floors: [...group.floors],
        members: [...group.members],
      }
    : { name: "", floors: [], members: [] };
}

/**
 * Whether the draft can be saved: the cleaned name, or the reason it cannot.
 * Only what the server would refuse anyway, said before asking.
 */
export function validateGroupForm(
  draft: GroupDraft,
  context: {
    groups: ReadonlyArray<{ id: string; name: string }>;
    limits: GroupLimits;
    /** The group being edited, or null for a new one. */
    currentId: string | null;
  },
): { ok: true; name: string } | { ok: false; error: string } {
  const name = sanitizeGroupName(draft.name);
  if (!name) return { ok: false, error: EMPTY_NAME_ERROR };
  // The server cuts a name at its limit: saying so beats saving something else than what was typed
  const typed = draft.name
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  if (typed.length > MAX_GROUP_NAME_LENGTH)
    return { ok: false, error: NAME_TOO_LONG_ERROR };
  const lower = name.toLowerCase();
  if (
    context.groups.some(
      (group) =>
        group.id !== context.currentId && group.name.toLowerCase() === lower,
    )
  )
    return { ok: false, error: NAME_TAKEN_ERROR };
  if (
    context.currentId === null &&
    context.groups.length >= context.limits.groups
  )
    return { ok: false, error: tooManyGroupsError(context.limits.groups) };
  if (new Set(draft.members).size > context.limits.members)
    return { ok: false, error: tooManyMembersError(context.limits.members) };
  if (new Set(draft.floors).size > context.limits.floors)
    return { ok: false, error: tooManyFloorsError(context.limits.floors) };
  return { ok: true, name };
}

/**
 * The steps that turn a group (null for a new one, which has nothing) into the
 * draft: a new name, then rooms given and taken away, then people added and
 * removed. Each entry once, and nothing for what is already so.
 */
export function planChanges(
  group: Group | null,
  draft: GroupDraft,
): GroupChange[] {
  const changes: GroupChange[] = [];
  const name = sanitizeGroupName(draft.name);
  if (group && name && name !== group.name)
    changes.push({ kind: "rename", name });

  const floors = new Set(draft.floors);
  const hadFloors = new Set(group?.floors ?? []);
  for (const floor of floors)
    if (!hadFloors.has(floor))
      changes.push({ kind: "floor", floor, allowed: true });
  for (const floor of hadFloors)
    if (!floors.has(floor))
      changes.push({ kind: "floor", floor, allowed: false });

  const members = new Set(draft.members);
  const hadMembers = new Set(group?.members ?? []);
  for (const userId of members)
    if (!hadMembers.has(userId))
      changes.push({ kind: "member", userId, member: true });
  for (const userId of hadMembers)
    if (!members.has(userId))
      changes.push({ kind: "member", userId, member: false });
  return changes;
}

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The people whose name or email has what was typed, ignoring case and accents. Everybody for an empty search. */
export function filterPeople<T extends { name: string; email: string | null }>(
  people: readonly T[],
  query: string,
): T[] {
  const wanted = plain(query.trim());
  if (!wanted) return [...people];
  return people.filter((person) =>
    plain(`${person.name} ${person.email ?? ""}`).includes(wanted),
  );
}

/** A room a group can be given. */
export interface RoomChoice {
  id: string;
  name: string;
  /** Archived: only here because the group still has it, so it can be taken away. */
  archived: boolean;
}

/**
 * The rooms to choose from for a group: the ones in use that are not common
 * (everybody enters those anyway), and any archived one the group still has.
 */
export function roomChoices(
  floors: ReadonlyArray<{
    id: string;
    name: string;
    common: boolean;
    archivedAt?: number;
  }>,
  selected: readonly string[],
): RoomChoice[] {
  return floors
    .filter((floor) =>
      floor.archivedAt === undefined
        ? !floor.common
        : selected.includes(floor.id),
    )
    .map((floor) => ({
      id: floor.id,
      name: floor.name,
      archived: floor.archivedAt !== undefined,
    }));
}
