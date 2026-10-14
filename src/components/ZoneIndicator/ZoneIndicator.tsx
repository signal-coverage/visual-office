import { AREA_PREFIX, ZONE_PREFIX } from "./consts";
import * as styles from "./styles";
import type { ZoneIndicatorProps } from "./types";

export function ZoneIndicator({ label, area }: ZoneIndicatorProps) {
  if (label) {
    return (
      <div className={styles.badge} role="status">
        {ZONE_PREFIX}
        {label}
      </div>
    );
  }
  if (!area) return null;

  return (
    <div className={styles.areaBadge} role="status">
      {AREA_PREFIX}
      {area}
    </div>
  );
}
