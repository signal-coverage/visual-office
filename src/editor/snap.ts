/** Rounds to the grid, without the crumbs floating point leaves (0.30000000000000004). */
export function snap(value: number, step: number): number {
  const rounded = step > 0 ? Math.round(value / step) * step : value;
  return step > 0 ? Math.round(rounded * 1e6) / 1e6 : rounded;
}
