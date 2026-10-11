import { ZONE_PREFIX } from "./consts";
import * as styles from "./styles";
import type { ZoneIndicatorProps } from "./types";

export function ZoneIndicator({ label }: ZoneIndicatorProps) {
  if (!label) return null;

  return (
    <div style={styles.badge} role="status">
      {ZONE_PREFIX}
      {label}
    </div>
  );
}
