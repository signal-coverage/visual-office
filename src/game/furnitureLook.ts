import { OFFICE_HEIGHT } from "../../shared/constants.ts";
import {
  CATALOG,
  type Furniture,
  type FurnitureKind,
} from "../../shared/furniture.ts";
import { PLANT_INFO } from "../../shared/interactions.ts";
import { COLORS } from "../../shared/pieces.ts";
import { SEAT_HEIGHT } from "../../shared/seats.ts";

/**
 * What each kind of furniture looks like: a handful of boxes and cylinders, as
 * plain data, measured with the kind turned 0° and standing at the origin (its
 * front is +z). What a kind blocks stays in shared/furniture.ts; nothing here
 * changes where anybody can walk. The client merges these into a few meshes
 * (furnitureMesh.ts); the tests hold them to the footprint, the seat height and
 * a triangle budget.
 */

export const DETAIL_LEVELS = ["high", "low"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export type Vec3 = readonly [number, number, number];

/** What a part is made of: lit paint, or something that glows a little. */
export type Surface = "solid" | "light" | "screen";

/** Parts the tests need to find. */
export type Role = "seat" | "back" | "screen" | "art" | "top";

interface PartBase {
  /** Where the middle of the part is: [dx, y, dz]. */
  at: Vec3;
  /** Pitch, yaw and roll in radians, applied as yaw of (pitch of roll). */
  rot?: Vec3;
  color: number;
  surface: Surface;
  /** Whether it is worth casting a shadow: small things are not. */
  shadow: boolean;
  /** Left out at the other level: a small detail has `only: "high"`. */
  only?: DetailLevel;
  role?: Role;
}

export interface BoxPart extends PartBase {
  shape: "box";
  /** [width, height, depth] */
  size: Vec3;
}

export interface CylinderPart extends PartBase {
  shape: "cylinder";
  radiusTop: number;
  radiusBottom: number;
  height: number;
  segments: number;
}

export type Part = BoxPart | CylinderPart;

interface Options {
  rot?: Vec3;
  surface?: Surface;
  shadow?: boolean;
  only?: DetailLevel;
  role?: Role;
}

const box = (
  size: Vec3,
  at: Vec3,
  color: number,
  options: Options = {},
): BoxPart => ({
  shape: "box",
  size,
  at,
  color,
  surface: options.surface ?? "solid",
  shadow: options.shadow ?? true,
  ...(options.rot && { rot: options.rot }),
  ...(options.only && { only: options.only }),
  ...(options.role && { role: options.role }),
});

const cylinder = (
  radius: number | readonly [top: number, bottom: number],
  height: number,
  segments: number,
  at: Vec3,
  color: number,
  options: Options = {},
): CylinderPart => {
  const [radiusTop, radiusBottom] =
    typeof radius === "number" ? [radius, radius] : radius;
  return {
    shape: "cylinder",
    radiusTop,
    radiusBottom,
    height,
    segments,
    at,
    color,
    surface: options.surface ?? "solid",
    shadow: options.shadow ?? true,
    ...(options.rot && { rot: options.rot }),
    ...(options.only && { only: options.only }),
    ...(options.role && { role: options.role }),
  };
};

/** A small detail: it casts no shadow and is dropped on low. */
const fine = (options: Options = {}): Options => ({
  ...options,
  shadow: false,
  only: "high",
});

const PAINT = {
  oak: COLORS.desk,
  oakDark: 0xb48f69,
  oakLight: 0xd8b48a,
  walnut: COLORS.meetingTable,
  walnutDark: 0x5a4430,
  steel: 0x3a3f45,
  steelLight: 0x9aa3ab,
  black: 0x1b1d20,
  keys: 0x555b63,
  cream: 0xf3e3c6,
  white: 0xf3efe6,
  paper: 0xf6f1e4,
  chair: COLORS.chair,
  chairSeat: 0x3b4450,
  sofa: COLORS.sofa,
  sofaSoft: 0x4a8f6a,
  sofaDark: 0x2f6148,
  orange: COLORS.pot,
  stone: 0xb98f62,
  tile: 0xe8dcc6,
  cabinet: 0xd9d3c7,
  topWhite: 0xe9dcc2,
  soil: 0x4a3526,
  trunk: 0x6b4a2f,
  screenOff: 0x10213a,
  frame: 0xcfcac0,
  posterFrame: 0x3a2f28,
  posterMat: 0xf7f2e8,
} as const;

const QUARTER = Math.PI / 2;

/** A monitor on a stand. `facing` is the side the screen looks to along z (1 is +z). */
function monitor(x: number, z: number, top: number, facing: 1 | -1): Part[] {
  const bezelZ = z - 0.035 * facing;
  return [
    box([0.26, 0.012, 0.17], [x, top + 0.006, z], COLORS.monitor),
    box([0.045, 0.09, 0.03], [x, top + 0.06, bezelZ], COLORS.monitor),
    box([0.62, 0.38, 0.035], [x, top + 0.28, bezelZ], COLORS.monitor),
    box(
      [0.56, 0.32, 0.006],
      [x, top + 0.28, bezelZ + 0.0205 * facing],
      PAINT.screenOff,
      { surface: "screen", shadow: false, role: "screen" },
    ),
  ];
}

function keyboard(x: number, y: number, z: number): Part[] {
  return [
    box([0.42, 0.018, 0.15], [x, y + 0.009, z], 0x2e3238, { shadow: false }),
    box([0.38, 0.006, 0.11], [x, y + 0.021, z], PAINT.keys, fine()),
  ];
}

function mug(x: number, y: number, z: number, color: number): Part[] {
  return [
    cylinder(0.04, 0.09, 8, [x, y + 0.045, z], color, fine()),
    box([0.012, 0.05, 0.03], [x + 0.047, y + 0.045, z], color, fine()),
  ];
}

/** A tilted blade or leaf: `up` is how far its tip is raised from flat, `yaw` the way it points. */
function leaf(
  base: Vec3,
  length: number,
  width: number,
  up: number,
  yaw: number,
  color: number,
  options: Options = {},
  thickness = 0.02,
): BoxPart {
  const reach = (length / 2) * Math.cos(up);
  return box(
    [width, thickness, length],
    [
      base[0] + Math.sin(yaw) * reach,
      base[1] + (length / 2) * Math.sin(up),
      base[2] + Math.cos(yaw) * reach,
    ],
    color,
    { ...options, rot: [-up, yaw, 0] },
  );
}

/** Two halves of a split leaf with a small gap between them. */
function splitLeaf(
  base: Vec3,
  length: number,
  width: number,
  up: number,
  yaw: number,
  color: number,
  options: Options = {},
): Part[] {
  return [-0.16, 0.16].map((spread) =>
    leaf(base, length, width / 2, up, yaw + spread, color, options),
  );
}

function desk(): Part[] {
  return [
    box([1.8, 0.04, 0.9], [0, 0.73, 0], PAINT.oak, { role: "top" }),
    box([0.04, 0.71, 0.8], [-0.86, 0.355, 0], PAINT.oakDark),
    box([0.04, 0.71, 0.8], [0.86, 0.355, 0], PAINT.oakDark),
    box([0.48, 0.71, 0.78], [0.6, 0.355, 0], PAINT.oakDark),
    ...[0.58, 0.36, 0.14].flatMap((y) => [
      box([0.44, 0.2, 0.012], [0.6, y, 0.396], 0xc29a72, { shadow: false }),
      box([0.14, 0.025, 0.02], [0.6, y + 0.05, 0.412], PAINT.steel, fine()),
    ]),
    box([1.14, 0.38, 0.02], [-0.27, 0.52, -0.37], PAINT.oakDark),
    ...monitor(0, -0.2, 0.75, 1),
    ...keyboard(0, 0.75, 0.12),
    box([0.06, 0.025, 0.1], [0.33, 0.7625, 0.12], 0x2e3238, fine()),
    ...mug(-0.72, 0.75, -0.1, PAINT.white),
    box([0.2, 0.012, 0.28], [-0.5, 0.756, 0.22], PAINT.paper, fine()),
  ];
}

function chair(): Part[] {
  const arms = [0, 1, 2, 3, 4].flatMap((i) => {
    const angle = (i * 2 * Math.PI) / 5 + Math.PI / 10;
    const [sin, cos] = [Math.sin(angle), Math.cos(angle)];
    return [
      box([0.045, 0.03, 0.22], [sin * 0.11, 0.075, cos * 0.11], PAINT.steel, {
        rot: [0, angle, 0],
        only: "high",
        shadow: false,
      }),
      box([0.05, 0.06, 0.05], [sin * 0.2, 0.03, cos * 0.2], 0x111214, fine()),
    ];
  });
  const armrests = [-1, 1].flatMap((side) => [
    box([0.035, 0.025, 0.22], [side * 0.235, 0.62, 0.02], PAINT.steel, fine()),
    box([0.03, 0.17, 0.03], [side * 0.235, 0.535, 0.02], PAINT.steel, fine()),
  ]);
  return [
    cylinder(0.2, 0.06, 10, [0, 0.03, 0], PAINT.steel, {
      only: "low",
      shadow: false,
    }),
    cylinder(0.05, 0.06, 8, [0, 0.06, 0], PAINT.steel, fine()),
    ...arms,
    cylinder(0.028, 0.34, 6, [0, 0.21, 0], PAINT.steel, { shadow: false }),
    box([0.46, 0.04, 0.44], [0, 0.4, -0.02], PAINT.chair),
    box([0.44, 0.03, 0.42], [0, 0.435, -0.02], PAINT.chairSeat, {
      role: "seat",
    }),
    box([0.05, 0.22, 0.03], [0, 0.52, 0.195], PAINT.steel, { shadow: false }),
    box([0.44, 0.36, 0.06], [0, 0.74, 0.195], PAINT.chairSeat, {
      rot: [0.12, 0, 0],
      role: "back",
    }),
    ...armrests,
  ];
}

function meetingTable(): Part[] {
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      box([0.08, 0.7, 0.08], [sx * 0.5, 0.35, sz * 1.5], PAINT.walnutDark),
    ),
  );
  return [
    box([1.2, 0.05, 3.2], [0, 0.725, 0], PAINT.walnut, { role: "top" }),
    ...legs,
    ...[-1, 1].map((side) =>
      box([0.04, 0.09, 2.9], [side * 0.5, 0.655, 0], PAINT.walnutDark, {
        shadow: false,
      }),
    ),
    ...[-1, 1].map((side) =>
      box([0.92, 0.09, 0.04], [0, 0.655, side * 1.5], PAINT.walnutDark, {
        shadow: false,
      }),
    ),
    box([0.1, 0.006, 0.28], [0, 0.753, 0], PAINT.black, fine()),
  ];
}

function conferenceTable(): Part[] {
  return [
    box([4, 0.05, 1.6], [0, 0.725, 0], PAINT.walnut, { role: "top" }),
    box([3.9, 0.03, 1.5], [0, 0.685, 0], PAINT.walnutDark),
    ...[-1, 1].flatMap((side) => [
      box([0.12, 0.67, 1.2], [side * 1.6, 0.335, 0], PAINT.walnutDark),
      box([0.22, 0.04, 1.4], [side * 1.6, 0.02, 0], PAINT.steel, {
        shadow: false,
      }),
    ]),
    box([3.2, 0.08, 0.1], [0, 0.6, 0], PAINT.walnutDark, { shadow: false }),
    ...[-1.2, 1.2].map((x) =>
      box([0.16, 0.012, 0.16], [x, 0.756, 0], PAINT.black, fine()),
    ),
    cylinder(0.09, 0.03, 10, [0, 0.765, 0], PAINT.black, fine()),
  ];
}

function counter(): Part[] {
  const doors = Array.from({ length: 8 }, (_, i) => i - 3.5).flatMap((x) => [
    box([0.96, 0.74, 0.014], [x, 0.49, 0.477], COLORS.counter, {
      shadow: false,
    }),
    box([0.02, 0.14, 0.022], [x + 0.4, 0.7, 0.495], PAINT.steel, fine()),
  ]);
  const sinkX = -2.2;
  const cookX = 1.6;
  return [
    box([7.9, 0.1, 0.88], [0, 0.05, -0.03], PAINT.steel, { shadow: false }),
    box([7.9, 0.81, 0.94], [0, 0.505, 0], PAINT.cabinet),
    box([8, 0.04, 1], [0, 0.93, 0], PAINT.stone, { role: "top" }),
    ...doors,
    box([8, 0.2, 0.03], [0, 1.05, -0.485], PAINT.tile, { shadow: false }),
    box([0.8, 0.008, 0.46], [sinkX, 0.954, 0], PAINT.steelLight, {
      shadow: false,
    }),
    cylinder(0.03, 0.03, 6, [sinkX, 0.965, -0.3], PAINT.steelLight, fine()),
    cylinder(0.014, 0.22, 6, [sinkX, 1.08, -0.3], PAINT.steelLight, fine()),
    box([0.02, 0.02, 0.16], [sinkX, 1.18, -0.22], PAINT.steelLight, fine()),
    box([0.72, 0.01, 0.52], [cookX, 0.955, 0], PAINT.black, { shadow: false }),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        cylinder(
          0.085,
          0.008,
          8,
          [cookX + sx * 0.18, 0.964, sz * 0.12],
          0x3b3d42,
          fine(),
        ),
      ),
    ),
    box([0.26, 0.36, 0.3], [3.2, 1.13, -0.28], 0xa83a2e, fine()),
    box([0.1, 0.11, 0.1], [3.2, 1.005, -0.12], 0x2a2c30, fine()),
    box([0.28, 0.18, 0.18], [3.9, 1.04, -0.2], 0xbfc3c8, fine()),
  ];
}

function island(): Part[] {
  const doors = [-0.855, -0.285, 0.285, 0.855].flatMap((x) => [
    box([0.54, 0.62, 0.014], [x, 0.5, -0.567], PAINT.oakLight, {
      shadow: false,
    }),
    box([0.1, 0.022, 0.022], [x, 0.74, -0.585], PAINT.steel, fine()),
  ]);
  return [
    box([2.2, 0.1, 0.8], [0, 0.05, -0.1], PAINT.walnutDark, { shadow: false }),
    box([2.3, 0.8, 0.91], [0, 0.5, -0.105], COLORS.island),
    ...doors,
    box([2.4, 0.05, 1.2], [0, 0.925, 0], 0xe8dfcd, { role: "top" }),
    ...[-1, 1].map((side) =>
      box([0.07, 0.9, 0.07], [side * 1.12, 0.45, 0.55], PAINT.walnutDark),
    ),
    cylinder([0.14, 0.09], 0.07, 10, [0.5, 0.985, 0.1], PAINT.white, fine()),
    box([0.07, 0.07, 0.07], [0.47, 1.04, 0.09], 0xd9482e, fine()),
    box([0.07, 0.07, 0.07], [0.54, 1.04, 0.12], 0xf0a030, fine()),
    box([0.06, 0.06, 0.06], [0.5, 1.07, 0.1], 0x7fb04a, fine()),
    ...mug(-0.6, 0.95, 0.15, PAINT.orange),
    ...mug(-0.4, 0.95, 0.25, PAINT.white),
  ];
}

function sofa(): Part[] {
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      box([0.07, 0.08, 0.07], [sx * 1.65, 0.04, sz * 0.42], PAINT.walnutDark, {
        shadow: false,
      }),
    ),
  );
  const cushions = [-0.98, 0, 0.98].flatMap((x) => [
    box([0.97, 0.2, 0.7], [x, 0.36, -0.03], PAINT.sofaSoft),
    box([0.92, 0.4, 0.14], [x, 0.66, 0.22], PAINT.sofaSoft, {
      rot: [0.22, 0, 0],
    }),
  ]);
  return [
    ...legs,
    box([3.5, 0.18, 1], [0, 0.17, 0], PAINT.sofaDark),
    ...[-1, 1].flatMap((side) => [
      box([0.28, 0.44, 0.94], [side * 1.61, 0.48, -0.03], PAINT.sofa),
      box([0.28, 0.05, 0.96], [side * 1.61, 0.725, -0.02], PAINT.sofaSoft),
    ]),
    box([2.94, 0.55, 0.18], [0, 0.535, 0.41], PAINT.sofa),
    ...cushions,
    box([0.36, 0.36, 0.1], [-1.2, 0.64, 0.05], PAINT.orange, {
      rot: [0.25, 0.3, 0],
      ...fine(),
    }),
    box([0.36, 0.36, 0.1], [1.25, 0.64, 0.05], PAINT.cream, {
      rot: [0.25, -0.3, 0],
      ...fine(),
    }),
  ];
}

function receptionDesk(): Part[] {
  return [
    box([2.9, 0.1, 0.9], [0, 0.05, 0], PAINT.steel, { shadow: false }),
    ...[-1, 1].map((side) =>
      box([0.06, 0.75, 0.9], [side * 1.47, 0.475, 0], PAINT.oakDark),
    ),
    box([2.88, 0.89, 0.46], [0, 0.545, 0.26], COLORS.receptionDesk),
    box([2.5, 0.05, 0.012], [0, 0.55, 0.496], PAINT.cream, { shadow: false }),
    box([0.5, 0.2, 0.012], [0, 0.78, 0.496], PAINT.cream, fine()),
    box([3, 0.06, 0.6], [0, 1.02, 0.2], PAINT.topWhite, { role: "top" }),
    box([2.88, 0.05, 0.4], [0, 0.775, -0.3], PAINT.oak),
    box([2.88, 0.45, 0.03], [0, 0.525, -0.485], PAINT.oakDark),
    ...monitor(0.8, -0.28, 0.8, -1),
    ...keyboard(0.8, 0.8, -0.42),
    cylinder(
      [0.045, 0.05],
      0.035,
      8,
      [-1, 1.0675, 0.3],
      PAINT.steelLight,
      fine(),
    ),
    box([0.22, 0.12, 0.06], [1, 1.11, 0.3], PAINT.white, fine()),
  ];
}

function plant(variant: number): Part[] {
  const pots = [PAINT.orange, 0xe8dcc0, 0x4a4f57];
  const green = [0x4f8a4a, 0x5e9b52, 0x3f7a42];
  const pot = (color: number): Part[] => [
    cylinder([0.2, 0.14], 0.32, 10, [0, 0.16, 0], color),
    cylinder(0.22, 0.05, 10, [0, 0.295, 0], color, { only: "high" }),
    cylinder(0.19, 0.02, 8, [0, 0.325, 0], PAINT.soil, { shadow: false }),
  ];
  const at = (y: number): Vec3 => [0, y, 0];

  if (variant === 1)
    return [
      ...pot(pots[1]),
      ...[0, 1, 2].flatMap((i) => {
        const yaw = i * 2.1 + 0.3;
        const stalk = leaf(
          at(0.33),
          0.45,
          0.026,
          1.4,
          yaw,
          0x4a7a3c,
          {},
          0.026,
        );
        const top: Vec3 = [
          Math.sin(yaw) * 0.45 * Math.cos(1.4),
          0.33 + 0.45 * Math.sin(1.4),
          Math.cos(yaw) * 0.45 * Math.cos(1.4),
        ];
        return [stalk, ...splitLeaf(top, 0.22, 0.28, 0.45, yaw, green[i % 2])];
      }),
      ...[0, 1, 2, 3].flatMap((i) => {
        const yaw = i * 1.57 + 1.0;
        const stalk = leaf(
          at(0.33),
          0.3,
          0.024,
          1.22,
          yaw,
          0x4a7a3c,
          {
            only: "high",
          },
          0.024,
        );
        const top: Vec3 = [
          Math.sin(yaw) * 0.3 * Math.cos(1.22),
          0.33 + 0.3 * Math.sin(1.22),
          Math.cos(yaw) * 0.3 * Math.cos(1.22),
        ];
        return [
          stalk,
          ...splitLeaf(top, 0.16, 0.24, 0.3, yaw, green[2], { only: "high" }),
        ];
      }),
    ];

  if (variant === 2)
    return [
      ...pot(pots[2]),
      ...Array.from({ length: 9 }, (_, i) => {
        const yaw = i * 2.4;
        const radius = 0.03 + (i % 3) * 0.025;
        const length = 0.55 + ((i * 37) % 5) * 0.06;
        return leaf(
          [Math.sin(yaw) * radius, 0.32, Math.cos(yaw) * radius],
          length,
          0.075,
          1.42 + (i % 3) * 0.05,
          yaw,
          [0x35704a, 0x4a8a50, 0x2f5f3a][i % 3],
          i % 3 === 2 ? { only: "high" } : {},
          0.026,
        );
      }),
    ];

  return [
    ...pot(pots[0]),
    cylinder([0.022, 0.03], 0.5, 5, [0, 0.56, 0], PAINT.trunk, {
      shadow: false,
    }),
    ...[0, 1, 2, 3].map((i) =>
      leaf(at(0.5), 0.3, 0.16, 0.52, i * QUARTER + 0.35, green[i % 2]),
    ),
    ...[0, 1, 2, 3].map((i) =>
      leaf(at(0.68), 0.27, 0.15, 0.78, i * QUARTER + 0.95, green[(i + 1) % 2], {
        only: "high",
      }),
    ),
    ...[0, 1, 2].map((i) =>
      leaf(at(0.8), 0.25, 0.13, 1.1, i * 2.1 + 0.2, green[2]),
    ),
  ];
}

function poster(variant: number): Part[] {
  const art = CATALOG.poster.pieces(variant)[0].color;
  const accent = [0xfff1c9, 0x7a3b1d, 0xf4ffe9][variant] ?? 0xfff1c9;
  const frame = box([0.9, 1.2, 0.03], [0, 1.7, 0], PAINT.posterFrame, {
    shadow: false,
  });
  return [
    frame,
    box([0.8, 1.1, 0.034], [0, 1.7, 0], PAINT.posterMat, { shadow: false }),
    box([0.66, 0.96, 0.038], [0, 1.7, 0], art, { shadow: false, role: "art" }),
    box([0.66, 0.14, 0.04], [0, 1.4, 0], accent, { shadow: false }),
    box([0.24, 0.24, 0.04], [0.1, 1.85, 0], accent, { shadow: false }),
  ];
}

function rug(): Part[] {
  return [
    box([4.2, 0.02, 4.8], [0, 0.011, 0], 0x2c4468, { shadow: false }),
    box([3.8, 0.004, 4.4], [0, 0.023, 0], COLORS.rug, { shadow: false }),
    box([1.7, 0.004, 1.7], [0, 0.027, 0], 0x4b6fa3, {
      shadow: false,
      rot: [0, Math.PI / 4, 0],
    }),
    box([0.6, 0.004, 0.6], [0, 0.031, 0], 0xe8d9b8, {
      shadow: false,
      rot: [0, Math.PI / 4, 0],
      only: "high",
    }),
  ];
}

function light(): Part[] {
  const top = OFFICE_HEIGHT;
  return [
    box([1.4, 0.04, 0.5], [0, top - 0.025, 0], PAINT.frame, { shadow: false }),
    box([1.3, 0.012, 0.4], [0, top - 0.051, 0], COLORS.light, {
      surface: "light",
      shadow: false,
    }),
  ];
}

const BUILDERS: Record<FurnitureKind, (variant: number) => Part[]> = {
  desk,
  chair,
  "meeting-table": meetingTable,
  "conference-table": conferenceTable,
  counter,
  island,
  sofa,
  "reception-desk": receptionDesk,
  rug,
  plant,
  poster,
  light,
};

const cache = new Map<string, readonly Part[]>();

/** The parts of a kind at a level of detail. An unknown variant of a plant looks like the first. */
export function lookOf(
  kind: FurnitureKind,
  variant: number,
  level: DetailLevel,
): readonly Part[] {
  const known =
    kind === "plant" ? (variant < PLANT_INFO.length ? variant : 0) : variant;
  const key = `${kind}|${known}|${level}`;
  let parts = cache.get(key);
  if (!parts) {
    parts = BUILDERS[kind](known).filter(
      (part) => !part.only || part.only === level,
    );
    cache.set(key, parts);
  }
  return parts;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** The same turn as three.js applies with Euler order YXZ: yaw of (pitch of roll). */
function turnBy(v: Vec3, [rx, ry, rz]: Vec3): [number, number, number] {
  let [x, y, z] = v;
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
  return [x, y, z];
}

/** The box around a part, in the local space of its kind. */
export function boundsOf(part: Part): Bounds {
  const size: Vec3 =
    part.shape === "box"
      ? part.size
      : [
          2 * Math.max(part.radiusTop, part.radiusBottom),
          part.height,
          2 * Math.max(part.radiusTop, part.radiusBottom),
        ];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const corner = turnBy(
          [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2],
          part.rot ?? [0, 0, 0],
        );
        for (let axis = 0; axis < 3; axis++) {
          const value = corner[axis] + part.at[axis];
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
  return { min, max };
}

const QUARTER_TURNS = { 0: 0, 90: 1, 180: 2, 270: 3 } as const;

/** The box around a part where the piece stands, turned as it is turned (the same turn as shared/furniture.ts). */
export function placedBounds(
  part: Part,
  item: Pick<Furniture, "x" | "z" | "rotation">,
): Bounds {
  const local = boundsOf(part);
  const turns = QUARTER_TURNS[item.rotation];
  const corners = [local.min[0], local.max[0]].flatMap((x) =>
    [local.min[2], local.max[2]].map((z) => {
      let [px, pz] = [x, z];
      for (let i = 0; i < turns; i++) [px, pz] = [pz, -px];
      return [px + item.x, pz + item.z];
    }),
  );
  return {
    min: [
      Math.min(...corners.map((c) => c[0])),
      local.min[1],
      Math.min(...corners.map((c) => c[1])),
    ],
    max: [
      Math.max(...corners.map((c) => c[0])),
      local.max[1],
      Math.max(...corners.map((c) => c[1])),
    ],
  };
}

/** The triangles a part draws, as three.js builds it. */
export function partTriangles(part: Part): number {
  if (part.shape === "box") return 12;
  const sides =
    (part.radiusTop > 0 ? part.segments : 0) +
    (part.radiusBottom > 0 ? part.segments : 0);
  return sides * 2;
}

export function triangleCount(parts: readonly Part[]): number {
  return parts.reduce((sum, part) => sum + partTriangles(part), 0);
}

/**
 * The most triangles a kind may draw at each level, for any variant. A kind
 * that grows past its number needs a reason, not a bigger number.
 */
export const TRIANGLE_BUDGET: Readonly<
  Record<FurnitureKind, Readonly<Record<DetailLevel, number>>>
> = {
  desk: { high: 300, low: 170 },
  chair: { high: 300, low: 125 },
  "meeting-table": { high: 135, low: 120 },
  "conference-table": { high: 165, low: 95 },
  counter: { high: 540, low: 185 },
  island: { high: 350, low: 120 },
  sofa: { high: 240, low: 210 },
  "reception-desk": { high: 250, low: 170 },
  rug: { high: 55, low: 40 },
  plant: { high: 400, low: 200 },
  poster: { high: 66, low: 66 },
  light: { high: 28, low: 28 },
};

export { SEAT_HEIGHT };
