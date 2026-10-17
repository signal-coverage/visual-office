import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL } from "../../shared/defaultShell.ts";
import type { Furniture } from "../../shared/furniture.ts";
import { FLOOR_TEMPLATES, templateById } from "../../shared/floorTemplates.ts";
import type { Shell } from "../../shared/shell.ts";
import {
  addFurniture,
  beginDrag,
  createEditor,
  markSaved,
  redo,
  select,
  undo,
  type EditorState,
} from "./state";
import {
  addAreaTo,
  addPatchTo,
  addZoneTo,
  applyTemplate,
  deleteStructure,
  drawLine,
  hangMount,
  moveStructureTo,
  nudgeStructure,
  previewMount,
  renameStructure,
  resizeStructureFloor,
  selectStructure,
  setSpawnTo,
  setStructureGeometry,
  setStructureMount,
  setStructureTone,
  shellOf,
  shellToPublish,
  turnSpawn,
} from "./structureState";

const desk = (x = 0, z = 0): Furniture => ({ kind: "desk", x, z, rotation: 0 });

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

const start = (shell: Shell = empty(), furniture: Furniture[] = []) =>
  createEditor(furniture, [], shell);

const drawn = (
  state: EditorState,
  from: [number, number],
  to: [number, number],
) => {
  const result = drawLine(state, "wall", from, to, 0.25);
  expect(result.error).toBeNull();
  return result.state;
};

describe("the shell in the editor", () => {
  it("is the default shell until something is drawn", () => {
    const state = createEditor([], []);
    expect(state.shell).toBeUndefined();
    expect(shellOf(state)).toBe(DEFAULT_SHELL);
  });

  it("starts as saved, and untouched", () => {
    const state = start();
    expect(state.dirty).toBe(false);
    expect(state.shellTouched).toBe(false);
    expect(state.structure).toBeNull();
  });
});

describe("drawing walls", () => {
  it("adds the wall, selects it and counts as an unsaved change", () => {
    const state = drawn(start(), [-5, 0], [3, 0]);
    expect(shellOf(state).walls).toEqual([
      { x: -1, z: 0, width: 8, depth: 0.2 },
    ]);
    expect(state.structure).toEqual({ kind: "wall", index: 0 });
    expect(state.dirty).toBe(true);
    expect(state.shellTouched).toBe(true);
  });

  it("starts from the default shell when the floor had none", () => {
    const state = drawn(createEditor([], []), [-5, 0], [3, 0]);
    expect(state.shell?.glass).toEqual(DEFAULT_SHELL.glass);
    expect(state.shell?.walls).toHaveLength(1);
  });

  it("makes glass the same way", () => {
    const result = drawLine(start(), "glass", [0, 0], [4, 0], 0.25);
    expect(result.state.shell?.glass).toEqual([
      { x: 2, z: 0, width: 4, depth: 0.15 },
    ]);
  });

  it("changes nothing, and says why, when the drag is too short to be a wall", () => {
    const before = start();
    const result = drawLine(before, "wall", [1, 1], [1.05, 1], 0.25);
    expect(result.state).toBe(before);
    expect(result.error).toMatch(/drag/i);
  });

  it("is one step to undo and one to redo, with the furniture untouched", () => {
    const base = start(empty(), [desk()]);
    const state = drawn(base, [0, 0], [4, 0]);
    const undone = undo(state);
    expect(undone.shell).toBe(base.shell);
    expect(undone.furniture).toBe(base.furniture);
    expect(undone.dirty).toBe(false);
    expect(redo(undone).shell).toBe(state.shell);
  });

  it("does not change the shell it was given", () => {
    const shell = empty();
    drawn(start(shell), [0, 0], [4, 0]);
    expect(shell.walls).toEqual([]);
  });

  it("refuses the wall after the last one, saying so", () => {
    let state = start();
    for (let i = 0; i < 40; i++)
      state = drawn(state, [-10, -7 + i * 0.25], [-6, -7 + i * 0.25]);
    const result = drawLine(state, "wall", [0, 0], [4, 0], 0.25);
    expect(result.state).toBe(state);
    expect(result.error).toMatch(/at most 40/i);
  });
});

describe("rooms, areas, patches and the place where people appear", () => {
  const rect = { minX: -10, maxX: -5, minZ: -6, maxZ: -2 };

  it("makes a private room and selects it", () => {
    const result = addZoneTo(start(), rect, "Quiet room");
    expect(result.error).toBeNull();
    expect(shellOf(result.state).zones[0]).toMatchObject({
      id: "quiet-room",
      label: "Quiet room",
      rect,
    });
    expect(result.state.structure).toEqual({ kind: "zone", index: 0 });
  });

  it("keeps the state and says why when the name is taken", () => {
    const first = addZoneTo(start(), rect, "Quiet").state;
    const again = addZoneTo(first, { ...rect, minX: 0, maxX: 5 }, "QUIET");
    expect(again.state).toBe(first);
    expect(again.error).toMatch(/already/i);
  });

  it("refuses the thirteenth area", () => {
    let state = start();
    for (let i = 0; i < 12; i++)
      state = addAreaTo(state, rect, `Area ${i}`).state;
    const result = addAreaTo(state, rect, "More");
    expect(result.error).toMatch(/at most 12/i);
    expect(result.state).toBe(state);
  });

  it("adds a floor patch", () => {
    const result = addPatchTo(start(), rect, "lounge");
    expect(shellOf(result.state).floors[0]).toMatchObject({ tone: "lounge" });
  });

  it("moves the place where people appear, as one step", () => {
    const before = start();
    const state = setSpawnTo(before, { minX: -1, maxX: 1, minZ: 4, maxZ: 5 });
    expect(shellOf(state).spawn.area).toEqual({
      minX: -1,
      maxX: 1,
      minZ: 4,
      maxZ: 5,
    });
    expect(state.structure).toEqual({ kind: "spawn", index: 0 });
    expect(undo(state).shell).toBe(before.shell);
  });

  it("turns the way people look", () => {
    const state = turnSpawn(start(), Math.PI);
    expect(shellOf(state).spawn.yaw).toBe(Math.PI);
    expect(state.dirty).toBe(true);
  });
});

describe("boards and screens", () => {
  it("hangs a board on the wall nearest the click", () => {
    const result = hangMount(start(), "board", [-11.3, -3], 0.25);
    expect(result.error).toBeNull();
    expect(shellOf(result.state).boards).toHaveLength(1);
    expect(result.state.structure).toEqual({ kind: "board", index: 0 });
  });

  it("changes nothing and says why when the click is on no wall", () => {
    const before = start();
    const result = hangMount(before, "board", [0, 0], 0.25);
    expect(result.state).toBe(before);
    expect(result.error).toMatch(/click on a wall/i);
  });

  it("refuses a screen outside a private room", () => {
    const result = hangMount(start(), "screen", [3, -7.5], 0.25);
    expect(result.error).toMatch(/private room/i);
  });
});

describe("previewMount", () => {
  it("shows where a board would hang, without hanging it", () => {
    const before = start();
    const { mount, error } = previewMount(before, "board", [-11.3, -3], 0.25);
    expect(error).toBeNull();
    expect(mount).toMatchObject({ facing: "east", face: -11.85, along: -3 });
    expect(before.shell?.boards).toEqual([]);
  });

  it("shows nothing, and why, where it would not hang", () => {
    const { mount, error } = previewMount(start(), "screen", [0, 0], 0.25);
    expect(mount).toBeNull();
    expect(error).toMatch(/click on a wall/i);
  });
});

describe("selecting", () => {
  const state = drawn(start(empty(), [desk()]), [0, 0], [4, 0]);

  it("selecting a structure lets go of the furniture", () => {
    const withDesk = select(state, { list: "furniture", index: 0 });
    expect(withDesk.structure).toBeNull();
    const both = selectStructure(withDesk, { kind: "wall", index: 0 });
    expect(both.selected).toBeNull();
    expect(both.structure).toEqual({ kind: "wall", index: 0 });
  });

  it("selecting furniture lets go of the structure", () => {
    const picked = select(state, { list: "furniture", index: 0 });
    expect(picked.structure).toBeNull();
  });

  it("lets go with null, and keeps the state when it is the same part", () => {
    const same = selectStructure(state, { kind: "wall", index: 0 });
    expect(selectStructure(same, { kind: "wall", index: 0 })).toBe(same);
    expect(selectStructure(same, null).structure).toBeNull();
  });
});

describe("moving a part", () => {
  const base = () =>
    selectStructure(
      start({ ...empty(), walls: [{ x: 0, z: 0, width: 0.2, depth: 6 }] }),
      { kind: "wall", index: 0 },
    );

  it("puts the corner of the part on the grid where it is dragged to", () => {
    const state = moveStructureTo(base(), [2.12, -2.9], 0.25);
    expect(shellOf(state).walls[0]).toEqual({
      x: 2.1,
      z: 0,
      width: 0.2,
      depth: 6,
    });
    expect(state.shellTouched).toBe(true);
  });

  it("makes a drag one step to undo, however many times it moves", () => {
    const before = base();
    let state = beginDrag(before);
    for (let i = 1; i <= 10; i++)
      state = moveStructureTo(state, [i * 0.5, -3], 0.25);
    expect(shellOf(state).walls[0].x).toBeCloseTo(5.1);
    expect(undo(state).shell).toBe(before.shell);
  });

  it("does nothing with nothing selected", () => {
    const state = start();
    expect(moveStructureTo(state, [1, 1], 0.25)).toBe(state);
  });

  it("nudges by a step, each one undoable", () => {
    const before = base();
    const state = nudgeStructure(before, 0.25, 0);
    expect(shellOf(state).walls[0].x).toBe(0.25);
    expect(undo(state).shell).toBe(before.shell);
  });
});

describe("changing a part from the inspector", () => {
  const room = () => {
    const made = addZoneTo(
      start(),
      { minX: -10, maxX: -5, minZ: -6, maxZ: -2 },
      "Quiet",
    );
    return made.state;
  };

  it("sets the size and the middle", () => {
    const state = setStructureGeometry(room(), { width: 6, x: -7 });
    const zone = shellOf(state).zones[0].rect;
    expect(zone.maxX - zone.minX).toBeCloseTo(6);
    expect((zone.minX + zone.maxX) / 2).toBeCloseTo(-7);
  });

  it("renames, and keeps the state with the reason when the name is not allowed", () => {
    const ok = renameStructure(room(), { label: "Silent" });
    expect(ok.error).toBeNull();
    expect(shellOf(ok.state).zones[0].label).toBe("Silent");
    const base = room();
    const bad = renameStructure(base, { label: " " });
    expect(bad.error).toMatch(/name/i);
    expect(bad.state).toBe(base);
  });

  it("changes a patch's colour", () => {
    const patched = addPatchTo(
      start(),
      { minX: 0, maxX: 4, minZ: 0, maxZ: 3 },
      "meeting",
    ).state;
    expect(shellOf(setStructureTone(patched, "lounge")).floors[0].tone).toBe(
      "lounge",
    );
  });

  it("moves a board along its wall and gives it to another zone", () => {
    const board = hangMount(start(), "board", [-11.3, -3], 0.25).state;
    const state = setStructureMount(board, { along: 2, zone: null });
    expect(shellOf(state).boards[0]).toMatchObject({ along: 2, zone: null });
  });

  it("does nothing with nothing selected", () => {
    const state = start();
    expect(setStructureGeometry(state, { width: 3 })).toBe(state);
    expect(setStructureTone(state, "lounge")).toBe(state);
  });
});

describe("deleting a part", () => {
  it("takes the selected part out, clears the selection and can be undone", () => {
    const state = deleteStructure(drawn(start(), [0, 0], [4, 0])).state;
    expect(shellOf(state).walls).toEqual([]);
    expect(state.structure).toBeNull();
    expect(undo(state).shell?.walls).toHaveLength(1);
  });

  it("says what went with a zone", () => {
    let state = addZoneTo(
      start(),
      { minX: -11.85, maxX: -6, minZ: -7.85, maxZ: -3 },
      "Room",
    ).state;
    state = hangMount(state, "board", [-11.2, -5], 0.25).state;
    state = hangMount(state, "screen", [-9, -7.4], 0.25).state;
    const zoneSelected = selectStructure(state, { kind: "zone", index: 0 });
    const result = deleteStructure(zoneSelected);
    expect(shellOf(result.state).boards).toEqual([]);
    expect(result.note).toMatch(/1 board and 1 screen/i);
  });

  it("does nothing, with no complaint, with nothing selected", () => {
    const state = start();
    expect(deleteStructure(state)).toEqual({ state, error: null });
  });

  it("never takes out the place where people appear", () => {
    const state = selectStructure(start(), { kind: "spawn", index: 0 });
    const result = deleteStructure(state);
    expect(result.state).toBe(state);
    expect(result.error).toMatch(/place where people appear/i);
  });
});

describe("the size of the floor", () => {
  it("is set and undone as a step", () => {
    const before = start();
    const state = resizeStructureFloor(before, 30, 20);
    expect([shellOf(state).width, shellOf(state).depth]).toEqual([30, 20]);
    expect(undo(state).shell).toBe(before.shell);
  });

  it("keeps the furniture where it is, even when it ends up outside", () => {
    const state = resizeStructureFloor(start(empty(), [desk(11, 0)]), 16, 12);
    expect(state.furniture).toEqual([desk(11, 0)]);
  });

  it("does not make a step of a size that is already there", () => {
    const base = start();
    expect(resizeStructureFloor(base, 24, 16)).toBe(base);
  });
});

describe("applying a template", () => {
  const meeting = templateById("meeting")!;

  it("replaces the structure and the furniture", () => {
    const state = applyTemplate(start(empty(), [desk()]), meeting, true);
    expect(state.shell).toBe(meeting.shell);
    expect(state.furniture).toBe(meeting.furniture);
    expect(state.models).toBe(meeting.models);
    expect(state.dirty).toBe(true);
    expect(state.shellTouched).toBe(true);
    expect(state.selected).toBeNull();
    expect(state.structure).toBeNull();
  });

  it("can keep the furniture it had", () => {
    const base = start(empty(), [desk()]);
    const state = applyTemplate(base, meeting, false);
    expect(state.shell).toBe(meeting.shell);
    expect(state.furniture).toBe(base.furniture);
  });

  it("goes back to the default shell for the first template", () => {
    const own = drawn(createEditor([], []), [0, 0], [4, 0]);
    const state = applyTemplate(own, FLOOR_TEMPLATES[0], true);
    expect(state.shell).toBeUndefined();
    expect(state.shellTouched).toBe(true);
    expect(shellOf(state)).toBe(DEFAULT_SHELL);
  });

  it("can be undone in one step, structure and furniture together", () => {
    const base = start(empty(), [desk()]);
    const state = applyTemplate(base, meeting, true);
    const undone = undo(state);
    expect(undone.shell).toBe(base.shell);
    expect(undone.furniture).toBe(base.furniture);
    expect(redo(undone).shell).toBe(meeting.shell);
  });
});

describe("undo and redo across furniture and structure", () => {
  it("takes back each kind of change in the order it was made", () => {
    let state = start();
    state = addFurniture(state, "chair", 1, 1);
    state = drawn(state, [0, 0], [4, 0]);
    state = addFurniture(state, "desk", 2, 2);
    expect(state.furniture).toHaveLength(2);
    state = undo(state);
    expect(state.furniture).toHaveLength(1);
    expect(shellOf(state).walls).toHaveLength(1);
    state = undo(state);
    expect(shellOf(state).walls).toHaveLength(0);
    expect(state.furniture).toHaveLength(1);
    state = undo(state);
    expect(state.furniture).toHaveLength(0);
    expect(state.dirty).toBe(false);
  });

  it("clears the selection of a structure, which may no longer exist", () => {
    const state = undo(drawn(start(), [0, 0], [4, 0]));
    expect(state.structure).toBeNull();
  });

  it("is dirty again after undoing past a save", () => {
    const saved = markSaved(drawn(start(), [0, 0], [4, 0]));
    expect(saved.dirty).toBe(false);
    expect(undo(saved).dirty).toBe(true);
  });
});

describe("what to publish", () => {
  it("says nothing of the shell when it was never touched and the floor has none", () => {
    expect(shellToPublish(createEditor([], []))).toEqual({ send: false });
  });

  it("sends the shell the floor has, even if it was not touched", () => {
    const shell = empty();
    expect(shellToPublish(start(shell))).toEqual({ send: true, shell });
  });

  it("sends the edited shell", () => {
    const state = drawn(start(), [0, 0], [4, 0]);
    expect(shellToPublish(state)).toEqual({ send: true, shell: state.shell });
  });

  it("sends null, which is the default shell, after applying the first template", () => {
    const state = applyTemplate(start(), FLOOR_TEMPLATES[0], true);
    expect(shellToPublish(state)).toEqual({ send: true, shell: null });
  });
});
