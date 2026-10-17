import type { FloorTone, Shell, ShellRef } from "../../../shared/shell.ts";
import type { Geometry, MountPatch } from "../shellEdit";

export interface StructureInspectorProps {
  shell: Shell;
  structure: ShellRef | null;
  /** Switches every field off, for when the plan cannot be edited. */
  isDisabled?: boolean;
  onGeometry: (patch: Partial<Geometry>) => void;
  onMount: (patch: MountPatch) => void;
  /** Gives a zone or an area another name or id; returns why it was refused, or null. */
  onRename: (patch: { label?: string; id?: string }) => string | null;
  onTone: (tone: FloorTone) => void;
  onYaw: (yaw: number) => void;
  onDelete: () => void;
}
