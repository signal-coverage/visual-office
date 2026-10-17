import type { ReactNode } from "react";
import type { Appearance } from "../../../shared/appearance.ts";

export interface CharacterScreenProps {
  name: string;
  appearance: Appearance;
  /** The name of somebody whose company does not let them choose: shown, and not for them to change. */
  fixedName?: string;
  accountMenu?: ReactNode;
  /** Walked with fingers: the name field does not pop the keyboard up by itself. */
  touch: boolean;
  onNameChange: (name: string) => void;
  onAppearanceChange: (appearance: Appearance) => void;
  onBack: () => void;
}
