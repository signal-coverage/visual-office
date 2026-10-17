import type { FloorTone } from "../../../shared/shell.ts";

/** What a click or a drag on the plan does in the structure mode. */
export type Tool =
  | "select"
  | "wall"
  | "glass"
  | "zone"
  | "area"
  | "board"
  | "screen"
  | "spawn"
  | "floor";

export interface StructurePaletteProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** The colour the next floor patch gets. */
  tone: FloorTone;
  onTone: (tone: FloorTone) => void;
  width: number;
  depth: number;
  onSize: (width: number, depth: number) => void;
  /** What sticks out past the floor of the size it has now, in words; null when nothing does. */
  warning: string | null;
  onApplyTemplate: () => void;
  /** Switches every choice off, for when the plan cannot be edited. */
  isDisabled?: boolean;
}
