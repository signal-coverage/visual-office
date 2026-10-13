import type { FurnitureKind } from "../../../shared/furniture.ts";

/** What the next click on the plan puts down. */
export type Placing =
  | { kind: "furniture"; furniture: FurnitureKind }
  | { kind: "model"; model: string };

export interface PaletteProps {
  /** The .glb files available in public/models. */
  models: string[];
  placing: Placing | null;
  onPlace: (placing: Placing | null) => void;
  /** The person picked a .glb file to add to the models. Without it there is no way to upload. */
  onUpload?: (file: File) => void;
  /** Switches every choice off, for when the plan cannot be edited. */
  isDisabled?: boolean;
}
