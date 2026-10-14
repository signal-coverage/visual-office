import type { Appearance } from "../../../shared/appearance.ts";

export interface AppearancePickerProps {
  value: Appearance;
  onChange: (next: Appearance) => void;
}

/** One row of choices: a colour palette, or a list of named options. */
export type PickerRow = {
  field: keyof Appearance;
  label: string;
} & (
  | { kind: "colors"; colors: readonly number[] }
  | { kind: "names"; names: readonly string[] }
);

/** A group of rows the person switches to, so a long list of options never makes the panel tall. */
export interface PickerTab {
  id: string;
  label: string;
  rows: readonly PickerRow[];
}
