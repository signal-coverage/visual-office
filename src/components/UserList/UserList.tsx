import { cn } from "../../lib/cn";
import { STATUS_LABELS } from "../../../shared/presence.ts";
import { StatusDot } from "../StatusDot";
import { YOU_SUFFIX } from "./consts";
import * as styles from "./styles";
import type { UserListProps } from "./types";

export function UserList({ roster, className }: UserListProps) {
  if (!roster || roster.count === 0) return null;

  return (
    <div className={cn(styles.panel, className)} aria-label="People here">
      <div className={styles.title}>
        {roster.title} · {roster.count}
      </div>
      <ul className={styles.list}>
        {roster.entries.map((entry) => (
          <li key={entry.id} className={styles.row}>
            <span className={styles.person}>
              <StatusDot status={entry.status} />
              <span
                className={styles.nameClass}
                style={styles.name(entry.color)}
              >
                {entry.name}
                {entry.you && YOU_SUFFIX}
              </span>
            </span>
            {(entry.place || entry.status !== "available") && (
              <span className={styles.place}>
                {entry.place ?? STATUS_LABELS[entry.status]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
