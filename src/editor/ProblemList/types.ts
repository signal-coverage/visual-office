import type { Problem, Target } from "../../../shared/officeProblems.ts";

export interface ProblemListProps {
  problems: Problem[];
  /** Selects the first thing a problem is about. */
  onSelect: (target: Target) => void;
}
