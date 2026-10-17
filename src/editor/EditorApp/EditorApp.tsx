import { Button, Label, ListBox, Select } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  sanitizeFurniture,
  type Furniture,
} from "../../../shared/furniture.ts";
import { shellOrDefault } from "../../../shared/defaultShell.ts";
import { FLOOR_TEMPLATES } from "../../../shared/floorTemplates.ts";
import { FURNITURE } from "../../../shared/layout.ts";
import type { Target } from "../../../shared/officeProblems.ts";
import {
  PROPS,
  sanitizeModels,
  toModelFileName,
  type PropPlacement,
} from "../../../shared/props.ts";
import { drawPlan, targetKey, type Ghost } from "../draw";
import type { EditorBackend } from "../backend";
import { FloorSession, type SessionState } from "../floorSession";
import { Inspector, type Inspected } from "../Inspector";
import { forgetModel, measureModel } from "../measure";
import { ModeSwitch, type EditorMode } from "../ModeSwitch";
import { NameModal } from "../NameModal";
import { Palette, type Placing } from "../Palette";
import {
  blocking,
  editorProblems,
  structureKeys,
  type EditorProblem,
} from "../problems";
import { ProblemList } from "../ProblemList";
import { describeOutside, partsOutside } from "../shellEdit";
import { StructureInspector } from "../StructureInspector";
import { StructurePalette } from "../StructurePalette";
import {
  deleteStructure,
  nudgeStructure,
  renameStructure,
  resizeStructureFloor,
  selectStructure,
  setStructureGeometry,
  setStructureMount,
  setStructureTone,
  shellOf,
  shellToPublish,
  turnSpawn,
  applyTemplate,
} from "../structureState";
import { TemplateModal } from "../TemplateModal";
import { TipButton } from "../TipButton";
import {
  addFurniture,
  addModel,
  beginDrag,
  createEditor,
  deleteSelected,
  duplicateSelected,
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
  type EditorState,
} from "../state";
import { viewOf } from "../view";
import {
  DEFAULT_STEP,
  DRAG_THRESHOLD,
  FALLBACK_FOOTPRINT,
  SNAPS,
  STATUS,
  LEGEND,
  STRUCTURE_STEP,
} from "./consts";
import * as styles from "./styles";
import { useStructureTools } from "./useStructureTools";

/** The layout the game server has stored for the floor, or null (none yet, or no game server). */
interface StoredLayout {
  version: number;
  furniture: unknown;
  models: unknown;
  /** The shell of the floor: none for a floor that has the default one. */
  shell?: unknown;
}

async function fetchStoredLayout(
  backend: EditorBackend,
): Promise<StoredLayout | null> {
  try {
    const response = await backend.request(backend.layoutUrl);
    return response.ok ? ((await response.json()) as StoredLayout) : null;
  } catch {
    return null;
  }
}

/** A press on a piece that may turn into a drag. */
interface Drag {
  /** Where inside the piece it was grabbed, so it does not jump to the cursor. */
  offsetX: number;
  offsetZ: number;
  startX: number;
  startY: number;
  started: boolean;
}

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("input, select, textarea") !== null;

export interface EditorAppProps {
  /** Where the editor gets and sends things: the development server, or the game server. */
  backend: EditorBackend;
  /** Leaves the editor, when it is shown inside the game. */
  onClose?: () => void;
}

export function EditorApp({ backend, onClose }: EditorAppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [editor, setEditor] = useState(() => createEditor(FURNITURE, PROPS));
  const [mode, setMode] = useState<EditorMode>("furniture");
  const [applying, setApplying] = useState(false);
  /** The shell of the floor: its own, or the default one. */
  const shell = shellOf(editor);
  const view = useMemo(() => viewOf(shell), [shell]);
  const [modelFiles, setModelFiles] = useState<string[]>([]);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [step, setStep] = useState(DEFAULT_STEP);
  const [footprints, setFootprints] = useState<
    Record<string, readonly [number, number] | null>
  >({});

  // The plan can only be changed while this editor holds the floor (it is
  // closed to everybody else meanwhile), or when told to go without a lock.
  const [session, setSession] = useState<SessionState>({ kind: "idle" });
  // Who this page is, for the floor lock and for the layouts it publishes
  const [holder] = useState(() => `editor-${crypto.randomUUID().slice(0, 8)}`);
  const [floor] = useState(
    () =>
      new FloorSession({
        fetch: (url, init) => backend.request(String(url), init),
        base: backend.floorBase,
        holder,
        onChange: setSession,
        beacon: backend.beacon,
      }),
  );
  const editing = session.kind === "editing";

  // What the last thing that happened was (saved, uploaded…). It is only true
  // while the plan is as it was then, so it goes away by itself with the next edit.
  const [note, setNote] = useState<{
    text: string;
    furniture: Furniture[];
    models: PropPlacement[];
    shell: EditorState["shell"];
  } | null>(null);
  const latest = useRef(editor);
  useEffect(() => {
    latest.current = editor;
  });
  const say = useCallback((text: string) => {
    const { furniture, models, shell } = latest.current;
    setNote({ text, furniture, models, shell });
  }, []);
  const message =
    note &&
    note.furniture === editor.furniture &&
    note.models === editor.models &&
    note.shell === editor.shell
      ? note.text
      : null;

  const problems = useMemo(
    () => editorProblems(editor.furniture, editor.models, shell),
    [editor.furniture, editor.models, shell],
  );
  const errors = blocking(problems);
  const warnings = useMemo(
    () => problems.filter((problem) => problem.level === "warning"),
    [problems],
  );
  const outside = useMemo(
    () => partsOutside(shell, editor.furniture, editor.models),
    [shell, editor.furniture, editor.models],
  );
  const structureMode = mode === "structure";
  const tools = useStructureTools({ editor, setEditor, step, editing, say });

  /** Shows the layout stored in the database, if there is one and nothing was touched yet. */
  const applyStored = useCallback((stored: StoredLayout | null) => {
    if (!stored || latest.current.past.length > 0 || latest.current.dirty)
      return;
    const next = createEditor(
      sanitizeFurniture(stored.furniture),
      sanitizeModels(stored.models),
      stored.shell === undefined || stored.shell === null
        ? undefined
        : shellOrDefault(stored.shell),
    );
    setEditor(next);
    setNote({
      text: `Loaded version ${stored.version} from the database.`,
      furniture: next.furniture,
      models: next.models,
      shell: next.shell,
    });
  }, []);
  useEffect(() => {
    void fetchStoredLayout(backend).then(applyStored);
  }, [applyStored, backend]);

  // The models there are to place
  useEffect(() => {
    void backend
      .listModels()
      .then(setModelFiles)
      .catch(() => say("Could not list the models."));
  }, [say, backend]);

  // A model starts with the floor area it really covers
  const placingModel = placing?.kind === "model" ? placing.model : null;
  useEffect(() => {
    if (!placingModel) return;
    void measureModel(placingModel).then((size) =>
      setFootprints((known) => ({ ...known, [placingModel]: size })),
    );
  }, [placingModel]);

  const ghost: Ghost | null = useMemo(() => {
    if (structureMode || !placing || !cursor) return null;
    return placing.kind === "furniture"
      ? {
          kind: "furniture",
          item: {
            kind: placing.furniture,
            x: cursor[0],
            z: cursor[1],
            rotation: 0,
          },
        }
      : {
          kind: "model",
          prop: {
            model: placing.model,
            at: cursor,
            footprint: footprints[placing.model] ?? FALLBACK_FOOTPRINT,
          },
        };
  }, [structureMode, placing, cursor, footprints]);

  const flagged = useMemo(
    () => new Set(problems.flatMap((p) => p.targets.map(targetKey))),
    [problems],
  );
  const structureFlagged = useMemo(() => structureKeys(problems), [problems]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawPlan(
      ctx,
      { furniture: editor.furniture, models: editor.models },
      {
        selected: editor.selected,
        flagged,
        ghost,
        ...(structureMode
          ? {
              structure: {
                selected: editor.structure,
                flagged: structureFlagged,
                draft: tools.draft,
              },
            }
          : {}),
      },
      shell,
    );
  }, [
    editor.furniture,
    editor.models,
    editor.selected,
    editor.structure,
    flagged,
    structureFlagged,
    structureMode,
    tools.draft,
    ghost,
    shell,
    view,
  ]);

  // Do not lose work by closing the tab
  useEffect(() => {
    if (!editor.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editor.dirty]);

  // Closing the page opens the floor again right away, not when the lock runs out
  useEffect(() => {
    const leaving = () => floor.leavingPage();
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      leaving();
    };
  }, [floor]);

  const startEditing = async () => {
    say("Closing the floor…");
    const result = await floor.start();
    if (result.ok) {
      say(
        result.told > 0
          ? `The floor is closed. ${result.told} ${result.told === 1 ? "person was" : "people were"} told to leave.`
          : "The floor is closed. Nobody was inside.",
      );
      // Edit what is stored now, not what the page found when it opened
      void fetchStoredLayout(backend).then(applyStored);
    } else if (result.reason === "held") {
      say(`${result.heldBy} is already editing this floor.`);
    } else if (result.reason === "refused") {
      say(result.message);
    } else if (
      backend.devTools &&
      window.confirm(
        "The game server did not answer, so the floor cannot be closed.\n\nEdit anyway, without closing it? Only do that if nobody is playing.",
      )
    ) {
      floor.startOffline();
      say("Editing without closing the floor.");
    } else {
      say(
        backend.devTools
          ? "Not editing: the game server did not answer."
          : "Could not reach the game server, so the floor cannot be closed.",
      );
    }
  };

  const finishEditing = async () => {
    if (
      editor.dirty &&
      !window.confirm("There are unsaved changes. Finish editing anyway?")
    )
      return;
    await floor.finish();
    say("The floor is open again.");
  };

  /** Warnings only warn, but saving or publishing them is a decision, not an accident. */
  const agreesDespiteProblems = (verb: string): boolean => {
    if (warnings.length === 0) return true;
    const sample = warnings
      .slice(0, 3)
      .map((p) => `• ${p.message}`)
      .join("\n");
    const more =
      warnings.length > 3 ? `\n…and ${warnings.length - 3} more.` : "";
    return window.confirm(
      `This layout has ${warnings.length} problem${warnings.length === 1 ? "" : "s"}:\n\n${sample}${more}\n\n${verb} it anyway?`,
    );
  };

  /** Stores the layout as the next version of the floor, which is what the game will show. */
  const publish = async () => {
    if (errors > 0) {
      say(
        `Not published: ${errors === 1 ? "1 error has" : `${errors} errors have`} to be fixed first.`,
      );
      return;
    }
    if (!agreesDespiteProblems("Publish")) {
      say("Not published: there are problems to fix.");
      return;
    }
    say("Publishing…");
    const published = shellToPublish(editor);
    try {
      const response = await backend.request(backend.publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: holder,
          furniture: editor.furniture,
          models: editor.models,
          // The shell goes with it when the floor has one of its own or the structure was changed here
          ...(published.send ? { shell: published.shell } : {}),
          // The server asks for this when there are problems: it was just confirmed above
          acceptProblems: true,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        version?: number;
        dropped?: number;
        shellProblems?: string[];
      };
      if (!response.ok) {
        say(
          [result.error ?? "Could not publish.", result.shellProblems?.[0]]
            .filter(Boolean)
            .join(" "),
        );
        return;
      }
      setEditor(markSaved(editor));
      say(
        `Published as version ${result.version}. The floor shows it once it opens again.`,
      );
    } catch {
      say("Could not publish: is the dev server running?");
    }
  };

  /** Makes the published layout the default in shared/officeData.ts: the database is the truth, the file follows. */
  const exportToFile = async () => {
    if (
      !window.confirm(
        "Replace shared/officeData.ts with the layout that is published?\n\nThe page reloads when the file changes.",
      )
    )
      return;
    say("Exporting…");
    try {
      const response = await fetch("/__editor/export", { method: "POST" });
      const result = (await response.json()) as {
        error?: string;
        version?: number;
      };
      say(
        response.ok
          ? `Exported version ${result.version} to shared/officeData.ts.`
          : (result.error ?? "Could not export."),
      );
    } catch {
      say("Could not export: is the dev server running?");
    }
  };

  const save = async () => {
    if (errors > 0) {
      say("Not saved: there are errors to fix.");
      return;
    }
    if (!agreesDespiteProblems("Save")) {
      say("Not saved: there are problems to fix.");
      return;
    }
    say(STATUS.saving);
    try {
      const response = await fetch("/__editor/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          furniture: editor.furniture,
          models: editor.models,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        dropped?: number;
      };
      if (!response.ok) {
        say(result.error ?? "Could not save.");
        return;
      }
      setEditor(markSaved(editor));
      say(
        result.dropped
          ? `${STATUS.saved} ${result.dropped} entries were not valid and were left out.`
          : STATUS.saved,
      );
    } catch {
      say("Could not save: is the dev server running?");
    }
  };

  /** Puts a model the person picked into public/models, then lets them place it. */
  const upload = async (file: File) => {
    const name = toModelFileName(file.name);
    if (!name) {
      say("Pick a .glb file. Its name can use letters, numbers, - and _.");
      return;
    }
    const send = (overwrite: boolean) =>
      fetch(
        `/__editor/upload?name=${encodeURIComponent(name)}${overwrite ? "&overwrite=1" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
    say(`Uploading ${name}…`);
    try {
      let response = await send(false);
      if (response.status === 409) {
        if (
          !window.confirm(
            `There is already a model called ${name}. Replace it?`,
          )
        ) {
          say("Upload cancelled.");
          return;
        }
        response = await send(true);
      }
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        say(result.error ?? "Could not upload the model.");
        return;
      }
      // A replaced file may have another size than the one measured before
      forgetModel(name);
      setFootprints((known) =>
        Object.fromEntries(
          Object.entries(known).filter(([key]) => key !== name),
        ),
      );
      setModelFiles((known) =>
        known.includes(name) ? known : [...known, name].sort(),
      );
      setPlacing({ kind: "model", model: name });
      say(`${name} is ready: click on the plan to place it.`);
    } catch {
      say("Could not upload: is the dev server running?");
    }
  };

  const onStructureKey = (e: KeyboardEvent, key: string): boolean => {
    if (key === "delete" || key === "backspace") {
      e.preventDefault();
      const outcome = deleteStructure(latest.current);
      setEditor(outcome.state);
      if (outcome.error ?? outcome.note) say(outcome.error ?? outcome.note!);
    } else if (key === "escape") {
      // First Esc stops what is being drawn, then the tool, then lets go of the part
      if (tools.cancel()) return true;
      if (tools.tool !== "select") tools.setTool("select");
      else setEditor((state) => selectStructure(state, null));
    } else if (key.startsWith("arrow")) {
      e.preventDefault();
      const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
      const dz = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
      setEditor((state) => nudgeStructure(state, dx, dz));
    } else return false;
    return true;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing || typingIn(e.target) || tools.naming || applying) return;
      const command = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (structureMode && !command && onStructureKey(e, key)) return;

      if (command && key === "z") {
        e.preventDefault();
        setEditor((state) => (e.shiftKey ? redo(state) : undo(state)));
      } else if (command && key === "y") {
        e.preventDefault();
        setEditor(redo);
      } else if (command && key === "d") {
        e.preventDefault();
        if (!structureMode) setEditor(duplicateSelected);
      } else if (command && key === "s") {
        e.preventDefault();
        void save();
      } else if (!command && key === "r") {
        if (!structureMode) setEditor(rotateSelected);
      } else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        setEditor(deleteSelected);
      } else if (key === "escape") {
        // First Esc stops putting things down; the next lets go of the selection
        if (placing) setPlacing(null);
        else setEditor((state) => select(state, null));
      } else if (key.startsWith("arrow")) {
        e.preventDefault();
        const dx =
          key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dz = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        setEditor((state) => nudgeSelected(state, dx, dz));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Where a mouse event is on the floor, in meters. */
  const worldAt = (e: ReactMouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return view.screenToWorld(
      ((e.clientX - rect.left) * view.canvasWidth) / rect.width,
      ((e.clientY - rect.top) * view.canvasHeight) / rect.height,
    );
  };

  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !editing) return;
    const [wx, wz] = worldAt(e);

    if (structureMode) {
      tools.press([wx, wz], [e.clientX, e.clientY]);
      return;
    }

    if (placing) {
      const x = snap(wx, step);
      const z = snap(wz, step);
      setEditor((state) =>
        placing.kind === "furniture"
          ? addFurniture(state, placing.furniture, x, z)
          : addModel(
              state,
              placing.model,
              x,
              z,
              footprints[placing.model] ?? FALLBACK_FOOTPRINT,
            ),
      );
      return;
    }

    const target = pickAt(editor, wx, wz);
    setEditor((state) => select(state, target));
    if (!target) return;
    const [ox, oz] =
      target.list === "furniture"
        ? [editor.furniture[target.index].x, editor.furniture[target.index].z]
        : editor.models[target.index].at;
    dragRef.current = {
      offsetX: wx - ox,
      offsetZ: wz - oz,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
    };
  };

  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const [wx, wz] = worldAt(e);
    if (structureMode) {
      tools.move([wx, wz], [e.clientX, e.clientY]);
      return;
    }
    setCursor([snap(wx, step), snap(wz, step)]);

    const drag = dragRef.current;
    if (!drag) return;
    if (
      !drag.started &&
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <
        DRAG_THRESHOLD
    )
      return;
    if (!drag.started) {
      drag.started = true;
      setEditor(beginDrag);
    }
    setEditor((state) =>
      moveSelectedTo(state, wx - drag.offsetX, wz - drag.offsetZ, step),
    );
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (structureMode) tools.release(worldAt(e));
    else endDrag();
  };

  const changeMode = (next: EditorMode) => {
    if (next === mode) return;
    setMode(next);
    setPlacing(null);
    setCursor(null);
    tools.cancel();
    tools.setTool("select");
    setStep(next === "structure" ? STRUCTURE_STEP : DEFAULT_STEP);
    setEditor((state) => select(state, null));
  };

  /** Picks what a problem is about, going to the mode where it can be seen. */
  const selectProblem = (problem: EditorProblem) => {
    const [part] = problem.structure;
    const [target] = problem.targets;
    if (part) {
      changeMode("structure");
      setEditor((state) => selectStructure(state, part));
    } else if (target) {
      changeMode("furniture");
      selectTarget(target);
    }
  };

  const applyTemplateChoice = (
    template: (typeof FLOOR_TEMPLATES)[number],
    replaceFurniture: boolean,
  ) => {
    setApplying(false);
    setEditor((state) => applyTemplate(state, template, replaceFurniture));
    say(
      `Applied the ${template.name} template${replaceFurniture ? " and its furniture" : ""}. It is only a draft until you publish.`,
    );
  };

  const inspected: Inspected | null = !editor.selected
    ? null
    : editor.selected.list === "furniture"
      ? { list: "furniture", item: editor.furniture[editor.selected.index] }
      : { list: "models", prop: editor.models[editor.selected.index] };

  const selectTarget = (target: Target) => {
    setPlacing(null);
    setEditor((state) => select(state, target));
  };

  /** Why the default layout file cannot be written from here, or null when it can. */
  const fileBlocked =
    backend.floor !== undefined
      ? "officeData.ts is the default layout of the main office, not of this room"
      : editor.shell !== undefined
        ? "This floor has a shell of its own: officeData.ts is the furniture of the default one"
        : null;

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        {onClose && (
          <TipButton
            variant="secondary"
            size="sm"
            isDisabled={editing}
            tip={editing ? "Finish editing first" : "Back to the office"}
            onPress={onClose}
          >
            Back
          </TipButton>
        )}
        <h1 className={styles.title}>Office editor</h1>
        <ModeSwitch mode={mode} onChange={changeMode} />
        <Button
          variant="secondary"
          size="sm"
          isDisabled={!editing || editor.past.length === 0}
          onPress={() => setEditor(undo)}
        >
          Undo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          isDisabled={!editing || editor.future.length === 0}
          onPress={() => setEditor(redo)}
        >
          Redo
        </Button>
        <Select
          className={styles.snap}
          aria-label="Snap"
          isDisabled={!editing}
          value={step}
          onChange={(next) => {
            if (next !== null && !Array.isArray(next)) setStep(Number(next));
          }}
        >
          <Label>Snap</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SNAPS.map((option) => (
                <ListBox.Item
                  key={option.step}
                  id={option.step}
                  textValue={option.label}
                >
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <span className={styles.spacer} />
        <span className={styles.status(editor.dirty)} role="status">
          {message ??
            (session.kind === "lost"
              ? STATUS.lost
              : !editing
                ? STATUS.readOnly
                : editor.dirty
                  ? STATUS.unsaved
                  : STATUS.clean)}
        </span>
        {editing ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => void finishEditing()}
          >
            Finish editing
          </Button>
        ) : (
          <Button
            size="sm"
            isDisabled={session.kind === "starting"}
            onPress={() => void startEditing()}
          >
            Start editing
          </Button>
        )}
        {backend.devTools && (
          <TipButton
            variant="secondary"
            size="sm"
            isDisabled={!editing || fileBlocked !== null}
            tip={
              fileBlocked
                ? fileBlocked
                : "Writes shared/officeData.ts: the default layout that comes with the code"
            }
            onPress={() => void save()}
          >
            Save to file
          </TipButton>
        )}
        <TipButton
          size="sm"
          variant={editing ? "primary" : "secondary"}
          isDisabled={
            !editing ||
            errors > 0 ||
            (session.kind === "editing" && session.offline)
          }
          tip={
            errors > 0
              ? "Fix the errors listed under Problems first"
              : "Stores the layout as a new version: the game shows it when the floor opens again"
          }
          onPress={() => void publish()}
        >
          Publish
        </TipButton>
        {backend.devTools && (
          <TipButton
            variant="secondary"
            size="sm"
            isDisabled={editing || editor.dirty || fileBlocked !== null}
            tip={
              fileBlocked
                ? fileBlocked
                : "Writes the published layout into shared/officeData.ts, so it becomes the default that comes with the code"
            }
            onPress={() => void exportToFile()}
          >
            Export published
          </TipButton>
        )}
      </header>

      <div className={styles.body}>
        {structureMode ? (
          <StructurePalette
            tool={tools.tool}
            onTool={tools.setTool}
            tone={tools.tone}
            onTone={tools.setTone}
            width={shell.width}
            depth={shell.depth}
            onSize={(width, depth) =>
              setEditor((state) => resizeStructureFloor(state, width, depth))
            }
            warning={describeOutside(outside)}
            onApplyTemplate={() => setApplying(true)}
            isDisabled={!editing}
          />
        ) : (
          <Palette
            models={modelFiles}
            placing={placing}
            isDisabled={!editing}
            onPlace={setPlacing}
            onUpload={
              backend.devTools ? (file) => void upload(file) : undefined
            }
          />
        )}

        <main className={styles.stage}>
          <canvas
            ref={canvasRef}
            width={view.canvasWidth}
            height={view.canvasHeight}
            className={styles.canvas(
              structureMode
                ? tools.tool === "select"
                  ? "default"
                  : "crosshair"
                : placing !== null
                  ? "copy"
                  : "default",
            )}
            aria-label="Plan of the office seen from above"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => {
              endDrag();
              tools.leave();
              setCursor(null);
            }}
          />
        </main>

        <aside className={styles.side}>
          {structureMode ? (
            <StructureInspector
              shell={shell}
              structure={editor.structure}
              isDisabled={!editing}
              onGeometry={(patch) =>
                setEditor((state) => setStructureGeometry(state, patch))
              }
              onMount={(patch) =>
                setEditor((state) => setStructureMount(state, patch))
              }
              onRename={(patch) => {
                const outcome = renameStructure(latest.current, patch);
                setEditor(outcome.state);
                return outcome.error;
              }}
              onTone={(tone) =>
                setEditor((state) => setStructureTone(state, tone))
              }
              onYaw={(yaw) => setEditor((state) => turnSpawn(state, yaw))}
              onDelete={() => {
                const outcome = deleteStructure(latest.current);
                setEditor(outcome.state);
                if (outcome.error ?? outcome.note)
                  say(outcome.error ?? outcome.note!);
              }}
            />
          ) : (
            <Inspector
              inspected={inspected}
              isDisabled={!editing}
              onMove={(x, z) => {
                setEditor((state) =>
                  moveSelectedTo(beginDrag(state), x, z, 0.001),
                );
              }}
              onRotate={() => setEditor(rotateSelected)}
              onVariant={(variant) =>
                setEditor((state) => setVariant(state, variant))
              }
              onModel={(patch) =>
                setEditor((state) => updateSelectedModel(state, patch))
              }
              onDuplicate={() => setEditor(duplicateSelected)}
              onDelete={() => setEditor(deleteSelected)}
            />
          )}
          <ProblemList problems={problems} onSelect={selectProblem} />
          <p className={styles.legend}>
            {structureMode ? LEGEND.structure : LEGEND.furniture}
          </p>
        </aside>
      </div>

      {tools.naming && (
        <NameModal
          kind={tools.naming.kind}
          validate={(name) => tools.validateName(name)}
          onSubmit={tools.name}
          onCancel={tools.cancelNaming}
        />
      )}
      {applying && (
        <TemplateModal
          templates={FLOOR_TEMPLATES}
          onApply={applyTemplateChoice}
          onCancel={() => setApplying(false)}
        />
      )}
    </div>
  );
}
