import type { Appearance } from "../../../shared/appearance.ts";

export interface AvatarPreviewProps {
  /** Shown on the name tag above the character. */
  name: string;
  appearance: Appearance;
}
