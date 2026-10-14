import type { Furniture } from "../../../shared/furniture.ts";
import type { PropPlacement } from "../../../shared/props.ts";

export type Inspected =
  | { list: "furniture"; item: Furniture }
  | { list: "models"; prop: PropPlacement };

export interface InspectorProps {
  inspected: Inspected | null;
  onMove: (x: number, z: number) => void;
  onRotate: () => void;
  onVariant: (variant: number) => void;
  onModel: (
    patch: Partial<Pick<PropPlacement, "footprint" | "scale" | "rotationDeg">>,
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Switches every field off, for when the plan cannot be edited. */
  isDisabled?: boolean;
}

export interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  isDisabled?: boolean;
  /** Called with a valid number, when the person leaves the field or presses Enter. */
  onCommit: (value: number) => void;
}

export interface ChoiceFieldProps {
  label: string;
  value: number;
  options: ReadonlyArray<{ value: number; label: string }>;
  isDisabled?: boolean;
  onChoose: (value: number) => void;
}
