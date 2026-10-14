import { describe, expect, it } from "vitest";
import {
  appearanceColors,
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

const base: Appearance = {
  skin: 1,
  hairColor: 2,
  hairStyle: 1,
  shirt: 3,
  pants: 1,
};

describe("the palettes", () => {
  it("each offer a real choice and fit in one byte", () => {
    for (const palette of [
      SKIN_TONES,
      HAIR_COLORS,
      SHIRT_COLORS,
      PANTS_COLORS,
      HAIR_STYLES,
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
  it("uses exactly its skin, hair, shirt and pants colours, in its order", () => {
    expect([...SKIN_TONES]).toEqual([
      0xf6d7b8, 0xe8b98f, 0xc98c5d, 0x9a6440, 0x6b4128,
    ]);
    expect([...HAIR_COLORS]).toEqual([
      0x2b1d14, 0x5a3a22, 0xa8743a, 0xe0c27a, 0xb8452e, 0x8c8c8c,
    ]);
    expect([...SHIRT_COLORS]).toEqual([
      0xd9643a, 0x3f7d5c, 0x3a5f8f, 0xe8c547, 0xf2efe8, 0x7a3e5c,
    ]);
    expect([...PANTS_COLORS]).toEqual([
      0x2f3640, 0x4a4f6b, 0x7a6a55, 0x1f2a24, 0xa3a8ad,
    ]);
  });

  it("keeps the same hair styles, in the same order", () => {
    expect([...HAIR_STYLES]).toEqual(["short", "long", "none"]);
  });
});

describe("a look saved with the old, longer palettes", () => {
  // The old palettes had 6 skins, 8 hair colours, 10 shirts and 6 pants
  const old = { skin: 5, hairColor: 7, hairStyle: 2, shirt: 9, pants: 5 };
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
    };
    expect(sanitizeAppearance(last, fallback)).toEqual(last);
    expect(
      sanitizeAppearance({ ...last, skin: SKIN_TONES.length }, fallback).skin,
    ).toBe(fallback.skin);
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
  it("is always a valid appearance", () => {
    for (const roll of [0, 0.5, 0.999999, Math.random()]) {
      const a = randomAppearance(() => roll);
      expect(sanitizeAppearance(a, base)).toEqual(a);
    }
  });

  it("can reach every option of every palette", () => {
    const seen = {
      skin: new Set<number>(),
      hairColor: new Set<number>(),
      hairStyle: new Set<number>(),
      shirt: new Set<number>(),
      pants: new Set<number>(),
    };
    for (let i = 0; i < 400; i++) {
      const a = randomAppearance();
      for (const key of Object.keys(seen) as (keyof typeof seen)[])
        seen[key].add(a[key]);
    }
    expect(seen.skin.size).toBe(SKIN_TONES.length);
    expect(seen.hairColor.size).toBe(HAIR_COLORS.length);
    expect(seen.hairStyle.size).toBe(HAIR_STYLES.length);
    expect(seen.shirt.size).toBe(SHIRT_COLORS.length);
    expect(seen.pants.size).toBe(PANTS_COLORS.length);
  });
});

describe("appearanceColors", () => {
  it("turns the choices into the colours to paint", () => {
    expect(appearanceColors(base)).toEqual({
      skin: SKIN_TONES[1],
      hair: HAIR_COLORS[2],
      shirt: SHIRT_COLORS[3],
      pants: PANTS_COLORS[1],
    });
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
});

describe("parseAppearance", () => {
  const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };

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
      { skin: 1 },
    ])
      expect(parseAppearance(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe("sameAppearance", () => {
  const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };

  it("is true for the same choices", () => {
    expect(sameAppearance(look, { ...look })).toBe(true);
  });

  it("is false when any one choice differs", () => {
    for (const field of Object.keys(look) as Array<keyof typeof look>)
      expect(
        sameAppearance(look, { ...look, [field]: look[field] + 1 }),
        field,
      ).toBe(false);
  });
});
