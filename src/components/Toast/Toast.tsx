import * as styles from "./styles";
import type { ToastProps } from "./types";

export function Toast({ text, slot = "notice" }: ToastProps) {
  if (!text) return null;

  return (
    <div
      className={slot === "alert" ? styles.alert : styles.toast}
      role="status"
    >
      {text}
    </div>
  );
}
