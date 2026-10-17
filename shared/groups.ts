import { MAX_FLOOR_ID_LENGTH } from "./floors.ts";

/** A group of people who get the same rooms ("Human Resources"). */
export const MAX_GROUPS = 30;
export const MAX_GROUP_MEMBERS = 200;
export const MAX_GROUP_FLOORS = 40;
export const MAX_GROUP_NAME_LENGTH = 40;

const GROUP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** What is left of a group's name once control characters, extra spaces and the excess length are gone, or null when nothing is. */
export function sanitizeGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_GROUP_NAME_LENGTH)
    .trim();
  return name || null;
}

/** The id of a group, if `raw` is one: lowercase letters, digits and single hyphens, short. Never fixes anything up. */
export function sanitizeGroupId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < 1 || raw.length > MAX_FLOOR_ID_LENGTH) return null;
  return GROUP_ID_PATTERN.test(raw) ? raw : null;
}

/** An id made from a name ("Human Resources" gives "human-resources"), or null when nothing usable is left. */
export function slugFromGroupName(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_FLOOR_ID_LENGTH)
    .replace(/-+$/, "");
  return sanitizeGroupId(slug);
}

/** Where an entry comes from, as the admin screens show it: "direct" or "group:<name>". */
export const DIRECT_SOURCE = "direct";
export const groupSource = (name: string) => `group:${name}`;

/** A room somebody may enter because of an entry or a group, and why. */
export interface AccessEntry {
  floor: string;
  /** "direct" first, then "group:<name>" by name. */
  sources: string[];
}

/**
 * The rooms somebody has an entry for: the union of the entries an admin gave
 * them one by one and the rooms of every group they are in, each with where it
 * comes from. Rooms they enter for another reason (admin, head, common) are not
 * listed: this is only about entries.
 */
export function effectiveAccess(
  direct: readonly string[],
  groups: ReadonlyArray<{ name: string; floors: readonly string[] }>,
): AccessEntry[] {
  const sources = new Map<string, string[]>();
  const add = (floor: string, source: string) => {
    const list = sources.get(floor) ?? [];
    if (!list.includes(source)) list.push(source);
    sources.set(floor, list);
  };
  for (const floor of direct) add(floor, DIRECT_SOURCE);
  for (const group of [...groups].sort((a, b) => a.name.localeCompare(b.name)))
    for (const floor of group.floors) add(floor, groupSource(group.name));
  return [...sources]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([floor, list]) => ({ floor, sources: list }));
}
