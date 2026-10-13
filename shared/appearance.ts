/**
 * How a player looks. Each part is an index into a fixed palette instead of a
 * free colour or model, so what a client can send is a handful of small
 * numbers the server can check exactly, and adding an option is one line here.
 */

export const SKIN_TONES = [
  0xffe0bd, 0xf1c6a0, 0xd9a06f, 0xb97d4f, 0x8a5a38, 0x5c3a24,
] as const;

export const HAIR_COLORS = [
  0x111111, 0x2b1d14, 0x6b4a2b, 0xc9a45c, 0xb5482a, 0xd9d4c7, 0x3b5bdb,
  0xd6409f,
] as const;

export const HAIR_STYLES = ["short", "long", "none"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const SHIRT_COLORS = [
  0xe5484d, 0xf08c3a, 0xf5c542, 0x46b06a, 0x2eb5a6, 0x3b82f6, 0x5b5bd6,
  0x9b5de5, 0xe668a7, 0xeeeeee,
] as const;

export const PANTS_COLORS = [
  0x2b3140, 0x4a4e57, 0x6b5a45, 0x1d3a6b, 0x3a4a35, 0x111111,
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
