/** The grids the plan can snap to, in meters. */
export const SNAPS: ReadonlyArray<{ step: number; label: string }> = [
  { step: 0.05, label: "5 cm" },
  { step: 0.25, label: "25 cm" },
  { step: 0.5, label: "50 cm" },
];

export const DEFAULT_STEP = 0.05;

/** The least movement of the mouse (pixels) that counts as a drag, not a click. */
export const DRAG_THRESHOLD = 3;

export const STATUS = {
  saved: "Saved. The game reloads by itself; reload any open game tab.",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  clean: "Everything is saved",
  readOnly: "Read only: press Start editing to change the plan",
  lost: "The floor lock was lost (it ran out or was taken). Save nothing; press Start editing to take it again.",
} as const;

export const FALLBACK_FOOTPRINT: readonly [number, number] = [1, 1];
