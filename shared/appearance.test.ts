import { describe, expect, it } from "vitest";
import {
  ACCESSORIES,
  appearanceColors,
  APPEARANCE_FIELDS,
  lookOf,
  EXTRA_FIELDS,
  FACIAL_HAIR,
  FUN_HAIR_FROM,
  GLASSES,
  HEADWEAR,
  SHOE_COLORS,
  SHOES,
  TOPS,
  parseAppearance,
  sameAppearance,
  appearanceFromJson,
  defaultAppearance,
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  randomAppearance,
  SHIRT_COLORS,
  SKIN_TONES,
  sanitizeAppearance,
  type Appearance,
} from "./appearance.ts";

const PLAIN = {
  facialHair: 0,
  glasses: 0,
  headwear: 0,
  top: 0,
  shoes: 0,
  accessory: 0,
};

const base: Appearance = {
  skin: 1,
  hairColor: 2,
  hairStyle: 1,
  shirt: 3,
  pants: 1,
  ...PLAIN,
};

/** The look as it was stored before the extra options existed. */
const OLD_SHAPE = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };

/** A small deterministic generator, so the random looks of a test are the same every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("the palettes", () => {
  it("each offer a real choice and fit in one byte", () => {
    for (const palette of [
      SKIN_TONES,
      HAIR_COLORS,
      SHIRT_COLORS,
      PANTS_COLORS,
      HAIR_STYLES,
      FACIAL_HAIR,
      GLASSES,
      HEADWEAR,
      TOPS,
      SHOES,
      ACCESSORIES,
    ]) {
      expect(palette.length).toBeGreaterThanOrEqual(3);
      expect(palette.length).toBeLessThanOrEqual(255);
    }
  });

  it("have no repeated colour, which would be a choice that changes nothing", () => {
    for (const palette of [
      SKIN_TONES,
      HAIR_COLORS,
      SHIRT_COLORS,
      PANTS_COLORS,
    ]) {
      expect(new Set(palette).size).toBe(palette.length);
    }
  });
});

describe("the prototype's colours", () => {
  it("keeps its skin, hair, shirt and pants colours at the same index, and only appends", () => {
    expect([...SKIN_TONES].slice(0, 5)).toEqual([
      0xf6d7b8, 0xe8b98f, 0xc98c5d, 0x9a6440, 0x6b4128,
    ]);
    expect([...HAIR_COLORS].slice(0, 6)).toEqual([
      0x2b1d14, 0x5a3a22, 0xa8743a, 0xe0c27a, 0xb8452e, 0x8c8c8c,
    ]);
    expect([...SHIRT_COLORS].slice(0, 6)).toEqual([
      0xd9643a, 0x3f7d5c, 0x3a5f8f, 0xe8c547, 0xf2efe8, 0x7a3e5c,
    ]);
    expect([...PANTS_COLORS].slice(0, 5)).toEqual([
      0x2f3640, 0x4a4f6b, 0x7a6a55, 0x1f2a24, 0xa3a8ad,
    ]);
  });

  it("offers more of every colour than the prototype did", () => {
    expect(SKIN_TONES.length).toBeGreaterThan(5);
    expect(HAIR_COLORS.length).toBeGreaterThan(6);
    expect(SHIRT_COLORS.length).toBeGreaterThan(6);
    expect(PANTS_COLORS.length).toBeGreaterThan(5);
  });

  it("keeps the same first hair styles, in the same order, and appends the new ones", () => {
    expect([...HAIR_STYLES].slice(0, 3)).toEqual(["short", "long", "none"]);
    expect(HAIR_STYLES.length).toBeGreaterThan(5);
  });

  it("starts every extra option at the plain choice an old look implies", () => {
    expect(FACIAL_HAIR[0]).toBe("none");
    expect(GLASSES[0]).toBe("none");
    expect(HEADWEAR[0]).toBe("none");
    expect(TOPS[0]).toBe("long");
    expect(SHOES[0]).toBe("none");
    expect(SHOE_COLORS[0]).toBeNull();
    expect(ACCESSORIES[0]).toBe("none");
  });

  it("keeps the fun hair colours after the natural ones", () => {
    expect(FUN_HAIR_FROM).toBeGreaterThan(6);
    expect(FUN_HAIR_FROM).toBeLessThan(HAIR_COLORS.length);
  });

  it("has a colour for every shoe, none being no shoes", () => {
    expect(SHOE_COLORS.length).toBe(SHOES.length);
    const colours = SHOE_COLORS.filter((c) => c !== null);
    expect(new Set(colours).size).toBe(colours.length);
  });
});

describe("a look saved with the old, longer palettes", () => {
  // Past the end of every palette, whatever it was when it was saved
  const old = { skin: 40, hairColor: 40, hairStyle: 2, shirt: 40, pants: 40 };
  const fallback = defaultAppearance("Ana");

  it("keeps the parts that still exist and replaces the rest, never going past a palette", () => {
    const result = sanitizeAppearance(old, fallback);
    expect(result.hairStyle).toBe(old.hairStyle);
    expect(result.skin).toBe(fallback.skin);
    expect(result.hairColor).toBe(fallback.hairColor);
    expect(result.shirt).toBe(fallback.shirt);
    expect(result.pants).toBe(fallback.pants);
    expect(result.hairColor).toBeLessThan(HAIR_COLORS.length);
    expect(result.shirt).toBeLessThan(SHIRT_COLORS.length);
  });

  it("is not a chosen look when read back from storage, so the name's default is used", () => {
    expect(parseAppearance(old)).toBeNull();
  });

  it("is read as the fallback when it came as JSON", () => {
    expect(
      appearanceFromJson(JSON.stringify({ ...old, skin: 99 }), fallback),
    ).toEqual({ ...fallback, hairStyle: old.hairStyle });
  });
});

describe("sanitizeAppearance", () => {
  const fallback = defaultAppearance("Ana");

  it("keeps a valid appearance as it is", () => {
    expect(sanitizeAppearance(base, fallback)).toEqual(base);
  });

  it("falls back for anything that is not an appearance", () => {
    for (const raw of [undefined, null, 42, "x", [], true]) {
      expect(sanitizeAppearance(raw, fallback)).toEqual(fallback);
    }
  });

  it("replaces only the fields that are wrong", () => {
    const result = sanitizeAppearance(
      { ...base, skin: 999, shirt: -1 },
      fallback,
    );
    expect(result.skin).toBe(fallback.skin);
    expect(result.shirt).toBe(fallback.shirt);
    expect(result.hairColor).toBe(base.hairColor);
    expect(result.pants).toBe(base.pants);
  });

  it("rejects fractions, NaN and non-numbers instead of rounding them", () => {
    for (const bad of [1.5, NaN, Infinity, "2", null, {}]) {
      expect(
        sanitizeAppearance({ ...base, hairStyle: bad }, fallback).hairStyle,
      ).toBe(fallback.hairStyle);
    }
  });

  it("accepts the first and last option of each palette, and nothing past them", () => {
    const last = {
      skin: SKIN_TONES.length - 1,
      hairColor: HAIR_COLORS.length - 1,
      hairStyle: HAIR_STYLES.length - 1,
      shirt: SHIRT_COLORS.length - 1,
      pants: PANTS_COLORS.length - 1,
      facialHair: FACIAL_HAIR.length - 1,
      glasses: GLASSES.length - 1,
      headwear: HEADWEAR.length - 1,
      top: TOPS.length - 1,
      shoes: SHOES.length - 1,
      accessory: ACCESSORIES.length - 1,
    };
    expect(sanitizeAppearance(last, fallback)).toEqual(last);
    expect(
      sanitizeAppearance({ ...last, skin: SKIN_TONES.length }, fallback).skin,
    ).toBe(fallback.skin);
    for (const [field, count] of EXTRA_FIELDS)
      expect(
        sanitizeAppearance({ ...last, [field]: count }, fallback)[field],
        field,
      ).toBe(fallback[field]);
  });

  it("never lets an extra field through", () => {
    const result = sanitizeAppearance({ ...base, admin: true }, fallback);
    expect(Object.keys(result).sort()).toEqual(Object.keys(base).sort());
  });
});

describe("defaultAppearance", () => {
  it("is always a valid appearance", () => {
    for (const name of ["Ana", "Beto", "", "😀", "x".repeat(40), "Guest"]) {
      const a = defaultAppearance(name);
      expect(sanitizeAppearance(a, base)).toEqual(a);
    }
  });

  it("is the same for the same name, so somebody stays recognisable", () => {
    expect(defaultAppearance("Ana")).toEqual(defaultAppearance("Ana"));
  });

  it("keeps the extras plain and the base look to the prototype's options, so a name looks the way it always did", () => {
    for (const name of ["Ana", "Beto", "Cami", "Dani", "Eli", "x".repeat(40)]) {
      const a = defaultAppearance(name);
      for (const [field] of EXTRA_FIELDS) expect(a[field], field).toBe(0);
      expect(a.skin).toBeLessThan(5);
      expect(a.hairColor).toBeLessThan(6);
      expect(a.hairStyle).toBeLessThan(2);
      expect(a.shirt).toBeLessThan(6);
      expect(a.pants).toBeLessThan(5);
    }
  });

  it("is the same look as before the options grew, for the name Ana", () => {
    expect(defaultAppearance("Ana")).toEqual({
      skin: 2,
      hairColor: 2,
      hairStyle: 1,
      shirt: 5,
      pants: 2,
      ...PLAIN,
    });
  });

  it("differs between names, so people do not all look alike", () => {
    const looks = new Set(
      ["Ana", "Beto", "Cami", "Dani", "Eli", "Fede", "Gus", "Hugo"].map((n) =>
        JSON.stringify(defaultAppearance(n)),
      ),
    );
    expect(looks.size).toBeGreaterThan(4);
  });
});

describe("randomAppearance", () => {
  const FIELDS = Object.keys(base) as (keyof Appearance)[];

  it("is always a valid appearance", () => {
    for (const roll of [0, 0.5, 0.999999, Math.random()]) {
      const a = randomAppearance(() => roll);
      expect(sanitizeAppearance(a, base)).toEqual(a);
    }
  });

  it("can reach every option of every field", () => {
    const random = seeded(7);
    const seen = Object.fromEntries(
      FIELDS.map((field) => [field, new Set<number>()]),
    ) as Record<keyof Appearance, Set<number>>;
    for (let i = 0; i < 3000; i++) {
      const a = randomAppearance(random);
      for (const field of FIELDS) seen[field].add(a[field]);
    }
    expect(seen.skin.size).toBe(SKIN_TONES.length);
    expect(seen.hairColor.size).toBe(HAIR_COLORS.length);
    expect(seen.hairStyle.size).toBe(HAIR_STYLES.length);
    expect(seen.shirt.size).toBe(SHIRT_COLORS.length);
    expect(seen.pants.size).toBe(PANTS_COLORS.length);
    expect(seen.facialHair.size).toBe(FACIAL_HAIR.length);
    expect(seen.glasses.size).toBe(GLASSES.length);
    expect(seen.headwear.size).toBe(HEADWEAR.length);
    expect(seen.top.size).toBe(TOPS.length);
    expect(seen.shoes.size).toBe(SHOES.length);
    expect(seen.accessory.size).toBe(ACCESSORIES.length);
  });

  it("makes sensible combinations: nothing hidden under a hat, no headphones over it", () => {
    const random = seeded(11);
    for (let i = 0; i < 1000; i++) {
      const a = randomAppearance(random);
      if (a.headwear !== 0) {
        expect(["mohawk", "bun", "curly"]).not.toContain(
          HAIR_STYLES[a.hairStyle],
        );
        expect(ACCESSORIES[a.accessory]).not.toBe("headphones");
      }
      if (["collar", "blazer"].includes(TOPS[a.top]))
        expect(ACCESSORIES[a.accessory]).not.toBe("scarf");
    }
  });

  it("mostly keeps the face and head plain, and the hair a natural colour", () => {
    const random = seeded(3);
    const count = 2000;
    let plainGlasses = 0;
    let plainHat = 0;
    let natural = 0;
    let shod = 0;
    for (let i = 0; i < count; i++) {
      const a = randomAppearance(random);
      if (a.glasses === 0) plainGlasses++;
      if (a.headwear === 0) plainHat++;
      if (a.hairColor < FUN_HAIR_FROM) natural++;
      if (a.shoes !== 0) shod++;
    }
    expect(plainGlasses / count).toBeGreaterThan(0.5);
    expect(plainHat / count).toBeGreaterThan(0.6);
    expect(natural / count).toBeGreaterThan(0.75);
    expect(shod / count).toBeGreaterThan(0.8);
  });
});

describe("appearanceColors", () => {
  it("turns the choices into the colours to paint", () => {
    expect(appearanceColors(base)).toEqual({
      skin: SKIN_TONES[1],
      hair: HAIR_COLORS[2],
      shirt: SHIRT_COLORS[3],
      pants: PANTS_COLORS[1],
      shoe: null,
    });
  });

  it("paints the shoes when there are some", () => {
    expect(appearanceColors({ ...base, shoes: 2 }).shoe).toBe(SHOE_COLORS[2]);
  });
});

describe("appearanceFromJson", () => {
  const fallback = defaultAppearance("Ana");

  it("reads what was saved", () => {
    expect(appearanceFromJson(JSON.stringify(base), fallback)).toEqual(base);
  });

  it("falls back for nothing saved, broken text or the wrong shape", () => {
    expect(appearanceFromJson(null, fallback)).toEqual(fallback);
    expect(appearanceFromJson("{not json", fallback)).toEqual(fallback);
    expect(appearanceFromJson("[1,2]", fallback)).toEqual(fallback);
  });

  it("reads a look saved before the extra options as plain, not as whatever the fallback is", () => {
    const busy = { ...fallback, glasses: 2, headwear: 1, top: 3, shoes: 2 };
    expect(appearanceFromJson(JSON.stringify(OLD_SHAPE), busy)).toEqual({
      ...OLD_SHAPE,
      ...PLAIN,
    });
  });
});

describe("a look from before the extra options", () => {
  it("is a valid look, with every extra plain", () => {
    expect(parseAppearance(OLD_SHAPE)).toEqual({ ...OLD_SHAPE, ...PLAIN });
  });

  it("keeps the extras of the player when an old client sends only the five parts", () => {
    const current = { ...base, glasses: 2, headwear: 1, shoes: 3 };
    expect(sanitizeAppearance({ ...OLD_SHAPE, skin: 2 }, current)).toEqual({
      ...current,
      ...OLD_SHAPE,
      skin: 2,
    });
  });

  it("is still strict about an extra that is there but wrong", () => {
    for (const bad of [99, -1, 1.5, "1", null, NaN, {}])
      expect(
        parseAppearance({ ...OLD_SHAPE, glasses: bad }),
        String(bad),
      ).toBeNull();
  });

  it("rejects a look that lacks the five original parts, extras or not", () => {
    expect(parseAppearance({ glasses: 1 })).toBeNull();
    expect(parseAppearance({ ...PLAIN, skin: 1 })).toBeNull();
  });
});

describe("parseAppearance", () => {
  const look = {
    skin: 1,
    hairColor: 2,
    hairStyle: 0,
    shirt: 3,
    pants: 4,
    facialHair: 1,
    glasses: 2,
    headwear: 1,
    top: 2,
    shoes: 3,
    accessory: 4,
  };

  it("reads a complete, valid look", () => {
    expect(parseAppearance(look)).toEqual(look);
  });

  it("drops anything that is not part of a look", () => {
    expect(parseAppearance({ ...look, admin: true })).toEqual(look);
  });

  it("is nothing for a look with a missing or invalid part: it is not somebody's choice", () => {
    for (const bad of [
      null,
      undefined,
      "text",
      42,
      [],
      {},
      { ...look, skin: 99 },
      { ...look, shirt: -1 },
      { ...look, pants: 1.5 },
      { ...look, hairStyle: "short" },
      { ...look, top: 99 },
      { ...look, accessory: -1 },
      { skin: 1 },
    ])
      expect(parseAppearance(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe("sameAppearance", () => {
  const look = { ...base };

  it("is true for the same choices", () => {
    expect(sameAppearance(look, { ...look })).toBe(true);
  });

  it("is false when any one choice differs, the extras included", () => {
    for (const field of Object.keys(look) as Array<keyof typeof look>)
      expect(
        sameAppearance(look, { ...look, [field]: look[field] + 1 }),
        field,
      ).toBe(false);
  });
});

describe("lookOf", () => {
  it("copies just the look out of anything that has one, such as a player in the room", () => {
    const player = { ...base, name: "Ana", x: 3, z: 4, seat: "" };
    expect(lookOf(player)).toEqual(base);
    expect(lookOf(player)).not.toBe(player);
  });
});

describe("APPEARANCE_FIELDS", () => {
  it("names every part of a look, for what listens to the room for changes", () => {
    expect([...APPEARANCE_FIELDS].sort()).toEqual(Object.keys(base).sort());
  });
});
