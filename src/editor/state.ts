import type { Box } from "../../shared/collision.ts";
import {
  furnitureExtent,
  isFlat,
  type Furniture,
  type FurnitureKind,
  type Rotation,
} from "../../shared/furniture.ts";
import type { Target } from "../../shared/officeProblems.ts";
import { footprintCollider, type PropPlacement } from "../../shared/props.ts";
import type { Shell, ShellRef } from "../../shared/shell.ts";

/**
 * The things being edited. Lists are never changed in place, so a snapshot is
 * just a few references. The shell is undefined while the floor has the
 * default one.
 */
export interface Snapshot {
  furniture: Furniture[];
  models: PropPlacement[];
  shell: Shell | undefined;
}

export interface EditorState extends Snapshot {
  selected: Target | null;
  /** The part of the shell that is selected, in the structure mode. */
  structure: ShellRef | null;
  /** Whether the structure was changed in this session: only then does a publish say what the shell is. */
  shellTouched: boolean;
  past: Snapshot[];
  future: Snapshot[];
  /** Where the lists were when last saved, to tell whether there is anything unsaved. */
  saved: Snapshot;
  dirty: boolean;
}

export const HISTORY_LIMIT = 100;
/** How far a copy is put from the original, so it can be seen. */
const DUPLICATE_OFFSET = 0.5;

import { snap } from "./snap";

export { snap };

const isDirty = (state: Snapshot, saved: Snapshot) =>
  state.furniture !== saved.furniture ||
  state.models !== saved.models ||
  state.shell !== saved.shell;

const snapshotOf = (state: Snapshot): Snapshot => ({
  furniture: state.furniture,
  models: state.models,
  shell: state.shell,
});

/** The state with these lists and selection, and `dirty` worked out again. */
export function withLists(
  state: EditorState,
  changes: Partial<Snapshot> & {
    selected?: Target | null;
    structure?: ShellRef | null;
    shellTouched?: boolean;
  },
): EditorState {
  const next = { ...state, ...changes };
  return { ...next, dirty: isDirty(next, next.saved) };
}

/** Remembers where things were, so the change that follows can be undone. */
export function remember(state: EditorState): EditorState {
  const past = [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT);
  return { ...state, past, future: [] };
}

export function createEditor(
  furniture: Furniture[],
  models: PropPlacement[],
  shell?: Shell,
): EditorState {
  const snapshot: Snapshot = { furniture, models, shell };
  return {
    ...snapshot,
    selected: null,
    structure: null,
    shellTouched: false,
    past: [],
    future: [],
    saved: snapshot,
    dirty: false,
  };
}

export function select(state: EditorState, target: Target | null): EditorState {
  const same =
    state.selected === target ||
    (state.selected !== null &&
      target !== null &&
      state.selected.list === target.list &&
      state.selected.index === target.index);
  if (same && state.structure === null) return state;
  return { ...state, selected: target, structure: null };
}

export function addFurniture(
  state: EditorState,
  kind: FurnitureKind,
  x: number,
  z: number,
): EditorState {
  const furniture = [
    ...state.furniture,
    { kind, x, z, rotation: 0 as Rotation },
  ];
  return withLists(remember(state), {
    furniture,
    selected: { list: "furniture", index: furniture.length - 1 },
  });
}

export function addModel(
  state: EditorState,
  model: string,
  x: number,
  z: number,
  footprint?: readonly [number, number],
): EditorState {
  const prop: PropPlacement = { model, at: [x, z] };
  if (footprint) prop.footprint = [footprint[0], footprint[1]];
  const models = [...state.models, prop];
  return withLists(remember(state), {
    models,
    selected: { list: "models", index: models.length - 1 },
  });
}

/** Call once when a drag starts: everything the drag moves then undoes in one step. */
export function beginDrag(state: EditorState): EditorState {
  return remember(state);
}

/** Puts the selected piece where it is dragged to. Not a step of its own: see `beginDrag`. */
export function moveSelectedTo(
  state: EditorState,
  x: number,
  z: number,
  step: number,
): EditorState {
  const { selected } = state;
  if (!selected) return state;
  const nx = snap(x, step);
  const nz = snap(z, step);
  if (selected.list === "furniture") {
    const furniture = state.furniture.map((item, i) =>
      i === selected.index ? { ...item, x: nx, z: nz } : item,
    );
    return withLists(state, { furniture });
  }
  const models = state.models.map((prop, i) =>
    i === selected.index ? { ...prop, at: [nx, nz] as [number, number] } : prop,
  );
  return withLists(state, { models });
}

/** Moves the selected piece by a small amount, as a step of its own. */
export function nudgeSelected(
  state: EditorState,
  dx: number,
  dz: number,
): EditorState {
  const { selected } = state;
  if (!selected) return state;
  const [x, z] =
    selected.list === "furniture"
      ? [state.furniture[selected.index].x, state.furniture[selected.index].z]
      : state.models[selected.index].at;
  return moveSelectedTo(remember(state), x + dx, z + dz, 0.001);
}

export function rotateSelected(state: EditorState): EditorState {
  const { selected } = state;
  if (!selected) return state;
  if (selected.list === "furniture") {
    const furniture = state.furniture.map((item, i) =>
      i === selected.index
        ? { ...item, rotation: ((item.rotation + 90) % 360) as Rotation }
        : item,
    );
    return withLists(remember(state), { furniture });
  }
  const models = state.models.map((prop, i) =>
    i === selected.index
      ? {
          ...prop,
          rotationDeg: ((((prop.rotationDeg ?? 0) + 90) % 360) + 360) % 360,
        }
      : prop,
  );
  return withLists(remember(state), { models });
}

export function setVariant(state: EditorState, variant: number): EditorState {
  const { selected } = state;
  if (
    selected?.list !== "furniture" ||
    !Number.isInteger(variant) ||
    variant < 0
  )
    return state;
  const furniture = state.furniture.map((item, i) =>
    i === selected.index ? { ...item, variant } : item,
  );
  return withLists(remember(state), { furniture });
}

/** Changes what is stated about the selected model: footprint, scale, turn. */
export function updateSelectedModel(
  state: EditorState,
  patch: Partial<Pick<PropPlacement, "footprint" | "scale" | "rotationDeg">>,
): EditorState {
  const { selected } = state;
  if (selected?.list !== "models") return state;
  const models = state.models.map((prop, i) =>
    i === selected.index ? { ...prop, ...patch } : prop,
  );
  return withLists(remember(state), { models });
}

export function deleteSelected(state: EditorState): EditorState {
  const { selected } = state;
  if (!selected) return state;
  const remembered = remember(state);
  return selected.list === "furniture"
    ? withLists(remembered, {
        furniture: state.furniture.filter((_, i) => i !== selected.index),
        selected: null,
      })
    : withLists(remembered, {
        models: state.models.filter((_, i) => i !== selected.index),
        selected: null,
      });
}

export function duplicateSelected(state: EditorState): EditorState {
  const { selected } = state;
  if (!selected) return state;
  const remembered = remember(state);
  if (selected.list === "furniture") {
    const original = state.furniture[selected.index];
    const furniture = [
      ...state.furniture,
      {
        ...original,
        x: original.x + DUPLICATE_OFFSET,
        z: original.z + DUPLICATE_OFFSET,
      },
    ];
    return withLists(remembered, {
      furniture,
      selected: { list: "furniture", index: furniture.length - 1 },
    });
  }
  const original = state.models[selected.index];
  const models = [
    ...state.models,
    {
      ...original,
      at: [
        original.at[0] + DUPLICATE_OFFSET,
        original.at[1] + DUPLICATE_OFFSET,
      ] as [number, number],
      ...(original.footprint && {
        footprint: [original.footprint[0], original.footprint[1]] as [
          number,
          number,
        ],
      }),
    },
  ];
  return withLists(remembered, {
    models,
    selected: { list: "models", index: models.length - 1 },
  });
}

export function undo(state: EditorState): EditorState {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return withLists(
    {
      ...state,
      past: state.past.slice(0, -1),
      future: [snapshotOf(state), ...state.future],
    },
    { ...previous, selected: null, structure: null },
  );
}

export function redo(state: EditorState): EditorState {
  const [next, ...rest] = state.future;
  if (!next) return state;
  return withLists(
    {
      ...state,
      past: [...state.past, snapshotOf(state)],
      future: rest,
    },
    { ...next, selected: null, structure: null },
  );
}

/** Records that what is on screen is what is in the file now. */
export function markSaved(state: EditorState): EditorState {
  return { ...state, saved: snapshotOf(state), dirty: false };
}

const contains = (box: Box, x: number, z: number) =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;

/**
 * What is under a point on the floor. Models and furniture go before a rug
 * (which things stand on), and among equals the one added last, which is the
 * one drawn on top.
 */
export function pickAt(
  state: EditorState,
  x: number,
  z: number,
): Target | null {
  for (let i = state.models.length - 1; i >= 0; i--) {
    const box = footprintCollider(state.models[i]);
    if (box && contains(box, x, z)) return { list: "models", index: i };
  }
  for (const flat of [false, true]) {
    for (let i = state.furniture.length - 1; i >= 0; i--) {
      const item = state.furniture[i];
      if (isFlat(item.kind) !== flat) continue;
      if (furnitureExtent(item).some((box) => contains(box, x, z)))
        return { list: "furniture", index: i };
    }
  }
  return null;
}
