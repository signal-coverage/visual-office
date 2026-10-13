/** A 0xRRGGBB colour as a `#rrggbb` string. */
export const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
