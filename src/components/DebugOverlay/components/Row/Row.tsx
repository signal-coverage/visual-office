import * as styles from "./styles";
import type { RowProps } from "./types";

export function Row({ label, value, bad }: RowProps) {
  return (
    <div style={styles.row}>
      <span>{label}</span>
      <span style={styles.value(bad)}>{value}</span>
    </div>
  );
}
