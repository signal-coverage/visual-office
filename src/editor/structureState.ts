import type { Box } from "../../shared/collision.ts";
import { DEFAULT_SHELL } from "../../shared/defaultShell.ts";
import type { FloorTemplate } from "../../shared/floorTemplates.ts";
import {
  shellFloorBox,
  type FloorTone,
  type Shell,
  type ShellBoard,
  type ShellRef,
  type ShellScreen,
} from "../../shared/shell.ts";
import {
  addArea,
  addFloorPatch,
  addWall,
  addZone,
  anchorOf,
  deleteRef,
  edgeOf,
  lineFromDrag,
  MIN_SIDES,
  moveTo,
  nudge,
  placeMount,
  rectFromDrag,
  renameRef,
  resizeFloor,
  setGeometry,
  setMount,
  setSpawnArea,
  setSpawnYaw,
  setTone,
  THICKNESS,
  type Edit,
  type Geometry,
  type MountKind,
  type MountPatch,
  type Point,
} from "./shellEdit";
import { snap } from "./snap";
import { remember, withLists, type EditorState } from "./state";

/** What a change gives: the new state, or the same state and the reason nothing changed. */
export interface Outcome {
  state: EditorState;
  error: string | null;
  /** Something worth telling, when it did change. */
  note?: string;
}

/** The shell being edited: the floor's own, or the default one. */
export const shellOf = (state: EditorState): Shell =>
  state.shell ?? DEFAULT_SHELL;

export function selectStructure(
  state: EditorState,
  ref: ShellRef | null,
): EditorState {
  const same =
    state.structure === ref ||
    (state.structure !== null &&
      ref !== null &&
      state.structure.kind === ref.kind &&
      state.structure.index === ref.index);
  if (same && state.selected === null) return state;
  return { ...state, structure: same ? state.structure : ref, selected: null };
}

/** Puts a new shell in, as a step of its own. */
function commit(
  state: EditorState,
  shell: Shell,
  structure: ShellRef | null,
): EditorState {
  return withLists(remember(state), {
    shell,
    structure,
    selected: null,
    shellTouched: true,
  });
}

/** A change that is part of a step already begun (a drag): no new step. */
function change(state: EditorState, shell: Shell): EditorState {
  return shell === shellOf(state)
    ? state
    : withLists(state, { shell, shellTouched: true });
}

function added(state: EditorState, edit: Edit): Outcome {
  if ("error" in edit) return { state, error: edit.error };
  return { state: commit(state, edit.shell, edit.ref), error: null };
}

/** The line a drag draws, for the preview and for what is added: null while it is a click. */
export function lineOfDrag(
  kind: "wall" | "glass",
  from: Point,
  to: Point,
  step: number,
  shell: Shell,
) {
  return lineFromDrag(from, to, {
    step,
    thickness: THICKNESS[kind],
    within: edgeOf(shell),
  });
}

export type RectTool = "zone" | "area" | "floor" | "spawn";

/** The rectangle a drag draws, for the preview and for what is added: null while it is a click. */
export function rectOfDrag(
  tool: RectTool,
  from: Point,
  to: Point,
  step: number,
  shell: Shell,
): Box | null {
  return rectFromDrag(from, to, {
    step,
    within: tool === "area" ? edgeOf(shell) : shellFloorBox(shell),
    min: MIN_SIDES[tool],
  });
}

export function drawLine(
  state: EditorState,
  kind: "wall" | "glass",
  from: Point,
  to: Point,
  step: number,
): Outcome {
  const shell = shellOf(state);
  const slab = lineOfDrag(kind, from, to, step, shell);
  if (!slab)
    return {
      state,
      error: `Drag along the floor to draw a ${kind === "wall" ? "wall" : "glass wall"}.`,
    };
  return added(state, addWall(shell, kind, slab));
}

export const addZoneTo = (
  state: EditorState,
  rect: Box,
  label: string,
): Outcome => added(state, addZone(shellOf(state), rect, label));

export const addAreaTo = (
  state: EditorState,
  rect: Box,
  label: string,
): Outcome => added(state, addArea(shellOf(state), rect, label));

export const addPatchTo = (
  state: EditorState,
  rect: Box,
  tone: FloorTone,
): Outcome => added(state, addFloorPatch(shellOf(state), rect, tone));

export function setSpawnTo(state: EditorState, rect: Box): EditorState {
  return commit(state, setSpawnArea(shellOf(state), rect), {
    kind: "spawn",
    index: 0,
  });
}

export function turnSpawn(state: EditorState, yaw: number): EditorState {
  const shell = setSpawnYaw(shellOf(state), yaw);
  return shell === shellOf(state)
    ? state
    : commit(state, shell, state.structure);
}

export const hangMount = (
  state: EditorState,
  kind: MountKind,
  click: Point,
  step: number,
): Outcome => added(state, placeMount(shellOf(state), kind, click, step));

/** Where a board or a screen would hang if the click was here, or why it would not. Changes nothing. */
export function previewMount(
  state: EditorState,
  kind: MountKind,
  click: Point,
  step: number,
): { mount: ShellBoard | ShellScreen | null; error: string | null } {
  const edit = placeMount(shellOf(state), kind, click, step);
  if ("error" in edit) return { mount: null, error: edit.error };
  const list = kind === "board" ? edit.shell.boards : edit.shell.screens;
  return { mount: list[edit.ref.index] ?? null, error: null };
}

/**
 * Puts the selected part where it is dragged to: the corner of a slab or a
 * rectangle on the grid, a board on the wall face nearest. Not a step of its
 * own: call `beginDrag` when the drag starts.
 */
export function moveStructureTo(
  state: EditorState,
  to: Point,
  step: number,
): EditorState {
  const ref = state.structure;
  if (!ref) return state;
  const shell = shellOf(state);
  const mount = ref.kind === "board" || ref.kind === "screen";
  const target: Point = mount ? to : [snap(to[0], step), snap(to[1], step)];
  return change(state, moveTo(shell, ref, target, step));
}

/** Where the selected part is held when it is dragged, or null. */
export function structureAnchor(state: EditorState): Point | null {
  return state.structure ? anchorOf(shellOf(state), state.structure) : null;
}

export function nudgeStructure(
  state: EditorState,
  dx: number,
  dz: number,
): EditorState {
  const ref = state.structure;
  if (!ref) return state;
  const shell = nudge(shellOf(state), ref, dx, dz);
  return shell === shellOf(state) ? state : commit(state, shell, ref);
}

/** Takes the selected part out; the note says what went with it. */
export function deleteStructure(state: EditorState): Outcome {
  const ref = state.structure;
  if (!ref) return { state, error: null };
  const before = shellOf(state);
  if (ref.kind === "spawn")
    return {
      state,
      error: "The place where people appear can be moved, not deleted.",
    };
  const shell = deleteRef(before, ref);
  if (shell === before) return { state, error: null };
  const boards = before.boards.length - shell.boards.length;
  const screens = before.screens.length - shell.screens.length;
  const went = [
    boards > 0 ? `${boards} ${boards === 1 ? "board" : "boards"}` : "",
    screens > 0 ? `${screens} ${screens === 1 ? "screen" : "screens"}` : "",
  ].filter(Boolean);
  return {
    state: commit(state, shell, null),
    error: null,
    ...(ref.kind === "zone" && went.length > 0
      ? { note: `The zone went with its ${went.join(" and ")}.` }
      : {}),
  };
}

export function setStructureGeometry(
  state: EditorState,
  patch: Partial<Geometry>,
): EditorState {
  const ref = state.structure;
  if (!ref) return state;
  const shell = setGeometry(shellOf(state), ref, patch);
  return shell === shellOf(state) ? state : commit(state, shell, ref);
}

export function setStructureMount(
  state: EditorState,
  patch: MountPatch,
): EditorState {
  const ref = state.structure;
  if (!ref) return state;
  const shell = setMount(shellOf(state), ref, patch);
  return shell === shellOf(state) ? state : commit(state, shell, ref);
}

export function renameStructure(
  state: EditorState,
  patch: { label?: string; id?: string },
): Outcome {
  const ref = state.structure;
  if (!ref) return { state, error: null };
  const result = renameRef(shellOf(state), ref, patch);
  if ("error" in result) return { state, error: result.error };
  return { state: commit(state, result.shell, ref), error: null };
}

export function setStructureTone(
  state: EditorState,
  tone: FloorTone,
): EditorState {
  const ref = state.structure;
  if (ref?.kind !== "floor") return state;
  return commit(state, setTone(shellOf(state), ref.index, tone), ref);
}

export function resizeStructureFloor(
  state: EditorState,
  width: number,
  depth: number,
): EditorState {
  const shell = resizeFloor(shellOf(state), width, depth);
  const now = shellOf(state);
  if (shell.width === now.width && shell.depth === now.depth) return state;
  return commit(state, shell, state.structure);
}

/**
 * Replaces the structure with a template's, and the furniture too when asked.
 * The first template is the default shell, which a floor has by having none.
 * Only a draft until it is published.
 */
export function applyTemplate(
  state: EditorState,
  template: FloorTemplate,
  replaceFurniture: boolean,
): EditorState {
  return withLists(remember(state), {
    shell: template.shell === DEFAULT_SHELL ? undefined : template.shell,
    ...(replaceFurniture
      ? { furniture: template.furniture, models: template.models }
      : {}),
    selected: null,
    structure: null,
    shellTouched: true,
  });
}

/**
 * What a publish says about the shell: nothing, when the floor has none and it
 * was never touched (so the server keeps what it has); the shell the floor has;
 * or null, to go back to the default one.
 */
export function shellToPublish(
  state: EditorState,
): { send: false } | { send: true; shell: Shell | null } {
  if (state.shell) return { send: true, shell: state.shell };
  return state.shellTouched ? { send: true, shell: null } : { send: false };
}
