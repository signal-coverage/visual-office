import { YOU_SUFFIX } from "./consts";
import * as styles from "./styles";
import type { UserListProps } from "./types";

export function UserList({ roster }: UserListProps) {
  if (!roster || roster.count === 0) return null;

  return (
    <div style={styles.panel} aria-label="People here">
      <div style={styles.title}>
        {roster.title} · {roster.count}
      </div>
      <ul style={styles.list}>
        {roster.entries.map((entry) => (
          <li key={entry.id} style={styles.row}>
            <span style={styles.name(entry.color)}>
              {entry.name}
              {entry.you && YOU_SUFFIX}
            </span>
            {entry.place && <span style={styles.place}>{entry.place}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
