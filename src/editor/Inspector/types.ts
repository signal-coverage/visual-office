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
