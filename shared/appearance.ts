/**
 * How a player looks. Each part is an index into a fixed palette instead of a
 * free colour or model, so what a client can send is a handful of small
 * numbers the server can check exactly, and adding an option is one line here.
 * The colours are the prototype's. A look saved when the palettes were longer
 * may point past their end: such a part is replaced, never trusted
 * (see sanitizeAppearance and parseAppearance).
 */

export const SKIN_TONES = [
  0xf6d7b8, 0xe8b98f, 0xc98c5d, 0x9a6440, 0x6b4128,
] as const;

export const HAIR_COLORS = [
  0x2b1d14, 0x5a3a22, 0xa8743a, 0xe0c27a, 0xb8452e, 0x8c8c8c,
] as const;

export const HAIR_STYLES = ["short", "long", "none"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const SHIRT_COLORS = [
  0xd9643a, 0x3f7d5c, 0x3a5f8f, 0xe8c547, 0xf2efe8, 0x7a3e5c,
] as const;

export const PANTS_COLORS = [
  0x2f3640, 0x4a4f6b, 0x7a6a55, 0x1f2a24, 0xa3a8ad,
] as const;

export interface Appearance {
  skin: number;
  hairColor: number;
  /** An index into HAIR_STYLES. */
  hairStyle: number;
  shirt: number;
  pants: number;
}

const FIELDS: ReadonlyArray<readonly [keyof Appearance, number]> = [
  ["skin", SKIN_TONES.length],
  ["hairColor", HAIR_COLORS.length],
  ["hairStyle", HAIR_STYLES.length],
  ["shirt", SHIRT_COLORS.length],
  ["pants", PANTS_COLORS.length],
];

const isChoice = (value: unknown, count: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < count;

/**
 * Cleans an appearance coming from the user or, on the server, from an
 * untrusted client: every field that is not a valid choice is replaced by the
 * fallback's, and anything else in the object is dropped.
 */
export function sanitizeAppearance(
  raw: unknown,
  fallback: Appearance,
): Appearance {
  const source =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const result = { ...fallback };
  for (const [field, count] of FIELDS) {
    const value = source[field];
    if (isChoice(value, count)) result[field] = value;
  }
  return result;
}

/**
 * A look that somebody really chose, read back from where it was kept: every
 * part has to be a valid choice, otherwise it is nothing (and not a look
 * patched up with defaults, which nobody picked).
 */
export function parseAppearance(raw: unknown): Appearance | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const source = raw as Record<string, unknown>;
  const look = {} as Appearance;
  for (const [field, count] of FIELDS) {
    const value = source[field];
    if (!isChoice(value, count)) return null;
    look[field] = value;
  }
  return look;
}

/** Whether two looks are the same choices. */
export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return FIELDS.every(([field]) => a[field] === b[field]);
}

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * What somebody looks like when they have not chosen: derived from the name, so
 * everybody differs a bit and the same name is always recognisable.
 */
export function defaultAppearance(name: string): Appearance {
  const hash = hashOf(name);
  return {
    skin: hash % SKIN_TONES.length,
    hairColor: (hash >>> 3) % HAIR_COLORS.length,
    // Not bald unless they ask for it
    hairStyle: (hash >>> 5) % (HAIR_STYLES.length - 1),
    shirt: (hash >>> 7) % SHIRT_COLORS.length,
    pants: (hash >>> 11) % PANTS_COLORS.length,
  };
}

/** Any look at all, for the "surprise me" button. */
export function randomAppearance(
  random: () => number = Math.random,
): Appearance {
  const pick = (count: number) =>
    Math.min(count - 1, Math.floor(random() * count));
  return {
    skin: pick(SKIN_TONES.length),
    hairColor: pick(HAIR_COLORS.length),
    hairStyle: pick(HAIR_STYLES.length),
    shirt: pick(SHIRT_COLORS.length),
    pants: pick(PANTS_COLORS.length),
  };
}

export function appearanceColors(appearance: Appearance) {
  return {
    skin: SKIN_TONES[appearance.skin],
    hair: HAIR_COLORS[appearance.hairColor],
    shirt: SHIRT_COLORS[appearance.shirt],
    pants: PANTS_COLORS[appearance.pants],
  };
}

/** Reads a saved appearance, tolerating nothing saved or text that is not JSON. */
export function appearanceFromJson(
  json: string | null,
  fallback: Appearance,
): Appearance {
  if (!json) return fallback;
  try {
    return sanitizeAppearance(JSON.parse(json), fallback);
  } catch {
    return fallback;
  }
}
