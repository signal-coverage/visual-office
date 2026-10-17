import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL } from "../../shared/defaultShell.ts";
import type { Furniture } from "../../shared/furniture.ts";
import {
  findShellProblems,
  SHELL_LIMITS,
  type Shell,
  type ShellRef,
} from "../../shared/shell.ts";
import {
  addArea,
  addFloorPatch,
  addWall,
  addZone,
  anchorOf,
  deleteRef,
  describeOutside,
  geometryOf,
  labelProblem,
  lineFromDrag,
  moveTo,
  nudge,
  partsOutside,
  pickStructure,
  placeMount,
  rectFromDrag,
  renameRef,
  resizeFloor,
  setGeometry,
  setMount,
  setSpawnArea,
  setSpawnYaw,
  setTone,
  slugOf,
  uniqueId,
} from "./shellEdit";

const WIDE = { minX: -12, maxX: 12, minZ: -8, maxZ: 8 };

/** A 24 by 16 floor with nothing on it but the place where people appear. */
function empty(): Shell {
  return {
    width: 24,
    depth: 16,
    walls: [],
    glass: [],
    floors: [],
    zones: [],
    areas: [],
    boards: [],
    screens: [],
    spawn: { area: { minX: -2, maxX: 2, minZ: 5.5, maxZ: 7 }, yaw: 0 },
  };
}

/** The same floor with a private room in the north-west corner, closed by glass. */
function withRoom(): Shell {
  return {
    ...empty(),
    glass: [
      { x: -4, z: -5, width: 0.15, depth: 6 },
      { x: -8, z: -2, width: 8, depth: 0.15 },
    ],
    zones: [
      {
        id: "room",
        label: "Room",
        rect: { minX: -11.85, maxX: -4.075, minZ: -7.85, maxZ: -2.075 },
      },
    ],
  };
}

const edit = (result: ReturnType<typeof addWall>) => {
  if ("error" in result) throw new Error(result.error);
  return result;
};

describe("slugOf and uniqueId", () => {
  it("turns a name into a lowercase slug the validator accepts", () => {
    expect(slugOf("Meeting room")).toBe("meeting-room");
    expect(slugOf("  Sala  de Reunión #2!  ")).toBe("sala-de-reunion-2");
    expect(slugOf("---")).toBe("");
  });

  it("keeps a slug within the length of an id", () => {
    const slug = slugOf("A very long name for a private room that goes on");
    expect(slug.length).toBeLessThanOrEqual(SHELL_LIMITS.idLength);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("makes an id that is not taken yet", () => {
    expect(uniqueId("room", [])).toBe("room");
    expect(uniqueId("room", ["room"])).toBe("room-2");
    expect(uniqueId("room", ["room", "room-2", "room-3"])).toBe("room-4");
  });

  it("shortens the base so the number still fits", () => {
    const base = "a".repeat(SHELL_LIMITS.idLength);
    const id = uniqueId(base, [base]);
    expect(id.length).toBeLessThanOrEqual(SHELL_LIMITS.idLength);
    expect(id.endsWith("-2")).toBe(true);
  });
});

describe("lineFromDrag: a wall drawn with the mouse", () => {
  const opts = { step: 0.25, thickness: 0.2, within: WIDE };

  it("makes a thin wall along x from a nearly horizontal drag", () => {
    expect(lineFromDrag([-5.02, 0.1], [3.1, -0.05], opts)).toEqual({
      x: -1,
      z: 0,
      width: 8,
      depth: 0.2,
    });
  });

  it("makes a thin wall along z from a vertical drag, whichever way it goes", () => {
    expect(lineFromDrag([2, 6], [2.1, -1], opts)).toEqual({
      x: 2,
      z: 2.5,
      width: 0.2,
      depth: 7,
    });
  });

  it("snaps both ends to the grid", () => {
    const slab = lineFromDrag([0.1, 0.1], [4.9, 0.12], opts);
    expect(slab).toEqual({ x: 2.5, z: 0, width: 5, depth: 0.2 });
  });

  it("makes nothing from a click or a drag shorter than the shortest wall", () => {
    expect(lineFromDrag([1, 1], [1, 1], opts)).toBeNull();
    expect(lineFromDrag([1, 1], [1.1, 1.05], opts)).toBeNull();
  });

  it("keeps a wall inside the middle of the outer walls", () => {
    const slab = lineFromDrag([-20, 0], [5, 0], opts);
    expect(slab).toEqual({ x: -3.5, z: 0, width: 17, depth: 0.2 });
  });

  it("gives glass its own thinner default", () => {
    const slab = lineFromDrag([0, 0], [4, 0], { ...opts, thickness: 0.15 });
    expect(slab?.depth).toBe(0.15);
  });

  it("takes a rectangle with a thickness between 0.5 and 1 m as a thick wall", () => {
    expect(lineFromDrag([0, 0], [4, 0.75], opts)).toEqual({
      x: 2,
      z: 0.375,
      width: 4,
      depth: 0.75,
    });
  });

  it("does not make a wall thicker than the validator allows: a fat drag is a line along its long side", () => {
    const slab = lineFromDrag([0, 0], [6, 3], opts);
    expect(slab).toEqual({ x: 3, z: 0, width: 6, depth: 0.2 });
  });
});

describe("rectFromDrag: a room drawn with the mouse", () => {
  const opts = { step: 0.25, within: WIDE, min: { width: 2, depth: 2 } };

  it("does not care which corner the drag starts from", () => {
    const a = rectFromDrag([-8, -6], [-3, -3], opts);
    const b = rectFromDrag([-3, -3], [-8, -6], opts);
    expect(a).toEqual({ minX: -8, maxX: -3, minZ: -6, maxZ: -3 });
    expect(b).toEqual(a);
  });

  it("snaps to the grid", () => {
    expect(rectFromDrag([-8.1, -6.1], [-2.9, -2.8], opts)).toEqual({
      minX: -8,
      maxX: -3,
      minZ: -6,
      maxZ: -2.75,
    });
  });

  it("makes nothing from a click", () => {
    expect(rectFromDrag([1, 1], [1.05, 1.1], opts)).toBeNull();
  });

  it("grows a rectangle that is smaller than the least side, away from where it started", () => {
    expect(rectFromDrag([0, 0], [0.5, 1], opts)).toEqual({
      minX: 0,
      maxX: 2,
      minZ: 0,
      maxZ: 2,
    });
    expect(rectFromDrag([0, 0], [-0.5, -1], opts)).toEqual({
      minX: -2,
      maxX: 0,
      minZ: -2,
      maxZ: 0,
    });
  });

  it("keeps the rectangle inside the bounds, moving it back in when it has to grow past them", () => {
    expect(rectFromDrag([-30, -30], [-5, -5], opts)).toEqual({
      minX: -12,
      maxX: -5,
      minZ: -8,
      maxZ: -5,
    });
    expect(rectFromDrag([11.5, 0], [11.75, 0.25], opts)).toEqual({
      minX: 10,
      maxX: 12,
      minZ: 0,
      maxZ: 2,
    });
  });
});

describe("addWall", () => {
  it("adds a wall or a glass wall and says which one it is", () => {
    const slab = { x: 0, z: 0, width: 4, depth: 0.2 };
    const wall = edit(addWall(empty(), "wall", slab));
    expect(wall.shell.walls).toEqual([slab]);
    expect(wall.ref).toEqual({ kind: "wall", index: 0 });
    const glass = edit(addWall(wall.shell, "glass", slab));
    expect(glass.shell.glass).toEqual([slab]);
    expect(glass.ref).toEqual({ kind: "glass", index: 0 });
  });

  it("does not change the shell it was given", () => {
    const shell = empty();
    addWall(shell, "wall", { x: 0, z: 0, width: 4, depth: 0.2 });
    expect(shell.walls).toEqual([]);
  });

  it("refuses the wall after the last one the game can draw", () => {
    let shell = empty();
    for (let i = 0; i < SHELL_LIMITS.walls; i++)
      shell = edit(
        addWall(shell, "wall", { x: i * 0.25 - 5, z: 0, width: 0.2, depth: 3 }),
      ).shell;
    const result = addWall(shell, "wall", { x: 0, z: 1, width: 4, depth: 0.2 });
    expect("error" in result && result.error).toMatch(/at most 40 walls/i);
  });
});

describe("labelProblem", () => {
  it("wants a name", () => {
    expect(labelProblem(empty(), "zone", "   ")).toMatch(/name/i);
  });

  it("wants a name that fits", () => {
    expect(
      labelProblem(empty(), "zone", "x".repeat(SHELL_LIMITS.labelLength + 1)),
    ).toMatch(/at most 32/i);
  });

  it("refuses a name another zone has, whatever the case", () => {
    expect(labelProblem(withRoom(), "zone", "ROOM")).toMatch(/already/i);
    expect(labelProblem(withRoom(), "zone", "Room 2")).toBeNull();
  });

  it("lets a part keep its own name", () => {
    expect(labelProblem(withRoom(), "zone", "Room", 0)).toBeNull();
  });

  it("does not mix the names of zones and of areas", () => {
    expect(labelProblem(withRoom(), "area", "Room")).toBeNull();
  });
});

describe("addZone", () => {
  const rect = { minX: 0, maxX: 4, minZ: 0, maxZ: 4 };

  it("makes a private room with a cleaned name and an id made from it", () => {
    const { shell, ref } = edit(addZone(empty(), rect, "  Quiet   room "));
    expect(shell.zones).toEqual([
      { id: "quiet-room", label: "Quiet room", rect },
    ]);
    expect(ref).toEqual({ kind: "zone", index: 0 });
  });

  it("gives two zones whose names make the same slug different ids", () => {
    const first = edit(addZone(empty(), rect, "Sala 1")).shell;
    const second = edit(
      addZone(first, { minX: 5, maxX: 9, minZ: 0, maxZ: 4 }, "Sala-1"),
    ).shell;
    expect(second.zones.map((z) => z.id)).toEqual(["sala-1", "sala-1-2"]);
  });

  it("does not take the id of a name made only of symbols", () => {
    const { shell } = edit(addZone(empty(), rect, "!!!"));
    expect(shell.zones[0].id).toBe("zone");
  });

  it("refuses a name that is taken", () => {
    const first = edit(addZone(empty(), rect, "Quiet")).shell;
    const result = addZone(
      first,
      { minX: 5, maxX: 9, minZ: 0, maxZ: 4 },
      "quiet",
    );
    expect("error" in result && result.error).toMatch(/already/i);
  });

  it("refuses a rectangle with no area", () => {
    const result = addZone(
      empty(),
      { minX: 3, maxX: 3, minZ: 0, maxZ: 4 },
      "Flat",
    );
    expect("error" in result && result.error).toMatch(/no area/i);
  });

  it("refuses the ninth zone", () => {
    let shell = empty();
    for (let i = 0; i < SHELL_LIMITS.zones; i++)
      shell = edit(
        addZone(
          shell,
          { minX: -11 + i * 2.5, maxX: -9 + i * 2.5, minZ: 0, maxZ: 2 },
          `Zone ${i + 1}`,
        ),
      ).shell;
    const result = addZone(
      shell,
      { minX: 0, maxX: 2, minZ: 4, maxZ: 6 },
      "One too many",
    );
    expect("error" in result && result.error).toMatch(/at most 8 private/i);
  });
});

describe("addArea and addFloorPatch", () => {
  const rect = { minX: 0, maxX: 4, minZ: 0, maxZ: 3 };

  it("adds an area with its own name and id", () => {
    const { shell, ref } = edit(addArea(empty(), rect, "Coffee corner"));
    expect(shell.areas).toEqual([
      { id: "coffee-corner", label: "Coffee corner", rect },
    ]);
    expect(ref).toEqual({ kind: "area", index: 0 });
  });

  it("refuses the thirteenth area", () => {
    let shell = empty();
    for (let i = 0; i < SHELL_LIMITS.areas; i++)
      shell = edit(addArea(shell, rect, `Area ${i + 1}`)).shell;
    const result = addArea(shell, rect, "Too many");
    expect("error" in result && result.error).toMatch(/at most 12 areas/i);
  });

  it("adds a floor patch as a slab, with a colour from the palette", () => {
    const { shell, ref } = edit(addFloorPatch(empty(), rect, "lounge"));
    expect(shell.floors).toEqual([
      { x: 2, z: 1.5, width: 4, depth: 3, tone: "lounge" },
    ]);
    expect(ref).toEqual({ kind: "floor", index: 0 });
  });

  it("refuses the thirteenth patch", () => {
    let shell = empty();
    for (let i = 0; i < SHELL_LIMITS.floors; i++)
      shell = edit(addFloorPatch(shell, rect, "meeting")).shell;
    const result = addFloorPatch(shell, rect, "meeting");
    expect("error" in result && result.error).toMatch(/at most 12 floor/i);
  });
});

describe("the spawn area", () => {
  it("is moved and keeps the way people look", () => {
    const shell = setSpawnYaw(empty(), Math.PI);
    const moved = setSpawnArea(shell, {
      minX: 0,
      maxX: 3,
      minZ: 5,
      maxZ: 6,
    });
    expect(moved.spawn).toEqual({
      area: { minX: 0, maxX: 3, minZ: 5, maxZ: 6 },
      yaw: Math.PI,
    });
  });

  it("turns to the way somebody looks", () => {
    expect(setSpawnYaw(empty(), Math.PI / 2).spawn.yaw).toBe(Math.PI / 2);
  });
});

describe("placeMount: a board or a screen on a wall", () => {
  it("hangs a board on the inside of the nearest outer wall, looking into the room", () => {
    const { shell, ref } = edit(
      placeMount(empty(), "board", [-11.3, -3.1], 0.25),
    );
    expect(ref).toEqual({ kind: "board", index: 0 });
    expect(shell.boards).toEqual([
      {
        id: "board",
        zone: null,
        facing: "east",
        face: -11.85,
        along: -3,
        y: 1.6,
        width: 2.6,
        height: 1.3,
      },
    ]);
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("faces south on the north wall, west on the east wall and north on the south wall", () => {
    const north = edit(placeMount(empty(), "board", [3, -7.5], 0.25)).shell;
    expect(north.boards[0]).toMatchObject({ facing: "south", face: -7.85 });
    const east = edit(placeMount(empty(), "board", [11.4, 2], 0.25)).shell;
    expect(east.boards[0]).toMatchObject({ facing: "west", face: 11.85 });
    const south = edit(placeMount(empty(), "board", [-3, 7.6], 0.25)).shell;
    expect(south.boards[0]).toMatchObject({ facing: "north", face: 7.85 });
  });

  it("picks the face of an inner wall on the side where the click is", () => {
    const base: Shell = {
      ...empty(),
      walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }],
    };
    const east = edit(placeMount(base, "board", [0.5, 1], 0.25)).shell;
    expect(east.boards[0]).toMatchObject({
      facing: "east",
      face: 0.1,
      along: 1,
    });
    const west = edit(placeMount(base, "board", [-0.5, 1], 0.25)).shell;
    expect(west.boards[0]).toMatchObject({ facing: "west", face: -0.1 });
  });

  it("keeps a board that would stick out past the end of the wall on the wall", () => {
    const base: Shell = {
      ...empty(),
      walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }],
    };
    const { shell } = edit(placeMount(base, "board", [0.5, 2.9], 0.25));
    expect(shell.boards[0].along).toBe(1.7);
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("does not hang anything on glass", () => {
    const base: Shell = {
      ...empty(),
      glass: [{ x: 0, z: 0, width: 0.15, depth: 6 }],
    };
    const result = placeMount(base, "board", [0.5, 1], 0.25);
    expect("error" in result && result.error).toMatch(/wall/i);
  });

  it("does not take a click far from every wall", () => {
    const result = placeMount(empty(), "board", [0, 0], 0.25);
    expect("error" in result && result.error).toMatch(/click on a wall/i);
  });

  it("gives a board of a private room the zone it hangs in", () => {
    const { shell } = edit(placeMount(withRoom(), "board", [-11.2, -5], 0.25));
    expect(shell.boards[0].zone).toBe("room");
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("makes a board of the open floor when no private room is near", () => {
    const { shell } = edit(placeMount(withRoom(), "board", [-11.4, 3], 0.25));
    expect(shell.boards[0].zone).toBeNull();
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("hangs a screen of the zone it is in, 16:9 and at its own height", () => {
    const { shell, ref } = edit(
      placeMount(withRoom(), "screen", [-8, -7.4], 0.25),
    );
    expect(ref).toEqual({ kind: "screen", index: 0 });
    expect(shell.screens).toEqual([
      {
        id: "screen",
        zone: "room",
        facing: "south",
        face: -7.85,
        along: -8,
        y: 1.8,
        width: 3.3,
      },
    ]);
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("refuses a screen where there is no private room, saying why", () => {
    const result = placeMount(empty(), "screen", [3, -7.5], 0.25);
    expect("error" in result && result.error).toMatch(/private room/i);
  });

  it("does not let a second board take the first one's id", () => {
    const first = edit(placeMount(empty(), "board", [-11.3, -3], 0.25)).shell;
    const second = edit(placeMount(first, "board", [-11.3, 3], 0.25)).shell;
    expect(second.boards.map((b) => b.id)).toEqual(["board", "board-2"]);
  });

  it("refuses the seventh board and the seventh screen", () => {
    let shell = withRoom();
    for (let i = 0; i < SHELL_LIMITS.boards; i++)
      shell = edit(
        placeMount(shell, "board", [11.3, -7 + i * 2.5], 0.25),
      ).shell;
    const result = placeMount(shell, "board", [3, 7.6], 0.25);
    expect("error" in result && result.error).toMatch(/at most 6 boards/i);
  });

  it("keeps a board clear of a wall that meets its own, away from the click if it has to", () => {
    const base: Shell = {
      ...empty(),
      walls: [
        { x: 0, z: 0, width: 0.2, depth: 6 },
        { x: 1.5, z: 0.5, width: 3, depth: 0.2 },
      ],
    };
    const { shell } = edit(placeMount(base, "board", [0.3, 0], 0.25));
    expect(shell.boards[0]).toMatchObject({
      facing: "east",
      face: 0.1,
      along: -0.9,
    });
    expect(findShellProblems(shell)).toEqual([]);
  });

  it("stays clear of the corner where two outer walls meet", () => {
    const { shell } = edit(placeMount(empty(), "board", [-11.5, -7.5], 0.25));
    expect(shell.boards[0].facing).toBe("south");
    expect(shell.boards[0].along).toBe(-10.55);
    expect(findShellProblems(shell)).toEqual([]);
  });
});

describe("moving", () => {
  const shell: Shell = {
    ...withRoom(),
    walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }],
    floors: [{ x: 5, z: 2, width: 4, depth: 2, tone: "meeting" }],
    areas: [
      { id: "bar", label: "Bar", rect: { minX: 3, maxX: 6, minZ: 3, maxZ: 5 } },
    ],
    boards: [
      {
        id: "board",
        zone: "room",
        facing: "east",
        face: -11.85,
        along: -5,
        y: 1.6,
        width: 2.6,
        height: 1.3,
      },
    ],
  };

  it("says where each part is anchored: the corner of a slab or a rectangle, the spot of a board", () => {
    expect(anchorOf(shell, { kind: "wall", index: 0 })).toEqual([-0.1, -3]);
    expect(anchorOf(shell, { kind: "zone", index: 0 })).toEqual([
      -11.85, -7.85,
    ]);
    expect(anchorOf(shell, { kind: "area", index: 0 })).toEqual([3, 3]);
    expect(anchorOf(shell, { kind: "floor", index: 0 })).toEqual([3, 1]);
    expect(anchorOf(shell, { kind: "spawn", index: 0 })).toEqual([-2, 5.5]);
    expect(anchorOf(shell, { kind: "board", index: 0 })).toEqual([-11.85, -5]);
    expect(anchorOf(shell, { kind: "wall", index: 9 })).toBeNull();
  });

  it("moves a wall so its corner is where it is dropped", () => {
    const moved = moveTo(shell, { kind: "wall", index: 0 }, [2, -3]);
    expect(moved.walls[0]).toEqual({ x: 2.1, z: 0, width: 0.2, depth: 6 });
  });

  it("moves a zone or an area with its size", () => {
    const zone = moveTo(shell, { kind: "zone", index: 0 }, [-8, -6]);
    expect(zone.zones[0].rect).toEqual({
      minX: -8,
      maxX: -0.225,
      minZ: -6,
      maxZ: -0.225,
    });
    const area = moveTo(shell, { kind: "area", index: 0 }, [0, 0]);
    expect(area.areas[0].rect).toEqual({ minX: 0, maxX: 3, minZ: 0, maxZ: 2 });
  });

  it("moves a floor patch and the spawn area", () => {
    expect(
      moveTo(shell, { kind: "floor", index: 0 }, [0, 0]).floors[0],
    ).toEqual({
      x: 2,
      z: 1,
      width: 4,
      depth: 2,
      tone: "meeting",
    });
    expect(
      moveTo(shell, { kind: "spawn", index: 0 }, [0, 0]).spawn.area,
    ).toEqual({
      minX: 0,
      maxX: 4,
      minZ: 0,
      maxZ: 1.5,
    });
  });

  it("slides a board to another wall: it hangs on the face nearest where it is dropped", () => {
    const moved = moveTo(shell, { kind: "board", index: 0 }, [0.5, 1.5]);
    expect(moved.boards[0]).toMatchObject({
      facing: "east",
      face: 0.1,
      along: 1.5,
      zone: "room",
      width: 2.6,
    });
  });

  it("leaves a board where it is when it is dropped far from every wall", () => {
    expect(moveTo(shell, { kind: "board", index: 0 }, [-4, 4]).boards).toEqual(
      shell.boards,
    );
  });

  it("nudges by a small step: slabs and rectangles by x and z, a board along its wall", () => {
    expect(nudge(shell, { kind: "wall", index: 0 }, 0.25, 0).walls[0].x).toBe(
      0.25,
    );
    expect(
      nudge(shell, { kind: "zone", index: 0 }, 0, -0.25).zones[0].rect.minZ,
    ).toBe(-8.1);
    const board = nudge(shell, { kind: "board", index: 0 }, 0.25, 0.5)
      .boards[0];
    expect(board.along).toBe(-4.5);
    expect(board.face).toBe(-11.85);
  });

  it("does not change the shell it was given", () => {
    moveTo(shell, { kind: "wall", index: 0 }, [2, -3]);
    expect(shell.walls[0].x).toBe(0);
  });
});

describe("numbers in the inspector", () => {
  const shell: Shell = {
    ...withRoom(),
    walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }],
  };

  it("reads a slab and a rectangle the same way: middle and size", () => {
    expect(geometryOf(shell, { kind: "wall", index: 0 })).toEqual({
      x: 0,
      z: 0,
      width: 0.2,
      depth: 6,
    });
    const zone = geometryOf(shell, { kind: "zone", index: 0 })!;
    expect(zone.x).toBeCloseTo(-7.9625, 3);
    expect(zone.z).toBeCloseTo(-4.9625, 3);
    expect(zone.width).toBeCloseTo(7.775, 3);
    expect(zone.depth).toBeCloseTo(5.775, 3);
    expect(geometryOf(shell, { kind: "board", index: 0 })).toBeNull();
  });

  it("sets the size or the place of a wall", () => {
    const next = setGeometry(
      shell,
      { kind: "wall", index: 0 },
      { depth: 8, x: 1 },
    );
    expect(next.walls[0]).toEqual({ x: 1, z: 0, width: 0.2, depth: 8 });
  });

  it("sets the size of a zone around the same middle", () => {
    const next = setGeometry(shell, { kind: "zone", index: 0 }, { width: 6 });
    expect(next.zones[0].rect.maxX - next.zones[0].rect.minX).toBeCloseTo(6);
    const { x } = geometryOf(next, { kind: "zone", index: 0 })!;
    expect(x).toBeCloseTo(-7.9625);
  });

  it("rounds to a millimetre", () => {
    const next = setGeometry(shell, { kind: "wall", index: 0 }, { x: 1.23456 });
    expect(next.walls[0].x).toBe(1.235);
  });

  it("sets where a board hangs along its wall and how big it is", () => {
    const withBoard: Shell = {
      ...shell,
      boards: [
        {
          id: "board",
          zone: "room",
          facing: "east",
          face: -11.85,
          along: -5,
          y: 1.6,
          width: 2.6,
          height: 1.3,
        },
      ],
    };
    const next = setMount(
      withBoard,
      { kind: "board", index: 0 },
      { along: -4, width: 3, height: 1.5, y: 1.7, zone: null },
    );
    expect(next.boards[0]).toMatchObject({
      along: -4,
      width: 3,
      height: 1.5,
      y: 1.7,
      zone: null,
      face: -11.85,
    });
  });

  it("changes the colour of a floor patch", () => {
    const patched: Shell = {
      ...shell,
      floors: [{ x: 5, z: 2, width: 4, depth: 2, tone: "meeting" }],
    };
    expect(setTone(patched, 0, "lounge").floors[0].tone).toBe("lounge");
  });
});

describe("renameRef", () => {
  it("gives a zone another name and keeps its id", () => {
    const result = renameRef(
      withRoom(),
      { kind: "zone", index: 0 },
      { label: "Board room" },
    );
    expect("shell" in result && result.shell.zones[0]).toMatchObject({
      id: "room",
      label: "Board room",
    });
  });

  it("refuses a name that is taken or empty", () => {
    const two = edit(
      addZone(withRoom(), { minX: 0, maxX: 4, minZ: 0, maxZ: 4 }, "Other"),
    ).shell;
    expect(
      "error" in renameRef(two, { kind: "zone", index: 1 }, { label: "room" }),
    ).toBe(true);
    expect(
      "error" in renameRef(two, { kind: "zone", index: 1 }, { label: " " }),
    ).toBe(true);
  });

  it("changes the id of a zone and moves its boards and screens along with it", () => {
    const board = edit(
      placeMount(withRoom(), "board", [-11.2, -5], 0.25),
    ).shell;
    const both = edit(placeMount(board, "screen", [-8, -7.4], 0.25)).shell;
    const result = renameRef(
      both,
      { kind: "zone", index: 0 },
      { id: "boardroom" },
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.shell.zones[0].id).toBe("boardroom");
    expect(result.shell.boards[0].zone).toBe("boardroom");
    expect(result.shell.screens[0].zone).toBe("boardroom");
    expect(findShellProblems(result.shell)).toEqual([]);
  });

  it("refuses an id that is not a slug or that another zone has", () => {
    const two = edit(
      addZone(withRoom(), { minX: 0, maxX: 4, minZ: 0, maxZ: 4 }, "Other"),
    ).shell;
    expect(
      "error" in
        renameRef(two, { kind: "zone", index: 1 }, { id: "Not A Slug" }),
    ).toBe(true);
    expect(
      "error" in renameRef(two, { kind: "zone", index: 1 }, { id: "room" }),
    ).toBe(true);
  });

  it("renames an area too", () => {
    const { shell } = edit(
      addArea(empty(), { minX: 0, maxX: 4, minZ: 0, maxZ: 3 }, "Bar"),
    );
    const result = renameRef(
      shell,
      { kind: "area", index: 0 },
      { label: "Cafe" },
    );
    expect("shell" in result && result.shell.areas[0].label).toBe("Cafe");
  });
});

describe("deleteRef", () => {
  it("takes out a wall and keeps the others in order", () => {
    const shell: Shell = {
      ...empty(),
      walls: [
        { x: 0, z: 0, width: 4, depth: 0.2 },
        { x: 0, z: 2, width: 4, depth: 0.2 },
        { x: 0, z: 4, width: 4, depth: 0.2 },
      ],
    };
    const next = deleteRef(shell, { kind: "wall", index: 1 });
    expect(next.walls.map((wall) => wall.z)).toEqual([0, 4]);
  });

  it("takes out a zone with its boards and screens, which would have no room to belong to", () => {
    const board = edit(
      placeMount(withRoom(), "board", [-11.2, -5], 0.25),
    ).shell;
    const both = edit(placeMount(board, "screen", [-8, -7.4], 0.25)).shell;
    const next = deleteRef(both, { kind: "zone", index: 0 });
    expect(next.zones).toEqual([]);
    expect(next.boards).toEqual([]);
    expect(next.screens).toEqual([]);
    expect(findShellProblems(next)).toEqual([]);
  });

  it("keeps the boards of the open floor when a zone goes", () => {
    const open = edit(placeMount(withRoom(), "board", [-11.4, 3], 0.25)).shell;
    const next = deleteRef(open, { kind: "zone", index: 0 });
    expect(next.boards).toHaveLength(1);
  });

  it("never takes out the place where people appear", () => {
    const shell = empty();
    expect(deleteRef(shell, { kind: "spawn", index: 0 })).toBe(shell);
  });

  it("leaves the shell alone for a place that is not there", () => {
    const shell = empty();
    expect(deleteRef(shell, { kind: "wall", index: 3 })).toBe(shell);
  });
});

describe("resizeFloor", () => {
  it("sets the size", () => {
    const next = resizeFloor(empty(), 30, 20);
    expect([next.width, next.depth]).toEqual([30, 20]);
  });

  it("keeps the size within what the game can draw", () => {
    const small = resizeFloor(empty(), 5, 3);
    expect([small.width, small.depth]).toEqual([
      SHELL_LIMITS.minWidth,
      SHELL_LIMITS.minDepth,
    ]);
    const big = resizeFloor(empty(), 99, 99);
    expect([big.width, big.depth]).toEqual([
      SHELL_LIMITS.maxWidth,
      SHELL_LIMITS.maxDepth,
    ]);
  });

  it("ignores a size that is not a number", () => {
    const shell = empty();
    expect(resizeFloor(shell, Number.NaN, 20).width).toBe(24);
  });
});

describe("partsOutside", () => {
  it("is nothing when everything is on the floor", () => {
    expect(partsOutside(DEFAULT_SHELL, [], [])).toEqual({
      parts: 0,
      furniture: 0,
    });
  });

  it("counts the parts of the shell and the furniture that a smaller floor leaves out", () => {
    const smaller = resizeFloor(DEFAULT_SHELL, 16, 12);
    const desk: Furniture = { kind: "desk", x: 12, z: 0, rotation: 0 };
    const near: Furniture = { kind: "desk", x: 0, z: 0, rotation: 0 };
    const outside = partsOutside(smaller, [desk, near], []);
    expect(outside.parts).toBeGreaterThan(0);
    expect(outside.furniture).toBe(1);
  });
});

describe("pickStructure", () => {
  const shell: Shell = {
    ...withRoom(),
    walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }],
    floors: [{ x: 5, z: 2, width: 4, depth: 2, tone: "meeting" }],
    areas: [
      {
        id: "open",
        label: "Open",
        rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 },
      },
      { id: "bar", label: "Bar", rect: { minX: 3, maxX: 6, minZ: 3, maxZ: 5 } },
    ],
    boards: [
      {
        id: "board",
        zone: "room",
        facing: "east",
        face: -11.85,
        along: -5,
        y: 1.6,
        width: 2.6,
        height: 1.3,
      },
    ],
  };
  const at = (x: number, z: number): ShellRef | null =>
    pickStructure(shell, x, z);

  it("finds a wall a little beyond its thin edge", () => {
    expect(at(0.05, 1)).toEqual({ kind: "wall", index: 0 });
    expect(at(0.2, 1)).toEqual({ kind: "wall", index: 0 });
    expect(at(0.4, 1)).not.toEqual({ kind: "wall", index: 0 });
  });

  it("finds glass", () => {
    expect(at(-8, -2)).toEqual({ kind: "glass", index: 1 });
  });

  it("prefers a board to what is under it", () => {
    expect(at(-11.7, -5)).toEqual({ kind: "board", index: 0 });
  });

  it("finds a zone by its floor", () => {
    expect(at(-9, -5)).toEqual({ kind: "zone", index: 0 });
  });

  it("finds the spawn area", () => {
    expect(at(0, 6)).toEqual({ kind: "spawn", index: 0 });
  });

  it("prefers a floor patch to the area it is in, and a small area to a big one", () => {
    expect(at(5, 2)).toEqual({ kind: "floor", index: 0 });
    expect(at(4, 4)).toEqual({ kind: "area", index: 1 });
    expect(at(8, -5)).toEqual({ kind: "area", index: 0 });
  });

  it("finds nothing off the floor", () => {
    expect(pickStructure(empty(), 0, 0)).toBeNull();
  });
});

describe("describeOutside", () => {
  it("says nothing when everything is on the floor", () => {
    expect(describeOutside({ parts: 0, furniture: 0 })).toBeNull();
  });

  it("counts what sticks out, in words", () => {
    expect(describeOutside({ parts: 1, furniture: 0 })).toBe(
      "1 part of the structure sticks out past the floor.",
    );
    expect(describeOutside({ parts: 0, furniture: 3 })).toBe(
      "3 pieces of furniture stick out past the floor.",
    );
    expect(describeOutside({ parts: 2, furniture: 1 })).toBe(
      "2 parts of the structure and 1 piece of furniture stick out past the floor.",
    );
  });
});
