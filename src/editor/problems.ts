import type { Furniture } from "../../shared/furniture.ts";
import { findProblems, type Target } from "../../shared/officeProblems.ts";
import type { PropPlacement } from "../../shared/props.ts";
import {
  findShellProblems,
  type Shell,
  type ShellRef,
} from "../../shared/shell.ts";

/**
 * A problem is an error when the server would refuse to store the floor with it
 * (anything wrong with the shell) and a warning when it only asks to be
 * confirmed (furniture in a wall, a room nobody can reach).
 */
export type Level = "error" | "warning";

export interface EditorProblem {
  level: Level;
  message: string;
  /** The furniture and models it is about. */
  targets: Target[];
  /** The parts of the shell it is about. */
  structure: ShellRef[];
}

/** Everything wrong with a floor, the errors first. */
export function editorProblems(
  furniture: Furniture[],
  models: PropPlacement[],
  shell: Shell,
): EditorProblem[] {
  const errors = findShellProblems(shell).map((problem): EditorProblem => ({
    level: "error",
    message: problem.message,
    targets: [],
    structure: problem.refs ?? [],
  }));
  const warnings = findProblems(furniture, models, shell).map(
    (problem): EditorProblem => ({
      level: "warning",
      message: problem.message,
      targets: problem.targets,
      structure: [],
    }),
  );
  return [...errors, ...warnings];
}

/** How many problems stop the floor from being published. */
export const blocking = (problems: EditorProblem[]) =>
  problems.filter((problem) => problem.level === "error").length;

export const structureKey = (ref: ShellRef) => `${ref.kind}:${ref.index}`;

/** The parts of the shell some problem is about, as keys, to outline them in red. */
export const structureKeys = (problems: EditorProblem[]): ReadonlySet<string> =>
  new Set(problems.flatMap((problem) => problem.structure.map(structureKey)));
