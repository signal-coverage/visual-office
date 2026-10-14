export interface ZoneIndicatorProps {
  /** The name of the private zone the player is standing in, or null for the open office. */
  label: string | null;
  /** The part of the office the player is in (the kitchen...), shown when there is no private zone. */
  area: string | null;
}
