export interface RowProps {
  label: string;
  value: string;
  /** true paints the value red, false green, undefined leaves it neutral. */
  bad?: boolean;
}
