import type { EditorProblem } from "../problems";

export interface ProblemListProps {
  problems: EditorProblem[];
  /** Selects what a problem is about (the part of the shell, or the furniture). */
  onSelect: (problem: EditorProblem) => void;
}
