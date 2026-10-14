import type { Appearance } from "../../../shared/appearance.ts";
import type { PREVIEW_SIZES } from "./consts";

export interface AvatarPreviewProps {
  /** Shown on the name tag above the character. */
  name: string;
  appearance: Appearance;
  /** How big the preview is. Defaults to the small one. */
  size?: keyof typeof PREVIEW_SIZES;
}
