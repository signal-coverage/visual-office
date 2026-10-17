import { describe, expect, it } from "vitest";
import {
  boardLayers,
  findShellProblems,
  outerWalls,
  sanitizeShell,
  screenFrameHeight,
  screenLayers,
  shellFloorBox,
  SHELL_LIMITS,
  slabBox,
  wallBoxes,
  type Shell,
} from "./shell.ts";

/** A small valid shell: a room with a private zone in the north-west corner, a board and a screen. */
function sample(): Shell {
  return {
    width: 24,
    depth: 16,
    walls: [],
    glass: [
      { x: -4, z: -5, width: 0.15, depth: 6 },
      { x: -8, z: -2, width: 8, depth: 0.15 },
    ],
    floors: [
      { x: -7.925, z: -4.925, width: 7.85, depth: 5.85, tone: "meeting" },
    ],
    zones: [
      {
        id: "room",
        label: "Room",
        rect: { minX: -11.85, maxX: -4.075, minZ: -7.85, maxZ: -2.075 },
      },
    ],
    areas: [
      {
        id: "room",
        label: "Room",
        rect: { minX: -12, maxX: -4, minZ: -8, maxZ: -2 },
      },
      {
        id: "open",
        label: "Open area",
        rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 },
      },
    ],
    boards: [
      {
        id: "room",
        zone: "room",
        facing: "east",
        face: -11.85,
        along: -5,
        y: 1.6,
        width: 2.6,
        height: 1.3,
      },
    ],
    screens: [
      {
        id: "room",
        zone: "room",
        facing: "south",
        face: -7.85,
        along: -8,
        y: 1.8,
        width: 3.3,
      },
    ],
    spawn: { area: { minX: -2, maxX: 2, minZ: 5.5, maxZ: 7 }, yaw: 0 },
  };
}

const codes = (shell: Shell) => findShellProblems(shell).map((p) => p.code);

describe("findShellProblems", () => {
  it("finds nothing wrong with a good shell", () => {
    expect(findShellProblems(sample())).toEqual([]);
  });

  it("refuses sizes the game cannot draw", () => {
    expect(codes({ ...sample(), width: 10 })).toContain("size");
    expect(codes({ ...sample(), width: 60 })).toContain("size");
    expect(codes({ ...sample(), depth: 8 })).toContain("size");
    expect(codes({ ...sample(), depth: 40 })).toContain("size");
  });

  it("keeps the height at the one the lights and the camera are made for", () => {
    expect(codes({ ...sample(), height: 3.2 })).toEqual([]);
    expect(codes({ ...sample(), height: 4 })).toContain("size");
  });

  it("refuses more parts than the limits", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        x: -10 + i * 0.5,
        z: 0,
        width: 0.2,
        depth: 0.2,
      }));
    expect(
      codes({ ...sample(), walls: many(SHELL_LIMITS.walls + 1) }),
    ).toContain("count");
    expect(
      codes({ ...sample(), glass: many(SHELL_LIMITS.glass + 1) }),
    ).toContain("count");
    const zones = Array.from({ length: SHELL_LIMITS.zones + 1 }, (_, i) => ({
      id: `z${i}`,
      label: `Zone ${i}`,
      rect: { minX: -11 + i * 0.1, maxX: -9, minZ: 0, maxZ: 2 },
    }));
    expect(codes({ ...sample(), zones })).toContain("count");
  });

  it("refuses walls that are not inside the floor or have no thickness", () => {
    expect(
      codes({
        ...sample(),
        walls: [{ x: 11.9, z: 0, width: 1, depth: 4 }],
      }),
    ).toContain("bounds");
    expect(
      codes({ ...sample(), walls: [{ x: 0, z: 0, width: 0, depth: 4 }] }),
    ).toContain("bounds");
    expect(
      codes({ ...sample(), walls: [{ x: 0, z: 0, width: 0.01, depth: 4 }] }),
    ).toContain("bounds");
    expect(
      codes({ ...sample(), glass: [{ x: 0, z: 0, width: 3, depth: 3 }] }),
    ).toContain("bounds");
  });

  it("refuses repeated ids and names, and ids that are not slugs", () => {
    const base = sample();
    const twin = { ...base.zones[0], rect: { ...base.zones[0].rect } };
    expect(
      codes({
        ...base,
        zones: [
          base.zones[0],
          {
            ...twin,
            label: "Other",
            rect: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 },
          },
        ],
      }),
    ).toContain("duplicate");
    expect(
      codes({
        ...base,
        zones: [
          base.zones[0],
          {
            ...twin,
            id: "b",
            label: "room",
            rect: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 },
          },
        ],
      }),
    ).toContain("duplicate");
    expect(
      codes({ ...base, zones: [{ ...base.zones[0], id: "Room.1" }] }),
    ).toContain("zone");
    expect(
      codes({
        ...base,
        areas: [base.areas[0], { ...base.areas[1], id: "room" }],
      }),
    ).toContain("duplicate");
    expect(
      codes({
        ...base,
        areas: [base.areas[0], { ...base.areas[1], label: "ROOM" }],
      }),
    ).toContain("duplicate");
  });

  it("refuses zones that overlap, are too small or stick out", () => {
    const base = sample();
    const second = (rect: Shell["zones"][number]["rect"]) => ({
      id: "b",
      label: "B",
      rect,
    });
    expect(
      codes({
        ...base,
        zones: [
          base.zones[0],
          second({ minX: -6, maxX: 0, minZ: -6, maxZ: 0 }),
        ],
      }),
    ).toContain("zone");
    expect(
      codes({
        ...base,
        zones: [
          base.zones[0],
          second({ minX: 2, maxX: 3, minZ: -6, maxZ: -2 }),
        ],
      }),
    ).toContain("zone");
    expect(
      codes({
        ...base,
        zones: [
          base.zones[0],
          second({ minX: 10, maxX: 14, minZ: -6, maxZ: -2 }),
        ],
      }),
    ).toContain("zone");
  });

  it("refuses areas that do not have an area or stick out", () => {
    const base = sample();
    expect(
      codes({
        ...base,
        areas: [
          { id: "x", label: "X", rect: { minX: 3, maxX: 3, minZ: 0, maxZ: 2 } },
        ],
      }),
    ).toContain("area");
    expect(
      codes({
        ...base,
        areas: [
          {
            id: "x",
            label: "X",
            rect: { minX: 0, maxX: 20, minZ: 0, maxZ: 2 },
          },
        ],
      }),
    ).toContain("area");
  });

  it("wants a board or a screen to hang on a wall of its own zone", () => {
    const base = sample();
    expect(
      codes({ ...base, boards: [{ ...base.boards[0], zone: "nowhere" }] }),
    ).toContain("mount");
    // Floating in the middle of the floor
    expect(
      codes({ ...base, boards: [{ ...base.boards[0], face: -9 }] }),
    ).toContain("mount");
    // On the wall, but facing the wall instead of the room
    expect(
      codes({ ...base, boards: [{ ...base.boards[0], facing: "west" }] }),
    ).toContain("mount");
    // Past the end of the wall
    expect(
      codes({ ...base, boards: [{ ...base.boards[0], along: 7.5 }] }),
    ).toContain("mount");
    // Far from the zone it belongs to
    expect(
      codes({
        ...base,
        screens: [
          { ...base.screens[0], face: 7.85, facing: "north", along: 0 },
        ],
      }),
    ).toContain("mount");
    // Higher than the wall
    expect(
      codes({ ...base, screens: [{ ...base.screens[0], y: 3.1 }] }),
    ).toContain("mount");
    expect(
      codes({ ...base, boards: [base.boards[0], { ...base.boards[0] }] }),
    ).toContain("duplicate");
  });

  it("does not let a board hang on glass", () => {
    const base = sample();
    expect(
      codes({
        ...base,
        boards: [
          {
            ...base.boards[0],
            facing: "west",
            face: -4.075,
            along: -5,
          },
        ],
      }),
    ).toContain("mount");
  });

  it("accepts boards and screens on the four sides of the outer walls", () => {
    const base = sample();
    const room = {
      id: "big",
      label: "Big",
      rect: { minX: -4, maxX: 4, minZ: -3, maxZ: 3 },
    };
    const on = (
      facing: "north" | "south" | "east" | "west",
      face: number,
      along: number,
    ) => ({
      id: "big",
      zone: "big",
      facing,
      face,
      along,
      y: 1.6,
      width: 2.6,
      height: 1.3,
    });
    // Zones that touch the outer walls: east, west, north and south
    const touching = (rect: typeof room.rect, board: ReturnType<typeof on>) =>
      findShellProblems({
        ...base,
        glass: [],
        floors: [],
        zones: [{ ...room, rect }],
        areas: [],
        boards: [board],
        screens: [],
        spawn: { area: { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 }, yaw: 0 },
      });
    expect(
      touching(
        { minX: 8, maxX: 11.85, minZ: -3, maxZ: 3 },
        on("west", 11.85, 0),
      ),
    ).toEqual([]);
    expect(
      touching(
        { minX: -11.85, maxX: -8, minZ: -3, maxZ: 3 },
        on("east", -11.85, 0),
      ),
    ).toEqual([]);
    expect(
      touching(
        { minX: -3, maxX: 3, minZ: -7.85, maxZ: -4 },
        on("south", -7.85, 0),
      ),
    ).toEqual([]);
    expect(
      touching(
        { minX: -3, maxX: 3, minZ: 4, maxZ: 7.85 },
        on("north", 7.85, 0),
      ),
    ).toEqual([]);
  });

  it("keeps the spawn area on the floor, clear of walls and out of the zones", () => {
    const base = sample();
    expect(
      codes({
        ...base,
        spawn: { area: { minX: -2, maxX: 2, minZ: 9, maxZ: 11 }, yaw: 0 },
      }),
    ).toContain("spawn");
    expect(
      codes({
        ...base,
        spawn: { area: { minX: -2, maxX: -2, minZ: 5, maxZ: 6 }, yaw: 0 },
      }),
    ).toContain("spawn");
    expect(
      codes({
        ...base,
        spawn: { area: { minX: 0, maxX: 0.5, minZ: 5, maxZ: 5.2 }, yaw: 0 },
      }),
    ).toContain("spawn");
    // A wall right across it
    expect(
      codes({
        ...base,
        walls: [{ x: 0, z: 6, width: 8, depth: 0.2 }],
      }),
    ).toContain("spawn");
    // Next to a wall, but not touching what a player's body needs
    expect(
      codes({
        ...base,
        walls: [{ x: 0, z: 3, width: 8, depth: 0.2 }],
      }),
    ).toEqual([]);
    // Inside a zone
    expect(
      codes({
        ...base,
        spawn: { area: { minX: -9, maxX: -7, minZ: -6, maxZ: -5 }, yaw: 0 },
      }),
    ).toContain("spawn");
    expect(
      codes({ ...base, spawn: { ...base.spawn, yaw: Number.NaN } }),
    ).toContain("spawn");
  });

  it("lets a board belong to the open floor: no zone, on a wall, facing nobody's room", () => {
    const base = sample();
    const open = {
      ...base.boards[0],
      id: "open",
      zone: null,
      facing: "north" as const,
      face: 7.85,
      along: 6,
    };
    expect(codes({ ...base, boards: [open] })).toEqual([]);
    // Still has to hang on a wall
    expect(codes({ ...base, boards: [{ ...open, face: 3 }] })).toContain(
      "mount",
    );
    // And not on a wall of a private room: only people in the room could reach it
    expect(
      codes({
        ...base,
        boards: [{ ...open, facing: "east", face: -11.85, along: -5 }],
      }),
    ).toContain("mount");
  });

  it("does not need any private zone", () => {
    expect(
      findShellProblems({
        ...sample(),
        glass: [],
        floors: [],
        zones: [],
        boards: [],
        screens: [],
      }),
    ).toEqual([]);
  });
});

describe("sanitizeShell", () => {
  it("returns an equal shell for a good one", () => {
    expect(sanitizeShell(sample())).toEqual(sample());
  });

  it("survives a trip through JSON", () => {
    expect(sanitizeShell(JSON.parse(JSON.stringify(sample())))).toEqual(
      sample(),
    );
  });

  it("keeps a board that belongs to the open floor, and still wants a screen to have a zone", () => {
    const shell = sanitizeShell({
      ...sample(),
      boards: [{ ...sample().boards[0], zone: null }],
      screens: [{ ...sample().screens[0], zone: null }],
    });
    expect(shell?.boards[0].zone).toBeNull();
    expect(shell?.screens).toEqual([]);
  });

  it("is null for what is not a shell", () => {
    for (const value of [null, undefined, 3, "x", [], {}, { width: 24 }])
      expect(sanitizeShell(value)).toBeNull();
    const withoutSpawn: Partial<Shell> = sample();
    delete withoutSpawn.spawn;
    expect(sanitizeShell(withoutSpawn)).toBeNull();
    expect(sanitizeShell({ ...sample(), width: "wide" })).toBeNull();
    expect(sanitizeShell({ ...sample(), depth: Infinity })).toBeNull();
    expect(
      sanitizeShell({ ...sample(), spawn: { ...sample().spawn, yaw: NaN } }),
    ).toBeNull();
  });

  it("rounds numbers to a millimetre", () => {
    const shell = sanitizeShell({
      ...sample(),
      width: 24.0004,
      depth: 16.0006,
    });
    expect(shell?.width).toBe(24);
    expect(shell?.depth).toBe(16.001);
  });

  it("leaves out the entries that are not valid instead of throwing", () => {
    const shell = sanitizeShell({
      ...sample(),
      walls: [
        { x: 0, z: 0, width: 2, depth: 0.2 },
        { x: "a", z: 0, width: 2, depth: 0.2 },
        null,
        7,
        { x: 0, z: Infinity, width: 2, depth: 0.2 },
      ],
      zones: [
        ...sample().zones,
        {
          id: "Bad Id",
          label: "Bad",
          rect: { minX: 0, maxX: 3, minZ: 0, maxZ: 3 },
        },
        {
          id: "nolabel",
          label: "   ",
          rect: { minX: 0, maxX: 3, minZ: 0, maxZ: 3 },
        },
        { id: "norect", label: "No rect" },
      ],
      boards: [{ ...sample().boards[0], facing: "up" }],
      floors: [{ x: 0, z: 0, width: 2, depth: 2, tone: "lava" }],
    });
    expect(shell?.walls).toEqual([{ x: 0, z: 0, width: 2, depth: 0.2 }]);
    expect(shell?.zones).toHaveLength(1);
    expect(shell?.boards).toEqual([]);
    expect(shell?.floors).toEqual([]);
  });

  it("cuts the lists at their limits", () => {
    const wall = { x: 0, z: 0, width: 1, depth: 0.2 };
    const shell = sanitizeShell({
      ...sample(),
      walls: Array.from({ length: 500 }, () => wall),
    });
    expect(shell?.walls).toHaveLength(SHELL_LIMITS.walls);
  });

  it("cleans names: no control characters, single spaces, short", () => {
    const shell = sanitizeShell({
      ...sample(),
      zones: [
        {
          ...sample().zones[0],
          label: "  Big\u0000\n   room  " + "x".repeat(80),
        },
      ],
    });
    const label = shell?.zones[0].label ?? "";
    expect(label.startsWith("Big room x")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(SHELL_LIMITS.labelLength);
    expect([...label].some((char) => char.charCodeAt(0) < 32)).toBe(false);
  });

  it("ignores what it does not know", () => {
    const shell = sanitizeShell({ ...sample(), evil: "<script>", x: { y: 1 } });
    expect(shell).toEqual(sample());
    expect(shell).not.toHaveProperty("evil");
  });

  it("does not take numbers far outside the world", () => {
    const shell = sanitizeShell({
      ...sample(),
      walls: [{ x: 1e9, z: 0, width: 2, depth: 0.2 }],
    });
    expect(shell?.walls).toEqual([]);
  });

  it("keeps a height that is a number, and refuses one that is not", () => {
    expect(sanitizeShell({ ...sample(), height: 3.2 })?.height).toBe(3.2);
    expect(sanitizeShell({ ...sample(), height: "tall" })).toBeNull();
  });
});

describe("shell geometry helpers", () => {
  it("gives every floor outer walls with their middle on its edge", () => {
    const walls = outerWalls({ width: 24, depth: 16 }).map(slabBox);
    expect(walls).toEqual([
      { minX: -12, maxX: 12, minZ: -8.15, maxZ: -7.85 },
      { minX: -12, maxX: 12, minZ: 7.85, maxZ: 8.15 },
      { minX: -12.15, maxX: -11.85, minZ: -8, maxZ: 8 },
      { minX: 11.85, maxX: 12.15, minZ: -8, maxZ: 8 },
    ]);
  });

  it("measures the floor inside the outer walls", () => {
    expect(shellFloorBox({ width: 24, depth: 16 })).toEqual({
      minX: -11.85,
      maxX: 11.85,
      minZ: -7.85,
      maxZ: 7.85,
    });
  });

  it("lists every wall that blocks, glass included", () => {
    expect(wallBoxes(sample())).toHaveLength(4 + 2);
  });

  it("puts the layers of a board in front of the wall it hangs on", () => {
    const [board] = sample().boards;
    const east = boardLayers(board);
    expect(east.frame).toBeCloseTo(-11.82, 9);
    expect(east.panel).toBeCloseTo(-11.81, 9);
    expect(east.surface).toBeCloseTo(-11.781, 9);
    const west = boardLayers({ ...board, facing: "west", face: 11.85 });
    expect(west.frame).toBeCloseTo(11.82, 9);
    expect(west.surface).toBeCloseTo(11.781, 9);
  });

  it("puts a screen's picture just in front of its frame", () => {
    const [screen] = sample().screens;
    const layers = screenLayers(screen);
    expect(layers.frame).toBeCloseTo(-7.82, 9);
    expect(layers.surface).toBeCloseTo(-7.786, 9);
    expect(screenFrameHeight(screen)).toBe(2);
    expect(screenFrameHeight({ ...screen, width: 4.4 })).toBeCloseTo(2.615, 9);
  });
});

describe("findShellProblems: what each problem is about", () => {
  const refsOf = (shell: Shell) =>
    findShellProblems(shell).flatMap((problem) => problem.refs ?? []);

  it("points at the wall that sticks out, by its place in the list", () => {
    const base = sample();
    const walls = [
      { x: 0, z: 0, width: 4, depth: 0.2 },
      { x: 11.9, z: 0, width: 1, depth: 4 },
    ];
    expect(refsOf({ ...base, walls })).toEqual([{ kind: "wall", index: 1 }]);
  });

  it("points at the glass, the floor patch, the zone, the area and the spawn", () => {
    const base = sample();
    expect(
      refsOf({ ...base, glass: [{ x: 0, z: 0, width: 3, depth: 3 }] }),
    ).toContainEqual({ kind: "glass", index: 0 });
    expect(
      refsOf({
        ...base,
        floors: [{ x: 0, z: 0, width: 40, depth: 2, tone: "lounge" }],
      }),
    ).toContainEqual({ kind: "floor", index: 0 });
    expect(
      refsOf({
        ...base,
        zones: [
          { ...base.zones[0], rect: { minX: 3, maxX: 3, minZ: 0, maxZ: 2 } },
        ],
      }),
    ).toContainEqual({ kind: "zone", index: 0 });
    expect(
      refsOf({
        ...base,
        areas: [
          { id: "x", label: "X", rect: { minX: 3, maxX: 3, minZ: 0, maxZ: 2 } },
        ],
      }),
    ).toContainEqual({ kind: "area", index: 0 });
    expect(
      refsOf({
        ...base,
        spawn: { area: { minX: 30, maxX: 31, minZ: 0, maxZ: 1 }, yaw: 0 },
      }),
    ).toContainEqual({ kind: "spawn", index: 0 });
  });

  it("points at both zones that overlap and at the board that hangs on no wall", () => {
    const base = sample();
    const second = {
      id: "b",
      label: "B",
      rect: { minX: -6, maxX: 0, minZ: -6, maxZ: 0 },
    };
    expect(refsOf({ ...base, zones: [base.zones[0], second] })).toEqual([
      { kind: "zone", index: 0 },
      { kind: "zone", index: 1 },
    ]);
    expect(
      refsOf({ ...base, boards: [{ ...base.boards[0], face: -9 }] }),
    ).toEqual([{ kind: "board", index: 0 }]);
    expect(
      refsOf({ ...base, screens: [{ ...base.screens[0], y: 3.1 }] }),
    ).toEqual([{ kind: "screen", index: 0 }]);
  });

  it("points at the zone that is not an id, a name or big enough", () => {
    const base = sample();
    expect(
      refsOf({ ...base, zones: [{ ...base.zones[0], id: "Room.1" }] }),
    ).toContainEqual({ kind: "zone", index: 0 });
    expect(
      refsOf({
        ...base,
        zones: [
          {
            ...base.zones[0],
            rect: { minX: -11, maxX: -10.5, minZ: -7, maxZ: -3 },
          },
        ],
      }),
    ).toContainEqual({ kind: "zone", index: 0 });
  });

  it("has nothing to point at for the size of the floor", () => {
    const sizeProblems = findShellProblems({ ...sample(), width: 10 }).filter(
      (problem) => problem.code === "size",
    );
    expect(sizeProblems.length).toBeGreaterThan(0);
    expect(sizeProblems.every((problem) => problem.refs === undefined)).toBe(
      true,
    );
  });
});
