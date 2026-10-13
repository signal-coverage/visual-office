import {
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type HairStyle,
} from "../../../shared/appearance.ts";
import type { PickerRow } from "./types";

const HAIR_STYLE_NAMES: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  none: "Bald",
};

/** In the order they are shown. */
export const ROWS: readonly PickerRow[] = [
  { field: "skin", label: "Skin", kind: "colors", colors: SKIN_TONES },
  {
    field: "hairStyle",
    label: "Hair style",
    kind: "names",
    names: HAIR_STYLES.map((style) => HAIR_STYLE_NAMES[style]),
  },
  {
    field: "hairColor",
    label: "Hair colour",
    kind: "colors",
    colors: HAIR_COLORS,
  },
  { field: "shirt", label: "Shirt", kind: "colors", colors: SHIRT_COLORS },
  { field: "pants", label: "Pants", kind: "colors", colors: PANTS_COLORS },
];

export const RANDOM_LABEL = "Surprise me";
