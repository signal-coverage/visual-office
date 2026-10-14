/**
 * How a player looks. Each part is an index into a fixed list instead of a
 * free colour or model, so what a client can send is a handful of small
 * numbers the server can check exactly, and adding an option is one line here.
 * The first colours are the prototype's. A list only ever grows at its end, and
 * index 0 of every extra option is the plain one (nothing worn), so a look saved
 * before an option existed keeps meaning the same thing. A part that points
 * past the end of its list is replaced, never trusted (see sanitizeAppearance
 * and parseAppearance).
 */

export const SKIN_TONES = [
  0xf6d7b8, 0xe8b98f, 0xc98c5d, 0x9a6440, 0x6b4128, 0xfbe3d0, 0xb8774a,
  0x4a2c1b,
] as const;

export const HAIR_COLORS = [
  0x2b1d14, 0x5a3a22, 0xa8743a, 0xe0c27a, 0xb8452e, 0x8c8c8c, 0x0e0b0a,
  0x8b5a3c, 0xf1ead8, 0xd9d9d9, 0x3b82f6, 0xf472b6, 0x34d399, 0x8b5cf6,
] as const;
/** The hair colours from this index on are the fun ones: nobody is born with them. */
export const FUN_HAIR_FROM = 10;

export const HAIR_STYLES = [
  "short",
  "long",
  "none",
  "buzz",
  "bun",
  "ponytail",
  "curly",
  "mohawk",
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const FACIAL_HAIR = ["none", "stubble", "moustache", "beard"] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

export const GLASSES = ["none", "round", "square", "sunglasses"] as const;
export type Glasses = (typeof GLASSES)[number];

/** Worn over the hair; its colour is the shirt's. */
export const HEADWEAR = ["none", "cap", "beanie"] as const;
export type Headwear = (typeof HEADWEAR)[number];

/** "long" (sleeves down to the hands) is what everybody wore before there was a choice. */
export const TOPS = ["long", "tee", "hoodie", "collar", "blazer"] as const;
export type Top = (typeof TOPS)[number];

export const SHIRT_COLORS = [
  0xd9643a, 0x3f7d5c, 0x3a5f8f, 0xe8c547, 0xf2efe8, 0x7a3e5c, 0x2f3340,
  0xc0392b, 0x7ec4e8, 0x7b5bb8, 0xe58fb0, 0x8a9a3c,
] as const;

export const PANTS_COLORS = [
  0x2f3640, 0x4a4f6b, 0x7a6a55, 0x1f2a24, 0xa3a8ad, 0x15171a, 0x1d2f55,
  0xb59f78, 0x5b4030, 0x5d7fa8,
] as const;

export const SHOES = [
  "none",
  "dark",
  "white",
  "red",
  "blue",
  "yellow",
] as const;
export type Shoes = (typeof SHOES)[number];
/** The colour of each of SHOES; null is no shoes (bare feet, what everybody had before). */
export const SHOE_COLORS: ReadonlyArray<number | null> = [
  null,
  0x1c1c1f,
  0xf2f2f2,
  0xd23b3b,
  0x2f6fd0,
  0xe8c547,
];

/** What hangs around the neck, wrists or ears: one at a time. */
export const ACCESSORIES = [
  "none",
  "headphones",
  "lanyard",
  "watch",
  "scarf",
] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export interface Appearance {
  skin: number;
  hairColor: number;
  /** An index into HAIR_STYLES. */
  hairStyle: number;
  shirt: number;
  pants: number;
  /** An index into FACIAL_HAIR, coloured as the hair. */
  facialHair: number;
  /** An index into GLASSES. */
  glasses: number;
  /** An index into HEADWEAR. */
  headwear: number;
  /** An index into TOPS. */
  top: number;
  /** An index into SHOES. */
  shoes: number;
  /** An index into ACCESSORIES. */
  accessory: number;
}

type CoreField = "skin" | "hairColor" | "hairStyle" | "shirt" | "pants";
export type ExtraField = Exclude<keyof Appearance, CoreField>;

/** The five parts every look has had from the start: a look without them is nothing. */
const CORE_FIELDS: ReadonlyArray<readonly [CoreField, number]> = [
  ["skin", SKIN_TONES.length],
  ["hairColor", HAIR_COLORS.length],
  ["hairStyle", HAIR_STYLES.length],
  ["shirt", SHIRT_COLORS.length],
  ["pants", PANTS_COLORS.length],
];

/**
 * The parts added later. A look saved without them (an old row, an old browser,
 * an old client) is read with each of them at 0, the plain choice.
 */
export const EXTRA_FIELDS: ReadonlyArray<readonly [ExtraField, number]> = [
  ["facialHair", FACIAL_HAIR.length],
  ["glasses", GLASSES.length],
  ["headwear", HEADWEAR.length],
  ["top", TOPS.length],
  ["shoes", SHOES.length],
  ["accessory", ACCESSORIES.length],
];

const FIELDS: ReadonlyArray<readonly [keyof Appearance, number]> = [
  ...CORE_FIELDS,
  ...EXTRA_FIELDS,
];

const isChoice = (value: unknown, count: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < count;

/** The look with every extra part plain: what a look from before the extras means. */
function plainExtras(look: Appearance): Appearance {
  const plain = { ...look };
  for (const [field] of EXTRA_FIELDS) plain[field] = 0;
  return plain;
}

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
 * A look that somebody really chose, read back from where it was kept: the
 * five original parts have to be valid choices and an extra part, when it is
 * there, too; otherwise it is nothing (and not a look patched up with
 * defaults, which nobody picked). A look saved before the extra parts existed
 * has none of them, and is read with each at its plain choice.
 */
export function parseAppearance(raw: unknown): Appearance | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const source = raw as Record<string, unknown>;
  const look = {} as Appearance;
  for (const [field, count] of CORE_FIELDS) {
    const value = source[field];
    if (!isChoice(value, count)) return null;
    look[field] = value;
  }
  for (const [field, count] of EXTRA_FIELDS) {
    const value = source[field];
    if (value === undefined) look[field] = 0;
    else if (isChoice(value, count)) look[field] = value;
    else return null;
  }
  return look;
}

/** The name of every part of a look, as the room's state calls it. */
export const APPEARANCE_FIELDS: ReadonlyArray<keyof Appearance> = FIELDS.map(
  ([field]) => field,
);

/** Just the look of anything that has one (a player in the room, say). */
export function lookOf(source: Appearance): Appearance {
  const look = {} as Appearance;
  for (const field of APPEARANCE_FIELDS) look[field] = source[field];
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
 * How many of each list the default look picks from: the ones the prototype
 * had, so a name that looked a certain way before the options grew still does.
 */
const DEFAULT_POOL = {
  skin: 5,
  hairColor: 6,
  hairStyle: 2,
  shirt: 6,
  pants: 5,
};

/**
 * What somebody looks like when they have not chosen: derived from the name, so
 * everybody differs a bit and the same name is always recognisable. Nothing
 * extra is worn.
 */
export function defaultAppearance(name: string): Appearance {
  const hash = hashOf(name);
  return {
    skin: hash % DEFAULT_POOL.skin,
    hairColor: (hash >>> 3) % DEFAULT_POOL.hairColor,
    // Not bald unless they ask for it
    hairStyle: (hash >>> 5) % DEFAULT_POOL.hairStyle,
    shirt: (hash >>> 7) % DEFAULT_POOL.shirt,
    pants: (hash >>> 11) % DEFAULT_POOL.pants,
    facialHair: 0,
    glasses: 0,
    headwear: 0,
    top: 0,
    shoes: 0,
    accessory: 0,
  };
}

/** Hair styles that sit on top of the head, and so vanish under a hat. */
const HIDDEN_BY_HEADWEAR: ReadonlyArray<HairStyle> = ["mohawk", "bun", "curly"];
/** Tops with a collar, which a scarf would hide. */
const COLLARED: ReadonlyArray<Top> = ["collar", "blazer"];

/**
 * A look for the "surprise me" button: any of the colours and styles, but in a
 * combination that makes sense, with the extras mostly left off so it reads as
 * a person and not a costume.
 */
export function randomAppearance(
  random: () => number = Math.random,
): Appearance {
  const pick = (count: number) =>
    Math.min(count - 1, Math.floor(random() * count));
  /** The plain choice with chance `plain`, otherwise any of the others. */
  const mostlyPlain = (count: number, plain: number) =>
    random() < plain ? 0 : 1 + pick(count - 1);

  const headwear = mostlyPlain(HEADWEAR.length, 0.75);
  const hairStyles = HAIR_STYLES.flatMap((style, index) =>
    headwear !== 0 && HIDDEN_BY_HEADWEAR.includes(style) ? [] : [index],
  );
  const top = pick(TOPS.length);
  const accessories = ACCESSORIES.flatMap((accessory, index) =>
    (accessory === "headphones" && headwear !== 0) ||
    (accessory === "scarf" && COLLARED.includes(TOPS[top]))
      ? []
      : [index],
  );
  return {
    skin: pick(SKIN_TONES.length),
    hairColor:
      random() < 0.85
        ? pick(FUN_HAIR_FROM)
        : FUN_HAIR_FROM + pick(HAIR_COLORS.length - FUN_HAIR_FROM),
    hairStyle: hairStyles[pick(hairStyles.length)],
    shirt: pick(SHIRT_COLORS.length),
    pants: pick(PANTS_COLORS.length),
    facialHair: mostlyPlain(FACIAL_HAIR.length, 0.65),
    glasses: mostlyPlain(GLASSES.length, 0.65),
    headwear,
    top,
    shoes: mostlyPlain(SHOES.length, 0.1),
    accessory: random() < 0.55 ? 0 : accessories[pick(accessories.length)],
  };
}

export function appearanceColors(appearance: Appearance) {
  return {
    skin: SKIN_TONES[appearance.skin],
    hair: HAIR_COLORS[appearance.hairColor],
    shirt: SHIRT_COLORS[appearance.shirt],
    pants: PANTS_COLORS[appearance.pants],
    shoe: SHOE_COLORS[appearance.shoes],
  };
}

/** Reads a saved appearance, tolerating nothing saved or text that is not JSON. */
export function appearanceFromJson(
  json: string | null,
  fallback: Appearance,
): Appearance {
  if (!json) return fallback;
  try {
    // A look saved before the extras existed has none: it is plain there, not the fallback's
    return sanitizeAppearance(JSON.parse(json), plainExtras(fallback));
  } catch {
    return fallback;
  }
}
