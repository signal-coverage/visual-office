import { describe, expect, it } from "vitest";
import {
  ACCESSORIES,
  FACIAL_HAIR,
  GLASSES,
  HAIR_STYLES,
  HEADWEAR,
  SHIRT_COLORS,
  SKIN_TONES,
  TOPS,
  appearanceColors,
  defaultAppearance,
  type Appearance,
} from "../../shared/appearance.ts";
import { PLAYER_RADIUS } from "../../shared/constants.ts";
import {
  ARM,
  EYES,
  GEAR_LIFT_ON_SCREEN,
  GEAR_TOP_LIMIT,
  HAIR,
  HEAD,
  HEAD_CENTER,
  hairCenter,
  HAND,
  NAME_TAG,
  TORSO,
  TORSO_CENTER,
} from "./avatarLayout";
import {
  AVATAR_TRIANGLE_BUDGET,
  BODY_EXTRA_TRIANGLES,
  lookPieces,
  mix,
  OPTION_TRIANGLE_BUDGET,
  pieceBounds,
  shade,
  trianglesOf,
  type Placed,
} from "./avatarLook";

const plain: Appearance = {
  ...defaultAppearance("Ana"),
  hairStyle: HAIR_STYLES.indexOf("none"),
};

const withOption = (field: keyof Appearance, index: number): Appearance => ({
  ...plain,
  [field]: index,
});

/** Every option of every part that has pieces, as the look that has just that option. */
const OPTIONS: Array<[string, Appearance]> = [
  ...HAIR_STYLES.map((n, i): [string, Appearance] => [
    `hair ${n}`,
    withOption("hairStyle", i),
  ]),
  ...FACIAL_HAIR.map((n, i): [string, Appearance] => [
    `facial hair ${n}`,
    withOption("facialHair", i),
  ]),
  ...GLASSES.map((n, i): [string, Appearance] => [
    `glasses ${n}`,
    withOption("glasses", i),
  ]),
  ...HEADWEAR.map((n, i): [string, Appearance] => [
    `headwear ${n}`,
    withOption("headwear", i),
  ]),
  ...TOPS.map((n, i): [string, Appearance] => [
    `top ${n}`,
    withOption("top", i),
  ]),
  ...ACCESSORIES.map((n, i): [string, Appearance] => [
    `accessory ${n}`,
    withOption("accessory", i),
  ]),
];

/** The most pieces any option of each part can add: worn all together. */
const BUSIEST: Appearance = {
  ...plain,
  hairStyle: HAIR_STYLES.indexOf("ponytail"),
  facialHair: FACIAL_HAIR.indexOf("beard"),
  glasses: GLASSES.indexOf("round"),
  headwear: HEADWEAR.indexOf("cap"),
  top: TOPS.indexOf("blazer"),
  shoes: 2,
  accessory: ACCESSORIES.indexOf("lanyard"),
};

const TOUCH = 0.002;
const touching = (a: Placed, b: Placed) => {
  const boxA = pieceBounds(a);
  const boxB = pieceBounds(b);
  return [0, 1, 2].every(
    (axis) =>
      boxA.min[axis] <= boxB.max[axis] + TOUCH &&
      boxB.min[axis] <= boxA.max[axis] + TOUCH,
  );
};

const ARMS_SPAN = ARM.shoulderX + ARM.width / 2;

describe("a look from before the options", () => {
  const old: Appearance = { ...plain, hairStyle: 0 };
  const pieces = lookPieces(old, "high");
  const colors = appearanceColors(old);

  it("is drawn as the old avatar was: head, two eyes, torso, two sleeves, two hands and a cap of hair", () => {
    expect(pieces).toHaveLength(9);
    const sizes = pieces.map((piece) => piece.size.join("x")).sort();
    expect(sizes).toEqual(
      [
        [HEAD.width, HEAD.height, HEAD.depth],
        [EYES.size, EYES.size, EYES.depth],
        [EYES.size, EYES.size, EYES.depth],
        [TORSO.width, TORSO.height, TORSO.depth],
        [ARM.width, ARM.height, ARM.depth],
        [ARM.width, ARM.height, ARM.depth],
        [HAND.width, HAND.height, HAND.depth],
        [HAND.width, HAND.height, HAND.depth],
        [HAIR.width, HAIR.height, HAIR.depth],
      ]
        .map((size) => size.join("x"))
        .sort(),
    );
  });

  it("paints the sleeves like the shirt all the way down, as before", () => {
    const sleeves = pieces.filter(
      (piece) => piece.size[1] === ARM.height && piece.size[0] === ARM.width,
    );
    expect(sleeves).toHaveLength(2);
    for (const sleeve of sleeves) expect(sleeve.color).toBe(colors.shirt);
  });

  it("puts the hair where it always was", () => {
    const cap = pieces.find((piece) => piece.size[1] === HAIR.height)!;
    expect(cap.at[1]).toBeCloseTo(hairCenter(false));
    expect(cap.color).toBe(colors.hair);
  });

  it("has no small details to drop", () => {
    for (const piece of pieces) expect(piece.fine).toBe(false);
  });
});

describe("every option, worn alone", () => {
  it.each(OPTIONS)(
    "%s stays on the person and under the name tag",
    (_n, look) => {
      for (const piece of lookPieces(look, "high")) {
        const { min, max } = pieceBounds(piece);
        expect(min[1], "floor").toBeGreaterThanOrEqual(0);
        expect(max[1], "above the head").toBeLessThanOrEqual(
          GEAR_TOP_LIMIT + 1e-9,
        );
        expect(
          Math.max(-min[0], max[0]),
          "wider than the arms",
        ).toBeLessThanOrEqual(ARMS_SPAN + 0.015);
        if (piece.anchor === "armL" || piece.anchor === "armR") continue;
        // Corners of the head and the torso stay inside the circle that others bump into
        const reach = Math.max(
          ...[min[0], max[0]].flatMap((x) =>
            [min[2], max[2]].map((z) => Math.hypot(x, z)),
          ),
        );
        expect(reach, "past the player's radius").toBeLessThanOrEqual(
          PLAYER_RADIUS,
        );
      }
    },
  );

  it.each(OPTIONS)(
    "%s has nothing floating: every piece touches the body or a piece that does",
    (_n, look) => {
      const pieces = lookPieces(look, "high");
      const reached = new Set(pieces.filter((piece) => piece.body));
      let grew = true;
      while (grew) {
        grew = false;
        for (const piece of pieces) {
          if (reached.has(piece)) continue;
          if ([...reached].some((other) => touching(piece, other))) {
            reached.add(piece);
            grew = true;
          }
        }
      }
      expect(pieces.filter((piece) => !reached.has(piece))).toEqual([]);
    },
  );

  it.each(OPTIONS)(
    "%s stays under the triangle budget of one option",
    (_n, look) => {
      const extra =
        trianglesOf(lookPieces(look, "high")) -
        trianglesOf(lookPieces(plain, "high"));
      expect(extra).toBeLessThanOrEqual(OPTION_TRIANGLE_BUDGET);
    },
  );
});

describe("the camera on the head", () => {
  it("lifts the hair and what is worn over it by exactly the screen's gap, and the lift is small", () => {
    expect(GEAR_LIFT_ON_SCREEN).toBeCloseTo(
      hairCenter(true) - hairCenter(false),
    );
    expect(GEAR_LIFT_ON_SCREEN).toBeGreaterThan(0);
    expect(GEAR_LIFT_ON_SCREEN).toBeLessThan(0.05);
  });

  it("leaves room under the name tag for the lifted gear", () => {
    expect(GEAR_TOP_LIMIT + GEAR_LIFT_ON_SCREEN).toBeLessThanOrEqual(
      NAME_TAG.center - NAME_TAG.height / 2 + 1e-9,
    );
  });

  it("keeps the face, the glasses and the beard on the part that goes with the head, and the hair and hats on the part that stays", () => {
    const look: Appearance = {
      ...BUSIEST,
      hairStyle: HAIR_STYLES.indexOf("short"),
      headwear: HEADWEAR.indexOf("beanie"),
      accessory: ACCESSORIES.indexOf("headphones"),
    };
    const pieces = lookPieces(look, "high");
    const anchors = (name: string) =>
      new Set(
        lookPieces(withOption(name as keyof Appearance, 1), "high")
          .filter(
            (piece) => !lookPieces(plain, "high").some((p) => same(p, piece)),
          )
          .map((piece) => piece.anchor),
      );
    expect(anchors("glasses")).toEqual(new Set(["face"]));
    expect(anchors("facialHair")).toEqual(new Set(["face"]));
    expect(pieces.some((piece) => piece.anchor === "gear")).toBe(true);
    const hat = lookPieces(withOption("headwear", 2), "high").filter(
      (piece) => piece.anchor === "gear",
    );
    expect(hat.length).toBeGreaterThan(0);
  });
});

const same = (a: Placed, b: Placed) =>
  a.anchor === b.anchor &&
  a.at.join() === b.at.join() &&
  a.size.join() === b.size.join() &&
  a.color === b.color;

describe("hair under a hat", () => {
  const style = (name: (typeof HAIR_STYLES)[number]) =>
    HAIR_STYLES.indexOf(name);
  const cap = HEADWEAR.indexOf("cap");
  const gear = (look: Appearance) =>
    lookPieces(look, "high").filter((piece) => piece.anchor === "gear");

  it("hides the hair that sits on the head, whichever hat", () => {
    for (const name of ["short", "buzz", "curly", "mohawk", "bun"] as const) {
      const bare = gear({ ...plain, hairStyle: style(name) });
      const hatted = gear({ ...plain, hairStyle: style(name), headwear: cap });
      const hat = gear({ ...plain, headwear: cap });
      expect(hatted.length, name).toBe(hat.length);
      expect(bare.length, name).toBeGreaterThan(0);
    }
  });

  it("keeps the hair that hangs out from under it", () => {
    for (const name of ["long", "ponytail"] as const) {
      const hatted = gear({ ...plain, hairStyle: style(name), headwear: cap });
      const hat = gear({ ...plain, headwear: cap });
      expect(hatted.length, name).toBeGreaterThan(hat.length);
    }
  });

  it("paints the hat like the shirt", () => {
    const shirt = 2;
    const hat = gear({ ...plain, shirt, headwear: cap });
    expect(hat.some((piece) => piece.color === SHIRT_COLORS[shirt])).toBe(true);
  });
});

describe("facial hair and glasses", () => {
  it("colours the beard like the hair", () => {
    const look = { ...plain, hairColor: 3, facialHair: 3 };
    const beard = lookPieces(look, "high").filter(
      (piece) => piece.anchor === "face" && !piece.body,
    );
    expect(beard.length).toBeGreaterThan(0);
    expect(beard.every((p) => p.color === appearanceColors(look).hair)).toBe(
      true,
    );
  });

  it("shows stubble as a faint shadow between the skin and the hair", () => {
    const look = { ...plain, hairColor: 0, skin: 0, facialHair: 1 };
    const [stubble] = lookPieces(look, "high").filter(
      (piece) => !piece.body && piece.anchor === "face",
    );
    const { skin, hair } = appearanceColors(look);
    expect(stubble.color).not.toBe(skin);
    expect(stubble.color).not.toBe(hair);
  });

  it("brings the eyes out in front of clear lenses, and keeps them as they are without glasses", () => {
    const eyeZ = (look: Appearance) =>
      lookPieces(look, "high")
        .filter((piece) => piece.body && piece.size[0] === EYES.size)
        .map((piece) => piece.at[2]);
    const bare = eyeZ(plain);
    for (const name of ["round", "square"] as const) {
      const worn = eyeZ({ ...plain, glasses: GLASSES.indexOf(name) });
      for (let i = 0; i < worn.length; i++)
        expect(worn[i]).toBeLessThan(bare[i]);
    }
  });

  it("sits the lenses level with the eyes", () => {
    for (let i = 1; i < GLASSES.length; i++) {
      const lenses = lookPieces(withOption("glasses", i), "high").filter(
        (piece) => !piece.body && piece.anchor === "face",
      );
      const heights = lenses.map((piece) => piece.at[1]);
      expect(Math.min(...heights), GLASSES[i]).toBeGreaterThan(
        HEAD_CENTER - HEAD.height / 2,
      );
      expect(Math.max(...heights), GLASSES[i]).toBeLessThan(
        HEAD_CENTER + HEAD.height / 2,
      );
    }
  });
});

describe("tops", () => {
  it("shows the bare forearm of a tee, in skin, and no more sleeve than the arm", () => {
    const look = withOption("top", TOPS.indexOf("tee"));
    const arm = lookPieces(look, "high").filter(
      (piece) =>
        piece.anchor === "armR" &&
        piece.at[1] > -ARM.height - 1e-9 &&
        piece.at[1] < 0,
    );
    const colors = new Set(arm.map((piece) => piece.color));
    expect(colors.has(SKIN_TONES[look.skin])).toBe(true);
    expect(colors.has(SHIRT_COLORS[look.shirt])).toBe(true);
  });

  it("changes the torso only by what stands out of it", () => {
    for (const top of TOPS) {
      const pieces = lookPieces(withOption("top", TOPS.indexOf(top)), "high");
      const torso = pieces.filter(
        (piece) => piece.anchor === "torso" && piece.body,
      );
      expect(torso).toHaveLength(1);
      expect(torso[0].size).toEqual([TORSO.width, TORSO.height, TORSO.depth]);
      expect(torso[0].at[1]).toBeCloseTo(TORSO_CENTER);
    }
  });
});

describe("the watch", () => {
  it("is on the left wrist only, on the outer side", () => {
    const watch = lookPieces(
      withOption("accessory", ACCESSORIES.indexOf("watch")),
      "high",
    ).filter((piece) => !piece.body && piece.anchor.startsWith("arm"));
    expect(watch.length).toBeGreaterThan(0);
    for (const piece of watch) expect(piece.anchor).toBe("armL");
    const dial = watch.reduce((a, b) =>
      Math.abs(a.at[0]) > Math.abs(b.at[0]) ? a : b,
    );
    expect(dial.at[0]).toBeLessThan(0);
  });
});

describe("the arms", () => {
  it("are mirror images of each other for every option", () => {
    for (const [name, look] of OPTIONS) {
      const pieces = lookPieces(look, "high");
      const left = pieces.filter((p) => p.anchor === "armL");
      const right = pieces.filter((p) => p.anchor === "armR");
      if (look.accessory === ACCESSORIES.indexOf("watch")) continue;
      expect(left.length, name).toBe(right.length);
      for (const piece of left)
        expect(
          right.some((other) =>
            same(
              {
                ...other,
                anchor: "armL",
                at: [-other.at[0], other.at[1], other.at[2]],
              },
              piece,
            ),
          ),
          name,
        ).toBe(true);
    }
  });
});

describe("the small details", () => {
  it("are dropped on low and nothing else is", () => {
    const high = lookPieces(BUSIEST, "high");
    const low = lookPieces(BUSIEST, "low");
    expect(low.length).toBeLessThan(high.length);
    expect(low).toEqual(high.filter((piece) => !piece.fine));
    expect(high.filter((piece) => piece.fine).length).toBeGreaterThan(0);
  });

  it("include the watch and the badge", () => {
    const watch = withOption("accessory", ACCESSORIES.indexOf("watch"));
    expect(trianglesOf(lookPieces(watch, "low"))).toBe(
      trianglesOf(lookPieces(plain, "low")),
    );
    const badge = withOption("accessory", ACCESSORIES.indexOf("lanyard"));
    expect(trianglesOf(lookPieces(badge, "low"))).toBeGreaterThan(
      trianglesOf(lookPieces(plain, "low")),
    );
    expect(trianglesOf(lookPieces(badge, "low"))).toBeLessThan(
      trianglesOf(lookPieces(badge, "high")),
    );
  });
});

describe("the whole avatar", () => {
  it("stays under its triangle budget with the busiest look, shoes included", () => {
    expect(
      trianglesOf(lookPieces(BUSIEST, "high")) + BODY_EXTRA_TRIANGLES,
    ).toBeLessThanOrEqual(AVATAR_TRIANGLE_BUDGET);
  });

  it("costs no more on low than on high", () => {
    for (const [, look] of OPTIONS)
      expect(trianglesOf(lookPieces(look, "low"))).toBeLessThanOrEqual(
        trianglesOf(lookPieces(look, "high")),
      );
  });
});

describe("colour helpers", () => {
  it("shade darkens every channel and keeps white and black meaningful", () => {
    expect(shade(0xffffff, 0.5)).toBe(0x808080);
    expect(shade(0x000000, 0.5)).toBe(0x000000);
    expect(shade(0x804020, 1)).toBe(0x804020);
  });

  it("mix goes from the first colour to the second", () => {
    expect(mix(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mix(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});

describe("what is worn over the chest", () => {
  const front = -TORSO.depth / 2;

  const chestPieces = (top: number, accessory: number) =>
    lookPieces(
      { ...withOption("top", top), accessory } as Appearance,
      "high",
    ).filter(
      (piece) =>
        piece.anchor === "torso" &&
        !piece.body &&
        Math.abs(piece.at[2] - front) < 0.03 &&
        (piece.rot?.[0] ?? 0) === 0 &&
        (piece.rot?.[1] ?? 0) === 0,
    );

  const frontFace = (piece: {
    at: readonly number[];
    size: readonly number[];
  }) => piece.at[2] - piece.size[2] / 2;
  const backFace = (piece: {
    at: readonly number[];
    size: readonly number[];
  }) => piece.at[2] + piece.size[2] / 2;

  it("sinks its back into the torso and stands out of it, so no face of it is level with the front of the body", () => {
    for (const top of TOPS.keys())
      for (const accessory of ACCESSORIES.keys())
        for (const piece of chestPieces(top, accessory)) {
          expect(backFace(piece)).toBeGreaterThanOrEqual(front + 0.005);
          expect(frontFace(piece)).toBeLessThanOrEqual(front - 0.006);
        }
  });

  it("puts the front of every piece that overlaps another one at its own depth, whatever top and accessory are worn together", () => {
    const reach = (piece: {
      size: readonly number[];
      rot?: readonly number[];
    }) => {
      const roll = piece.rot?.[2] ?? 0;
      const [w, h] = piece.size;
      return [
        (Math.abs(Math.cos(roll)) * w + Math.abs(Math.sin(roll)) * h) / 2,
        (Math.abs(Math.sin(roll)) * w + Math.abs(Math.cos(roll)) * h) / 2,
      ];
    };
    for (const top of TOPS.keys())
      for (const accessory of ACCESSORIES.keys()) {
        const pieces = chestPieces(top, accessory);
        for (let i = 0; i < pieces.length; i++)
          for (let j = i + 1; j < pieces.length; j++) {
            const [ax, ay] = reach(pieces[i]);
            const [bx, by] = reach(pieces[j]);
            const overlapX =
              ax + bx - Math.abs(pieces[i].at[0] - pieces[j].at[0]);
            const overlapY =
              ay + by - Math.abs(pieces[i].at[1] - pieces[j].at[1]);
            if (overlapX > 0.002 && overlapY > 0.002)
              expect(
                Math.abs(frontFace(pieces[i]) - frontFace(pieces[j])),
              ).toBeGreaterThanOrEqual(0.006);
          }
      }
  });
});
