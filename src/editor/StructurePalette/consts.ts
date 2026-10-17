import type { FloorTone } from "../../../shared/shell.ts";
import type { Tool } from "./types";

export const TOOLS: ReadonlyArray<{ id: Tool; label: string; hint: string }> = [
  {
    id: "select",
    label: "Select",
    hint: "Click a part to select it, drag it to move it. Delete removes it and the arrow keys nudge it.",
  },
  {
    id: "wall",
    label: "Wall",
    hint: "Drag along the floor. A short drag makes a thin wall on the line; Esc stops.",
  },
  {
    id: "glass",
    label: "Glass wall",
    hint: "Drag along the floor, as with a wall. People see through glass but cannot walk through it.",
  },
  {
    id: "zone",
    label: "Private room",
    hint: "Drag a rectangle, then name it. Whoever is inside talks only with the others inside.",
  },
  {
    id: "area",
    label: "Area",
    hint: "Drag a rectangle, then name it. Only the name changes: where people say they are.",
  },
  {
    id: "board",
    label: "Whiteboard",
    hint: "Click on a wall. It hangs on the face nearest your click, and belongs to the private room it looks into (or to the open floor).",
  },
  {
    id: "screen",
    label: "Screen",
    hint: "Click on a wall inside a private room: a screen always belongs to one.",
  },
  {
    id: "spawn",
    label: "Where people appear",
    hint: "Drag a rectangle clear of walls and private rooms. Pick the way they look in the inspector.",
  },
  {
    id: "floor",
    label: "Floor patch",
    hint: "Drag a rectangle to lay another floor material over the wooden one.",
  },
];

export const TONES: ReadonlyArray<{ id: FloorTone; label: string }> = [
  { id: "meeting", label: "Meeting" },
  { id: "lounge", label: "Lounge" },
];
