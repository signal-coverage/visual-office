import { PREFIX } from "./consts";
import * as styles from "./styles";
import type { FloorBadgeProps } from "./types";

export function FloorBadge({ name }: FloorBadgeProps) {
  if (!name) return null;
  return (
    <div className={styles.badge} role="status" aria-label="Current room">
      {PREFIX}
      {name}
    </div>
  );
}
