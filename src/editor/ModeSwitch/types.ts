/** What the plan is for: furniture and models, or the structure of the floor (walls, rooms, boards…). */
export type EditorMode = "furniture" | "structure";

export interface ModeSwitchProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}
