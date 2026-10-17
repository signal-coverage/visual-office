import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Box } from "../../../shared/collision.ts";
import type { FloorTone } from "../../../shared/shell.ts";
import type { Draft } from "../drawShell";
import {
  anchorOf,
  labelProblem,
  pickStructure,
  type Point,
} from "../shellEdit";
import { beginDrag, type EditorState } from "../state";
import {
  addAreaTo,
  addPatchTo,
  addZoneTo,
  drawLine,
  hangMount,
  lineOfDrag,
  moveStructureTo,
  previewMount,
  rectOfDrag,
  selectStructure,
  setSpawnTo,
  shellOf,
  type RectTool,
} from "../structureState";
import type { Tool } from "../StructurePalette";
import { DRAG_THRESHOLD } from "./consts";

type DrawTool = "wall" | "glass" | RectTool;

/** What a rectangle being drawn is called on the plan. */
const WORDS: Record<RectTool, string> = {
  zone: "Private room",
  area: "Area",
  spawn: "Where people appear",
  floor: "Floor patch",
};

const isDrawTool = (tool: Tool): tool is DrawTool =>
  tool === "wall" ||
  tool === "glass" ||
  tool === "zone" ||
  tool === "area" ||
  tool === "spawn" ||
  tool === "floor";

/** A press that is a rectangle or a line being drawn, or a part being dragged. */
type Gesture =
  | { kind: "draw"; tool: DrawTool; from: Point }
  | { kind: "drag"; offset: Point; start: Point; started: boolean };

export interface StructureToolsDeps {
  editor: EditorState;
  setEditor: Dispatch<SetStateAction<EditorState>>;
  /** The grid the plan snaps to, in meters. */
  step: number;
  /** Whether the plan can be changed at all. */
  editing: boolean;
  /** Tells the person what happened. */
  say: (text: string) => void;
}

/** A rectangle that was drawn and waits for its name. */
export interface Naming {
  kind: "zone" | "area";
  rect: Box;
}

/**
 * What the mouse does on the plan in the structure mode: draw a wall, a room,
 * hang a board, pick a part and drag it. Every change itself is a pure
 * transition of the editor state (`structureState.ts`); this only holds the
 * gesture in progress.
 */
export function useStructureTools({
  editor,
  setEditor,
  step,
  editing,
  say,
}: StructureToolsDeps) {
  const [tool, setTool] = useState<Tool>("select");
  const [tone, setTone] = useState<FloorTone>("meeting");
  const [naming, setNaming] = useState<Naming | null>(null);
  const [drawing, setDrawing] = useState<{
    tool: DrawTool;
    from: Point;
  } | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const shell = shellOf(editor);

  const draft: Draft | null = useMemo(() => {
    if (drawing && pointer) {
      if (drawing.tool === "wall" || drawing.tool === "glass") {
        const slab = lineOfDrag(
          drawing.tool,
          drawing.from,
          pointer,
          step,
          shell,
        );
        return slab
          ? { kind: "slab", glass: drawing.tool === "glass", slab }
          : null;
      }
      const rect = rectOfDrag(drawing.tool, drawing.from, pointer, step, shell);
      return rect ? { kind: "rect", rect, text: WORDS[drawing.tool] } : null;
    }
    if ((tool === "board" || tool === "screen") && pointer) {
      const shown = previewMount(editor, tool, pointer, step);
      return {
        kind: "mount",
        mount: shown.mount,
        screen: tool === "screen",
        at: pointer,
      };
    }
    return null;
  }, [drawing, pointer, tool, step, shell, editor]);

  const cancel = useCallback((): boolean => {
    const busy = gesture.current !== null;
    gesture.current = null;
    setDrawing(null);
    return busy;
  }, []);

  const press = (world: Point, client: Point) => {
    if (!editing) return;
    if (tool === "select") {
      const ref = pickStructure(shell, world[0], world[1]);
      setEditor((state) => selectStructure(state, ref));
      const anchor = ref ? anchorOf(shell, ref) : null;
      if (ref && anchor)
        gesture.current = {
          kind: "drag",
          offset: [world[0] - anchor[0], world[1] - anchor[1]],
          start: client,
          started: false,
        };
      return;
    }
    if (isDrawTool(tool)) {
      gesture.current = { kind: "draw", tool, from: world };
      setDrawing({ tool, from: world });
      setPointer(world);
      return;
    }
    const outcome = hangMount(editor, tool, world, step);
    setEditor(outcome.state);
    if (outcome.error) say(outcome.error);
  };

  const move = (world: Point, client: Point) => {
    setPointer(world);
    const held = gesture.current;
    if (held?.kind !== "drag") return;
    if (
      !held.started &&
      Math.hypot(client[0] - held.start[0], client[1] - held.start[1]) <
        DRAG_THRESHOLD
    )
      return;
    if (!held.started) {
      held.started = true;
      setEditor(beginDrag);
    }
    const to: Point = [world[0] - held.offset[0], world[1] - held.offset[1]];
    setEditor((state) => moveStructureTo(state, to, step));
  };

  const release = (world: Point) => {
    const held = gesture.current;
    gesture.current = null;
    setDrawing(null);
    if (held?.kind !== "draw") return;
    const { tool: drawn, from } = held;
    if (drawn === "wall" || drawn === "glass") {
      const outcome = drawLine(editor, drawn, from, world, step);
      setEditor(outcome.state);
      if (outcome.error) say(outcome.error);
      return;
    }
    const rect = rectOfDrag(drawn, from, world, step, shell);
    if (!rect) {
      say("Drag a rectangle on the plan.");
      return;
    }
    if (drawn === "zone" || drawn === "area") {
      setNaming({ kind: drawn, rect });
    } else if (drawn === "spawn") {
      setEditor(setSpawnTo(editor, rect));
    } else {
      const outcome = addPatchTo(editor, rect, tone);
      setEditor(outcome.state);
      if (outcome.error) say(outcome.error);
    }
  };

  const leave = () => {
    cancel();
    setPointer(null);
  };

  /** Gives the room or the area that was drawn its name. */
  const name = (label: string) => {
    if (!naming) return;
    const outcome =
      naming.kind === "zone"
        ? addZoneTo(editor, naming.rect, label)
        : addAreaTo(editor, naming.rect, label);
    setEditor(outcome.state);
    setNaming(null);
    if (outcome.error) say(outcome.error);
  };

  const validateName = (label: string) =>
    naming ? labelProblem(shell, naming.kind, label) : null;

  return {
    tool,
    setTool: (next: Tool) => {
      cancel();
      setTool(next);
    },
    tone,
    setTone,
    draft,
    naming,
    cancelNaming: () => setNaming(null),
    name,
    validateName,
    press,
    move,
    release,
    leave,
    cancel,
  };
}
