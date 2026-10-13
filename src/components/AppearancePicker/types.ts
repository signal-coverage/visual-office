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
