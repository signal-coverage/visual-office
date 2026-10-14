import {
  ACCESSORIES,
  FACIAL_HAIR,
  GLASSES,
  HAIR_COLORS,
  HEADWEAR,
  SHOES,
  TOPS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  type Accessory,
  type FacialHair,
  type Glasses,
  type HairStyle,
  type Headwear,
  type Shoes,
  type Top,
} from "../../../shared/appearance.ts";
import type { PickerRow, PickerTab } from "./types";

const HAIR_STYLE_NAMES: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  none: "Bald",
  buzz: "Buzz cut",
  bun: "Bun",
  ponytail: "Ponytail",
  curly: "Curly",
  mohawk: "Mohawk",
};

const FACIAL_HAIR_NAMES: Record<FacialHair, string> = {
  none: "None",
  stubble: "Stubble",
  moustache: "Moustache",
  beard: "Beard",
};

const GLASSES_NAMES: Record<Glasses, string> = {
  none: "None",
  round: "Round",
  square: "Square",
  sunglasses: "Sunglasses",
};

const HEADWEAR_NAMES: Record<Headwear, string> = {
  none: "None",
  cap: "Cap",
  beanie: "Beanie",
};

const TOP_NAMES: Record<Top, string> = {
  long: "Long sleeves",
  tee: "T-shirt",
  hoodie: "Hoodie",
  collar: "Shirt and tie",
  blazer: "Blazer",
};

const SHOE_NAMES: Record<Shoes, string> = {
  none: "None",
  dark: "Dark",
  white: "White",
  red: "Red",
  blue: "Blue",
  yellow: "Yellow",
};

const ACCESSORY_NAMES: Record<Accessory, string> = {
  none: "None",
  headphones: "Headphones",
  lanyard: "Lanyard",
  watch: "Watch",
  scarf: "Scarf",
};

const SKIN: PickerRow = {
  field: "skin",
  label: "Skin",
  kind: "colors",
  colors: SKIN_TONES,
};
const HAIR_STYLE: PickerRow = {
  field: "hairStyle",
  label: "Hair style",
  kind: "names",
  names: HAIR_STYLES.map((style) => HAIR_STYLE_NAMES[style]),
};
const HAIR_COLOR: PickerRow = {
  field: "hairColor",
  label: "Hair colour",
  kind: "colors",
  colors: HAIR_COLORS,
};
const FACIAL_HAIR_ROW: PickerRow = {
  field: "facialHair",
  label: "Facial hair",
  kind: "names",
  names: FACIAL_HAIR.map((option) => FACIAL_HAIR_NAMES[option]),
};
const GLASSES_ROW: PickerRow = {
  field: "glasses",
  label: "Glasses",
  kind: "names",
  names: GLASSES.map((option) => GLASSES_NAMES[option]),
};
const TOP_ROW: PickerRow = {
  field: "top",
  label: "Top",
  kind: "names",
  names: TOPS.map((option) => TOP_NAMES[option]),
};
const SHIRT: PickerRow = {
  field: "shirt",
  label: "Shirt",
  kind: "colors",
  colors: SHIRT_COLORS,
};
const PANTS: PickerRow = {
  field: "pants",
  label: "Pants",
  kind: "colors",
  colors: PANTS_COLORS,
};
const SHOES_ROW: PickerRow = {
  field: "shoes",
  label: "Shoes",
  kind: "names",
  names: SHOES.map((option) => SHOE_NAMES[option]),
};
const HEADWEAR_ROW: PickerRow = {
  field: "headwear",
  label: "Headwear",
  kind: "names",
  names: HEADWEAR.map((option) => HEADWEAR_NAMES[option]),
};
const ACCESSORY_ROW: PickerRow = {
  field: "accessory",
  label: "Accessory",
  kind: "names",
  names: ACCESSORIES.map((option) => ACCESSORY_NAMES[option]),
};

/** In the order they are shown: what is picked together is on one tab, so no tab is taller than the menu. */
export const TABS: readonly PickerTab[] = [
  { id: "body", label: "Body", rows: [SKIN] },
  { id: "hair", label: "Hair", rows: [HAIR_STYLE, HAIR_COLOR] },
  { id: "face", label: "Face", rows: [FACIAL_HAIR_ROW, GLASSES_ROW] },
  { id: "clothes", label: "Clothes", rows: [TOP_ROW, SHIRT, PANTS, SHOES_ROW] },
  { id: "extras", label: "Extras", rows: [HEADWEAR_ROW, ACCESSORY_ROW] },
];

export const RANDOM_LABEL = "Surprise me";
export const TABS_LABEL = "Character options";
