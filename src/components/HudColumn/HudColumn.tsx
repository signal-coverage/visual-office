import * as styles from "./styles";
import type { HudColumnProps } from "./types";

/**
 * The badges at the top left (who you are, the room, the part of the office,
 * the calendar). On a computer each sits at its own place on the screen. On a
 * phone they are stacked in one column that stays clear of the notch and of the
 * buttons on the right, however many of them there are.
 */
export function HudColumn({ touch, children }: HudColumnProps) {
  if (!touch) return <>{children}</>;
  return <div className={styles.column}>{children}</div>;
}
