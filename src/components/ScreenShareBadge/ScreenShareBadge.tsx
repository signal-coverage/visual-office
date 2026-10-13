import { SHARING_MINE, sharingBy } from "./consts";
import * as styles from "./styles";
import type { ScreenShareBadgeProps } from "./types";

export function ScreenShareBadge({ info }: ScreenShareBadgeProps) {
  if (info.kind === "none") return null;

  return (
    <div style={styles.badge(info.kind === "local")} role="status">
      {info.kind === "local" ? SHARING_MINE : sharingBy(info.name)}
    </div>
  );
}
