import {
  ACCESSORIES,
  appearanceColors,
  FACIAL_HAIR,
  GLASSES,
  HAIR_STYLES,
  HEADWEAR,
  TOPS,
  type Accessory,
  type Appearance,
  type FacialHair,
  type Glasses,
  type HairStyle,
  type Headwear,
  type Top,
} from "../../shared/appearance.ts";
import {
  ARM,
  EYES,
  hairBackZ,
  hairCenter,
  HAIR,
  HAND,
  HEAD,
  HEAD_CENTER,
  SHOULDER_Y,
  TORSO,
  TORSO_CENTER,
} from "./avatarLayout";
import type { DetailLevel } from "./furnitureLook";

/**
 * What every option of the character looks like, as plain data: a handful of
 * boxes each, measured in meters in the avatar's own frame (floor at y = 0,
 * the face looking toward -z). The client bakes them into one mesh per limb
 * (avatarMesh.ts); the tests hold every option to the body's bounds, to the
 * name tag and to a triangle budget. To add an option: add its name to the list
 * in shared/appearance.ts (at the end) and its pieces to the table here.
 */

export type Vec3 = readonly [number, number, number];

/** A colour that depends on the look: resolved when the pieces are placed. */
type Paint =
  "skin" | "hair" | "stubble" | "shirt" | "shirtDark" | "white" | number;

/**
 * Which part of the avatar a piece moves with: the head's face (it turns into
 * the camera screen), the gear over the hair (it stays, and rises with the
 * screen), the torso, or an arm (measured from the shoulder, the right one's
 * way round: +x is outward; the left arm is its mirror image).
 */
type Anchor = "face" | "gear" | "torso" | "arm";

interface Piece {
  anchor: Anchor;
  /** [width, height, depth] */
  size: Vec3;
  /** Where the middle is. */
  at: Vec3;
  /** Pitch, yaw and roll in radians, applied as yaw of (pitch of roll). */
  rot?: Vec3;
  paint: Paint;
  /** Dropped on low quality: too small to be missed. */
  fine?: boolean;
  /** Sits on top of the head: a hat covers it. */
  top?: boolean;
  /** An arm piece for one arm only. */
  side?: "left" | "right";
  /** Part of the body itself rather than something worn. */
  body?: boolean;
}

export type PlacedAnchor = "face" | "gear" | "torso" | "armL" | "armR";

/** A piece in place: its colour decided, and the arm it is on told apart. */
export interface Placed {
  anchor: PlacedAnchor;
  size: Vec3;
  at: Vec3;
  rot?: Vec3;
  color: number;
  fine: boolean;
  body: boolean;
}

export const PIECE_TRIANGLES = 12;
/** The most any one option may add: ten boxes. */
export const OPTION_TRIANGLE_BUDGET = 10 * PIECE_TRIANGLES;
/** The legs, lower legs and shoes: drawn apart from the pieces because they bend. */
export const BODY_EXTRA_TRIANGLES = 6 * PIECE_TRIANGLES;
/** The whole avatar, with the busiest look. */
export const AVATAR_TRIANGLE_BUDGET = 600;

export const trianglesOf = (pieces: readonly { size: Vec3 }[]) =>
  pieces.length * PIECE_TRIANGLES;

const channels = (color: number) => [
  (color >> 16) & 0xff,
  (color >> 8) & 0xff,
  color & 0xff,
];
const join = ([r, g, b]: number[]) => (r << 16) | (g << 8) | b;

/** The colour with every channel scaled by `factor` (below 1 is darker). */
export function shade(color: number, factor: number): number {
  return join(
    channels(color).map((c) => Math.min(255, Math.round(c * factor))),
  );
}

/** A colour `amount` of the way (0 to 1) from `from` to `to`. */
export function mix(from: number, to: number, amount: number): number {
  const a = channels(from);
  const b = channels(to);
  return join(a.map((c, i) => Math.round(c + (b[i] - c) * amount)));
}

const DARK = 0x1b1c20;
const LENS = 0xdcecf5;
const BLACK_LENS = 0x0d0d10;
const PHONES = 0x2b2e36;
const ACCENT = 0x8e2a38;
const STRAP = 0x2a9d8f;
const WATCH = 0x2a2d33;
const DIAL = 0xd5dae0;
const EYE_COLOR = 0x222222;

interface Options {
  rot?: Vec3;
  fine?: boolean;
  top?: boolean;
  side?: "left" | "right";
  body?: boolean;
}

const piece =
  (anchor: Anchor) =>
  (size: Vec3, at: Vec3, paint: Paint, options: Options = {}): Piece => ({
    anchor,
    size,
    at,
    paint,
    ...options,
  });
const face = piece("face");
const gear = piece("gear");
const torso = piece("torso");
const arm = piece("arm");

/** The front of the head, where eyes, glasses and a beard are laid. */
const FRONT = -HEAD.depth / 2;
const EYE_Y = HEAD_CENTER + EYES.dy;
const HEAD_TOP_Y = HEAD_CENTER + HEAD.height / 2;
const CHIN_Y = HEAD_CENTER - HEAD.height / 2;
const TORSO_FRONT = -TORSO.depth / 2;
const NECK_Y = TORSO_CENTER + TORSO.height / 2;

/**
 * How far in front of the torso each layer of what is worn over the chest
 * stands (the shirt's own panels, then the accents, then the lanyard). Two
 * pieces that overlap never share a layer, and none has a face on the torso's
 * own plane: flat faces at the same depth flicker over each other as the
 * avatar turns.
 */
export const CHEST = {
  shirt: 0.008,
  accent: 0.014,
  strap: 0.022,
  card: 0.03,
  clip: 0.036,
} as const;
/** How far the back of a chest piece sinks into the torso, out of sight. */
const CHEST_SINK = 0.01;

/** A flat piece over the chest: [width, height] at [x, y], `layer` in front of the torso. */
const chest = (
  size: readonly [number, number],
  at: readonly [number, number],
  layer: number,
  paint: Paint,
  options: Options = {},
): Piece =>
  torso(
    [size[0], size[1], CHEST_SINK + layer],
    [at[0], at[1], TORSO_FRONT + (CHEST_SINK - layer) / 2],
    paint,
    options,
  );

/** Hair: the colour is the player's. Pieces that sit on the head are `top`: a hat covers them. */
export const HAIR_PIECES: Record<HairStyle, Piece[]> = {
  short: [
    gear(
      [HAIR.width, HAIR.height, HAIR.depth],
      [0, hairCenter(false), HAIR.backShift],
      "hair",
      { top: true },
    ),
  ],
  long: [
    gear(
      [HAIR.width, HAIR.height, HAIR.depth],
      [0, hairCenter(false), HAIR.backShift],
      "hair",
      { top: true },
    ),
    gear(
      [HAIR.back.width, HAIR.back.height, HAIR.back.depth],
      [0, HEAD_CENTER + HAIR.back.dy, hairBackZ()],
      "hair",
    ),
  ],
  none: [],
  buzz: [
    gear([0.41, 0.05, 0.4], [0, HEAD_TOP_Y + 0.015, 0], "hair", { top: true }),
  ],
  bun: [
    gear(
      [HAIR.width, HAIR.height, HAIR.depth],
      [0, hairCenter(false), HAIR.backShift],
      "hair",
      { top: true },
    ),
    gear([0.15, 0.15, 0.15], [0, 1.95, 0.1], "hair", { top: true }),
  ],
  ponytail: [
    gear(
      [HAIR.width, HAIR.height, HAIR.depth],
      [0, hairCenter(false), HAIR.backShift],
      "hair",
      { top: true },
    ),
    gear([0.08, 0.1, 0.1], [0, 1.88, 0.25], "hair"),
    gear([0.1, 0.3, 0.08], [0, 1.68, 0.28], "hair"),
  ],
  curly: [
    gear([0.5, 0.14, 0.5], [0, 1.88, 0.03], "hair", { top: true }),
    gear([0.44, 0.08, 0.44], [0, 1.99, 0.03], "hair", { top: true }),
  ],
  mohawk: [
    gear([0.1, 0.12, 0.3], [0, 1.91, 0], "hair", { top: true }),
    gear([0.1, 0.06, 0.2], [0, 2.0, 0], "hair", { top: true }),
  ],
};

/** Laid on the front of the head, a hair's breadth proud of it. */
export const FACIAL_HAIR_PIECES: Record<FacialHair, Piece[]> = {
  none: [],
  stubble: [
    face([0.39, 0.14, 0.012], [0, CHIN_Y + 0.07, FRONT - 0.006], "stubble"),
  ],
  moustache: [face([0.17, 0.035, 0.02], [0, 1.585, FRONT - 0.01], "hair")],
  beard: [
    face([0.4, 0.15, 0.02], [0, CHIN_Y + 0.065, FRONT - 0.01], "hair"),
    face([0.02, 0.15, 0.2], [-0.205, CHIN_Y + 0.065, -0.09], "hair"),
    face([0.02, 0.15, 0.2], [0.205, CHIN_Y + 0.065, -0.09], "hair"),
    face([0.17, 0.035, 0.024], [0, 1.6, FRONT - 0.012], "hair"),
  ],
};

/** How far the eyes come out of the head to stay in front of clear lenses. */
const EYES_BEHIND_LENS = 0.016;
const FRAME_Z = FRONT - 0.006;
const LENS_Z = FRONT - 0.014;

const temples = (): Piece[] =>
  [-0.206, 0.206].map((x) =>
    face([0.012, 0.014, 0.2], [x, EYE_Y + 0.01, -0.09], DARK),
  );
const bridge = (): Piece =>
  face([0.07, 0.014, 0.012], [0, EYE_Y + 0.015, FRAME_Z], DARK, { fine: true });

export const GLASSES_PIECES: Record<Glasses, Piece[]> = {
  none: [],
  round: [
    ...EYES.xs.flatMap((x) => [
      face([0.11, 0.07, 0.012], [x, EYE_Y, FRAME_Z], DARK),
      face([0.07, 0.11, 0.012], [x, EYE_Y, FRAME_Z], DARK),
      face([0.08, 0.08, 0.004], [x, EYE_Y, LENS_Z], LENS),
    ]),
    bridge(),
    ...temples(),
  ],
  square: [
    ...EYES.xs.flatMap((x) => [
      face([0.11, 0.085, 0.012], [x, EYE_Y, FRAME_Z], DARK),
      face([0.09, 0.065, 0.004], [x, EYE_Y, LENS_Z], LENS),
    ]),
    bridge(),
    ...temples(),
  ],
  sunglasses: [
    ...EYES.xs.map((x) =>
      face([0.11, 0.075, 0.016], [x, EYE_Y, FRONT - 0.008], BLACK_LENS),
    ),
    bridge(),
    ...temples(),
  ],
};

/** Over the hair, in the colour of the shirt. */
export const HEADWEAR_PIECES: Record<Headwear, Piece[]> = {
  none: [],
  cap: [
    gear([0.44, 0.12, 0.44], [0, 1.91, 0.01], "shirt"),
    gear([0.36, 0.02, 0.14], [0, 1.86, -0.28], "shirtDark"),
  ],
  beanie: [
    gear([0.45, 0.15, 0.45], [0, 1.9, 0], "shirt"),
    gear([0.46, 0.04, 0.46], [0, 1.845, 0], "shirtDark"),
  ],
};

/**
 * The sleeves, which the top decides: "long" is the whole arm in the colour of
 * the shirt, as it always was. They stand in for the arm; the hand comes apart.
 */
export const SLEEVE_PIECES: Record<Top, Piece[]> = {
  long: [
    arm([ARM.width, ARM.height, ARM.depth], [0, -ARM.height / 2, 0], "shirt", {
      body: true,
    }),
  ],
  tee: [
    arm([ARM.width + 0.01, 0.2, ARM.depth + 0.01], [0, -0.1, 0], "shirt", {
      body: true,
    }),
    arm(
      [ARM.width, ARM.height - 0.2, ARM.depth],
      [0, -0.2 - (ARM.height - 0.2) / 2, 0],
      "skin",
      { body: true },
    ),
  ],
  hoodie: [
    arm([ARM.width, ARM.height, ARM.depth], [0, -ARM.height / 2, 0], "shirt", {
      body: true,
    }),
  ],
  collar: [
    arm([ARM.width, ARM.height, ARM.depth], [0, -ARM.height / 2, 0], "shirt", {
      body: true,
    }),
  ],
  blazer: [
    arm([ARM.width, ARM.height, ARM.depth], [0, -ARM.height / 2, 0], "shirt", {
      body: true,
    }),
  ],
};

/** What a top adds to the torso and the end of the sleeve: the torso itself never changes. */
export const TOP_PIECES: Record<Top, Piece[]> = {
  long: [],
  tee: [],
  hoodie: [
    torso([0.34, 0.14, 0.12], [0, NECK_Y + 0.01, 0.12], "shirt"),
    chest([0.3, 0.1], [0, 0.97], CHEST.shirt, "shirtDark"),
    ...[-0.05, 0.05].map((x) =>
      chest([0.012, 0.12], [x, 1.33], CHEST.accent, "white", { fine: true }),
    ),
    arm(
      [ARM.width + 0.01, 0.04, ARM.depth + 0.01],
      [0, -ARM.height + 0.02, 0],
      "shirtDark",
    ),
  ],
  collar: [
    torso([0.3, 0.045, 0.3], [0, NECK_Y + 0.0155, 0], "white"),
    chest([0.05, 0.04], [0, NECK_Y - 0.03], CHEST.accent, ACCENT),
    chest([0.06, 0.3], [0, NECK_Y - 0.2], CHEST.shirt, ACCENT),
  ],
  blazer: [
    chest([0.12, 0.36], [0, 1.24], CHEST.shirt, "white"),
    chest([0.06, 0.36], [-0.07, 1.24], CHEST.accent, "shirtDark", {
      rot: [0, 0, 0.18],
    }),
    chest([0.06, 0.36], [0.07, 1.24], CHEST.accent, "shirtDark", {
      rot: [0, 0, -0.18],
    }),
    arm(
      [ARM.width + 0.005, 0.025, ARM.depth + 0.005],
      [0, -ARM.height + 0.0125, 0],
      "white",
    ),
  ],
};

export const ACCESSORY_PIECES: Record<Accessory, Piece[]> = {
  none: [],
  headphones: [
    ...[-0.23, 0.23].map((x) =>
      gear([0.06, 0.14, 0.12], [x, HEAD_CENTER, 0], PHONES),
    ),
    ...[-0.235, 0.235].map((x) =>
      gear([0.03, 0.31, 0.03], [x, 1.8175, 0], DARK),
    ),
    gear([0.5, 0.03, 0.05], [0, 1.96, 0], DARK),
  ],
  lanyard: [
    chest([0.02, 0.26], [-0.06, 1.28], CHEST.strap, STRAP, {
      rot: [0, 0, 0.22],
    }),
    chest([0.02, 0.26], [0.06, 1.28], CHEST.strap, STRAP, {
      rot: [0, 0, -0.22],
    }),
    chest([0.09, 0.12], [0, 1.1], CHEST.card, "white", { fine: true }),
    chest([0.09, 0.03], [0, 1.145], CHEST.clip, STRAP, { fine: true }),
  ],
  watch: [
    arm([0.155, 0.035, ARM.depth + 0.01], [0, -ARM.height - 0.01, 0], WATCH, {
      side: "left",
      fine: true,
    }),
    arm([0.008, 0.04, 0.04], [0.081, -ARM.height - 0.01, 0], DIAL, {
      side: "left",
      fine: true,
    }),
  ],
  scarf: [
    torso([0.36, 0.09, 0.36], [0, NECK_Y + 0.005, 0], ACCENT),
    torso([0.1, 0.26, 0.02], [-0.08, 1.25, -0.18], ACCENT),
  ],
};

/** The body every look has: head, torso and hands. The eyes depend on the glasses. */
function bodyPieces(eyesZ: number): Piece[] {
  return [
    face([HEAD.width, HEAD.height, HEAD.depth], [0, HEAD_CENTER, 0], "skin", {
      body: true,
    }),
    ...EYES.xs.map((x) =>
      face([EYES.size, EYES.size, EYES.depth], [x, EYE_Y, eyesZ], EYE_COLOR, {
        body: true,
      }),
    ),
    torso(
      [TORSO.width, TORSO.height, TORSO.depth],
      [0, TORSO_CENTER, 0],
      "shirt",
      { body: true },
    ),
    arm(
      [HAND.width, HAND.height, HAND.depth],
      [0, -ARM.height - HAND.height / 2, 0],
      "skin",
      { body: true },
    ),
  ];
}

/** Where each moving part's own frame starts, in the avatar's frame. */
export function anchorOrigin(anchor: PlacedAnchor): Vec3 {
  if (anchor === "armL") return [-ARM.shoulderX, SHOULDER_Y, 0];
  if (anchor === "armR") return [ARM.shoulderX, SHOULDER_Y, 0];
  return [0, 0, 0];
}

const FRONT_EYES = FRONT - EYES.depth / 2;

/**
 * Every box of a look, with its colour decided. `low` leaves out the small
 * details.
 */
export function lookPieces(look: Appearance, detail: DetailLevel): Placed[] {
  const colors = appearanceColors(look);
  const paints: Record<Exclude<Paint, number>, number> = {
    skin: colors.skin,
    hair: colors.hair,
    stubble: mix(colors.skin, colors.hair, 0.4),
    shirt: colors.shirt,
    shirtDark: shade(colors.shirt, 0.72),
    white: 0xf4f4f0,
  };
  const colorOf = (paint: Paint) =>
    typeof paint === "number" ? paint : paints[paint];

  const top = TOPS[look.top];
  const hatted = HEADWEAR[look.headwear] !== "none";
  const clearLenses = ["round", "square"].includes(GLASSES[look.glasses]);
  const pieces = [
    ...bodyPieces(FRONT_EYES - (clearLenses ? EYES_BEHIND_LENS : 0)),
    ...SLEEVE_PIECES[top],
    ...HAIR_PIECES[HAIR_STYLES[look.hairStyle]].filter(
      (hair) => !(hatted && hair.top),
    ),
    ...HEADWEAR_PIECES[HEADWEAR[look.headwear]],
    ...FACIAL_HAIR_PIECES[FACIAL_HAIR[look.facialHair]],
    ...GLASSES_PIECES[GLASSES[look.glasses]],
    ...TOP_PIECES[top],
    ...ACCESSORY_PIECES[ACCESSORIES[look.accessory]],
  ];

  const placed: Placed[] = [];
  for (const item of pieces) {
    const fine = item.fine ?? false;
    if (fine && detail === "low") continue;
    const base = {
      size: item.size,
      color: colorOf(item.paint),
      fine,
      body: item.body ?? false,
    };
    if (item.anchor !== "arm") {
      placed.push({
        ...base,
        anchor: item.anchor,
        at: item.at,
        ...(item.rot && { rot: item.rot }),
      });
      continue;
    }
    for (const side of ["right", "left"] as const) {
      if (item.side && item.side !== side) continue;
      const mirror = side === "left" ? -1 : 1;
      placed.push({
        ...base,
        anchor: side === "left" ? "armL" : "armR",
        at: [item.at[0] * mirror, item.at[1], item.at[2]],
        ...(item.rot && {
          rot: [item.rot[0], item.rot[1] * mirror, item.rot[2] * mirror],
        }),
      });
    }
  }
  return placed;
}

/** The box of a piece in the avatar's frame at rest: where its corners reach. */
export function pieceBounds(placed: Placed): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const [rx, ry, rz] = placed.rot ?? [0, 0, 0];
  const origin = anchorOrigin(placed.anchor);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        let x = sx * placed.size[0];
        let y = sy * placed.size[1];
        let z = sz * placed.size[2];
        // Roll, then pitch, then yaw
        [x, y] = [
          x * Math.cos(rz) - y * Math.sin(rz),
          x * Math.sin(rz) + y * Math.cos(rz),
        ];
        [y, z] = [
          y * Math.cos(rx) - z * Math.sin(rx),
          y * Math.sin(rx) + z * Math.cos(rx),
        ];
        [x, z] = [
          x * Math.cos(ry) + z * Math.sin(ry),
          -x * Math.sin(ry) + z * Math.cos(ry),
        ];
        const corner = [
          x + placed.at[0] + origin[0],
          y + placed.at[1] + origin[1],
          z + placed.at[2] + origin[2],
        ];
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], corner[axis]);
          max[axis] = Math.max(max[axis], corner[axis]);
        }
      }
  return { min, max };
}
