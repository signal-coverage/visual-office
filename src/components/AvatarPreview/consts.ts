/** The frame of the preview, by size: the small one fits beside the pickers, the large one is the lobby's. */
export const PREVIEW_SIZES = {
  small: { width: 140, height: 224 },
  large: { width: 280, height: 440 },
} as const;
/** How fast the character turns on its own, in radians per second. */
export const SPIN_SPEED = 0.7;
/** How much the character turns for each pixel the pointer is dragged, in radians. */
export const DRAG_SPEED = 0.012;
export const PREVIEW_LABEL = "Your character";
export const PREVIEW_UNAVAILABLE = "Preview unavailable in this browser";
