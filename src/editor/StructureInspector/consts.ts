import type { FloorTone } from "../../../shared/shell.ts";

export const TONE_OPTIONS: ReadonlyArray<{ value: FloorTone; label: string }> =
  [
    { value: "meeting", label: "Meeting" },
    { value: "lounge", label: "Lounge" },
  ];

export const OPEN_FLOOR = "";

export const EMPTY_HINT =
  "Pick a tool and draw, or click a wall, a room, a board… on the plan to select it.";

export const ZONE_DELETE_HINT =
  "Deleting a private room also deletes its boards and screens.";
