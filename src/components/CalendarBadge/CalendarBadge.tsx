import * as styles from "./styles";
import type { CalendarBadgeProps } from "./types";

/** A line under the zone badge: what is on in the private room the player is in. */
export function CalendarBadge({ text }: CalendarBadgeProps) {
  if (!text) return null;
  return (
    <div className={styles.badge} role="status" title={text}>
      {text}
    </div>
  );
}
