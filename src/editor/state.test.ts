import { describe, expect, it } from "vitest";
import type { Furniture } from "../../shared/furniture.ts";
import type { PropPlacement } from "../../shared/props.ts";
import {
  addFurniture,
  addModel,
  beginDrag,
  createEditor,
  deleteSelected,
  duplicateSelected,
  HISTORY_LIMIT,
  markSaved,
  moveSelectedTo,
  nudgeSelected,
  pickAt,
  redo,
  rotateSelected,
  select,
  setVariant,
  snap,
  undo,
  updateSelectedModel,
} from "./state";

const desk = (x = 0, z = 0): Furniture => ({ kind: "desk", x, z, rotation: 0 });
const shelf: PropPlacement = {
  model: "shelf.glb",
  at: [4, -6],
  footprint: [1.6, 0.4],
};

describe("snap", () => {
  it("rounds to the nearest step", () => {
    expect(snap(1.26, 0.25)).toBeCloseTo(1.25);
    expect(snap(1.4, 0.25)).toBeCloseTo(1.5);
    expect(snap(-1.1, 0.25)).toBeCloseTo(-1.0);
  });

  it("leaves a value alone when there is no step", () => {
    expect(snap(1.2345, 0)).toBe(1.2345);
  });

  it("does not leave floating point crumbs", () => {
    expect(snap(0.30000000000000004, 0.05)).toBe(0.3);
    expect(snap(7.35, 0.05)).toBe(7.35);
  });
});

describe("adding", () => {
  it("adds a piece, selects it and counts as an unsaved change", () => {
    const state = addFurniture(createEditor([], []), "chair", 2, 3);
    expect(state.furniture).toEqual([
      { kind: "chair", x: 2, z: 3, rotation: 0 },
    ]);
    expect(state.selected).toEqual({ list: "furniture", index: 0 });
    expect(state.dirty).toBe(true);
  });

  it("starts as saved", () => {
    expect(createEditor([desk()], []).dirty).toBe(false);
  });

  it("adds a model with the footprint it was given", () => {
    const state = addModel(createEditor([], []), "sofa.glb", 1, 2, [2, 1]);
    expect(state.models).toEqual([
      { model: "sofa.glb", at: [1, 2], footprint: [2, 1] },
    ]);
    expect(state.selected).toEqual({ list: "models", index: 0 });
  });

  it("does not change the lists it was given", () => {
    const furniture = [desk()];
    addFurniture(createEditor(furniture, []), "chair", 0, 0);
    expect(furniture).toHaveLength(1);
  });
});

describe("undo and redo", () => {
  it("takes back the last change and puts it back", () => {
    const start = createEditor([desk()], []);
    const added = addFurniture(start, "chair", 1, 1);
    const undone = undo(added);
    expect(undone.furniture).toEqual(start.furniture);
    expect(redo(undone).furniture).toEqual(added.furniture);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const start = createEditor([desk()], []);
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it("forgets what could be redone once something new is done", () => {
    let state = addFurniture(createEditor([], []), "chair", 1, 1);
    state = undo(state);
    state = addFurniture(state, "desk", 2, 2);
    expect(redo(state)).toBe(state);
  });

  it("clears the selection, which may no longer exist", () => {
    const state = undo(addFurniture(createEditor([], []), "chair", 1, 1));
    expect(state.selected).toBeNull();
  });

  it("keeps only the last changes, so a long session does not grow without end", () => {
    let state = createEditor([desk()], []);
    for (let i = 0; i < HISTORY_LIMIT + 30; i++)
      state = nudgeSelected(
        select(state, { list: "furniture", index: 0 }),
        0.05,
        0,
      );
    let steps = 0;
    while (undo(state) !== state) {
      state = undo(state);
      steps++;
    }
    expect(steps).toBe(HISTORY_LIMIT);
  });

  it("is dirty again after undoing past a save", () => {
    let state = addFurniture(createEditor([], []), "chair", 1, 1);
    state = markSaved(state);
    expect(state.dirty).toBe(false);
    expect(undo(state).dirty).toBe(true);
  });
});

describe("moving", () => {
  const start = () =>
    select(createEditor([desk(0, 0)], []), { list: "furniture", index: 0 });

  it("moves the selected piece onto the grid", () => {
    const state = moveSelectedTo(start(), 1.26, -2.1, 0.25);
    expect(state.furniture[0].x).toBeCloseTo(1.25);
    expect(state.furniture[0].z).toBeCloseTo(-2);
  });

  it("makes a drag one single step to undo, however many times it moves", () => {
    let state = beginDrag(start());
    for (let i = 1; i <= 20; i++)
      state = moveSelectedTo(state, i * 0.1, 0, 0.05);
    expect(state.furniture[0].x).toBeCloseTo(2);
    expect(undo(state).furniture[0].x).toBe(0);
  });

  it("moves a model too", () => {
    const state = moveSelectedTo(
      select(createEditor([], [shelf]), { list: "models", index: 0 }),
      5.1,
      -5.9,
      0.1,
    );
    expect(state.models[0].at[0]).toBeCloseTo(5.1);
    expect(state.models[0].at[1]).toBeCloseTo(-5.9);
  });

  it("does nothing with nothing selected", () => {
    const state = createEditor([desk()], []);
    expect(moveSelectedTo(state, 3, 3, 0.1)).toBe(state);
  });

  it("nudges by a step, each one undoable", () => {
    const state = nudgeSelected(start(), 0.25, -0.25);
    expect(state.furniture[0].x).toBeCloseTo(0.25);
    expect(state.furniture[0].z).toBeCloseTo(-0.25);
    expect(undo(state).furniture[0].x).toBe(0);
  });
});

describe("rotating and changing", () => {
  it("turns furniture a quarter at a time and round again", () => {
    let state = select(createEditor([desk()], []), {
      list: "furniture",
      index: 0,
    });
    const turns: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = rotateSelected(state);
      turns.push(state.furniture[0].rotation);
    }
    expect(turns).toEqual([90, 180, 270, 0, 90]);
  });

  it("turns a model a quarter at a time, staying within a turn", () => {
    let state = select(createEditor([], [{ ...shelf, rotationDeg: 270 }]), {
      list: "models",
      index: 0,
    });
    state = rotateSelected(state);
    expect(state.models[0].rotationDeg).toBe(0);
    state = rotateSelected(state);
    expect(state.models[0].rotationDeg).toBe(90);
  });

  it("changes a poster's version", () => {
    const state = setVariant(
      select(createEditor([{ kind: "poster", x: 0, z: 0, rotation: 0 }], []), {
        list: "furniture",
        index: 0,
      }),
      2,
    );
    expect(state.furniture[0].variant).toBe(2);
  });

  it("ignores a version that is not a whole number", () => {
    const base = select(createEditor([desk()], []), {
      list: "furniture",
      index: 0,
    });
    expect(setVariant(base, 1.5)).toBe(base);
  });

  it("updates a model's footprint and scale", () => {
    const state = updateSelectedModel(
      select(createEditor([], [shelf]), { list: "models", index: 0 }),
      { footprint: [2, 0.5], scale: 1.2 },
    );
    expect(state.models[0]).toMatchObject({ footprint: [2, 0.5], scale: 1.2 });
  });

  it("does nothing to furniture when asked to update a model", () => {
    const base = select(createEditor([desk()], []), {
      list: "furniture",
      index: 0,
    });
    expect(updateSelectedModel(base, { scale: 2 })).toBe(base);
  });
});

describe("deleting and duplicating", () => {
  it("removes the selected piece and clears the selection", () => {
    const state = deleteSelected(
      select(createEditor([desk(0, 0), desk(5, 5)], []), {
        list: "furniture",
        index: 0,
      }),
    );
    expect(state.furniture).toEqual([desk(5, 5)]);
    expect(state.selected).toBeNull();
    expect(undo(state).furniture).toHaveLength(2);
  });

  it("removes a model", () => {
    const state = deleteSelected(
      select(createEditor([], [shelf]), { list: "models", index: 0 }),
    );
    expect(state.models).toEqual([]);
  });

  it("does nothing with nothing selected", () => {
    const state = createEditor([desk()], []);
    expect(deleteSelected(state)).toBe(state);
  });

  it("copies the piece a little to the side and selects the copy", () => {
    const state = duplicateSelected(
      select(createEditor([desk(1, 1)], []), { list: "furniture", index: 0 }),
    );
    expect(state.furniture).toHaveLength(2);
    expect(state.furniture[1].x).toBeGreaterThan(1);
    expect(state.furniture[1].kind).toBe("desk");
    expect(state.selected).toEqual({ list: "furniture", index: 1 });
  });

  it("copies a model too, without sharing its footprint with the original", () => {
    const state = duplicateSelected(
      select(createEditor([], [shelf]), { list: "models", index: 0 }),
    );
    expect(state.models).toHaveLength(2);
    expect(state.models[1].footprint).toEqual(shelf.footprint);
    expect(state.models[1].footprint).not.toBe(state.models[0].footprint);
  });
});

describe("pickAt", () => {
  const state = createEditor(
    [
      { kind: "rug", x: 8, z: 0, rotation: 0 },
      { kind: "meeting-table", x: 8, z: 0, rotation: 0 },
      { kind: "chair", x: 6.9, z: 0, rotation: 180 },
    ],
    [shelf],
  );

  it("finds what is under the point", () => {
    expect(pickAt(state, 8, 0)).toEqual({ list: "furniture", index: 1 });
    expect(pickAt(state, 6.9, 0)).toEqual({ list: "furniture", index: 2 });
  });

  it("prefers a table over the rug it stands on, whatever the order they were added in", () => {
    expect(pickAt(state, 8.3, 0.4)).toEqual({ list: "furniture", index: 1 });
  });

  it("still finds the rug where nothing else is on it", () => {
    expect(pickAt(state, 9.8, 2)).toEqual({ list: "furniture", index: 0 });
  });

  it("finds a model by its footprint", () => {
    expect(pickAt(state, 4, -6)).toEqual({ list: "models", index: 0 });
  });

  it("finds nothing on bare floor", () => {
    expect(pickAt(state, -8, 5)).toBeNull();
  });

  it("takes the one added last when two overlap", () => {
    const stacked = createEditor([desk(0, 0), desk(0.5, 0)], []);
    expect(pickAt(stacked, 0.3, 0)).toEqual({ list: "furniture", index: 1 });
  });

  it("finds a ceiling light only when pointing at it", () => {
    const lit = createEditor([{ kind: "light", x: 0, z: 0, rotation: 0 }], []);
    expect(pickAt(lit, 0.2, 0.1)).toEqual({ list: "furniture", index: 0 });
    expect(pickAt(lit, 2, 2)).toBeNull();
  });
});
