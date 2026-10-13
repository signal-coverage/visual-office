import * as styles from "./styles";
import type { ToastProps } from "./types";

export function Toast({ text }: ToastProps) {
  if (!text) return null;

  return (
    <div style={styles.toast} role="status">
      {text}
    </div>
  );
}
