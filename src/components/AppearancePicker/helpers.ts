/** A 0xRRGGBB colour as a `#rrggbb` string. */
export const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** The position of a `#rrggbb` colour (in any case) in a palette of 0xRRGGBB colours, or -1. */
export const indexOfColor = (colors: readonly number[], color: string) =>
  colors.findIndex((candidate) => hex(candidate) === color.toLowerCase());
